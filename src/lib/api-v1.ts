import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { jsonErr, jsonOk } from "./api";
import {
  authenticateVendorRequest,
  issueVendorJwt,
  readBearerUser,
  requireAnyRole,
  requireSellerForTin,
} from "./api-auth";
import { issueJwt, issueOAuthClientCredentials, verifyOAuthClientSecret, hashOtp, verifyOtp } from "./auth";
import { encryptPhone, decryptPhone } from "./crypto";
import { mockSms } from "./delivery";
import { completeInvoice } from "./invoice-service";
import {
  generateOtpSessionId,
  generateReportId,
  nextGqId,
  nextMrc,
} from "./ids";
import { prisma } from "./prisma";
import { buildDynamicPayload, buildStaticPayload, parseQrPayload } from "./qr";
import { maskPhone, parseDateParam, readJson, readRawJson, verifyOptionalHmac } from "./request-utils";
import { transitionGlobalQr } from "./state-machine";
import { fireVendorWebhook } from "./vendor-webhook";
import { writeAudit } from "./audit";

const REQUEST_STATUSES = ["QUEUEING", "GENERATING", "STANDBY", "ADJUST", "DONE", "REFUNDED", "FAILED"];

function isValidSdcNumber(value: unknown) {
  return typeof value === "string" && /^[a-z0-9]{8,}$/i.test(value);
}

async function requireOtpOrCitizen(request: Request, phone: string) {
  const bearer = await readBearerUser(request);

  if (bearer) {
    if (bearer.role !== "citizen" || bearer.sub === phone) {
      return true;
    }
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const latest = await prisma.otpSession.findFirst({
    where: {
      phone,
      verified: true,
      createdAt: { gte: tenMinutesAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  return Boolean(latest);
}

async function resolveRequestInput(body: Record<string, unknown>) {
  if (typeof body.payload === "string") {
    const parsed = parseQrPayload(body.payload);
    const move =
      parsed.version === "GQ2"
        ? await prisma.move.findFirst({ where: { docRef: parsed.docRef } })
        : await prisma.move.findFirst({
            where: { tin: parsed.tin, mrc: parsed.mrc },
            orderBy: { ts: "desc" },
          });

    return {
      tin: parsed.tin,
      mrc: parsed.mrc,
      docRef: parsed.version === "GQ2" ? parsed.docRef : move?.docRef,
      amount: move?.amount,
      items: move?.items,
      moveId: move?.moveId,
    };
  }

  if (typeof body.code === "string") {
    const move = await prisma.move.findFirst({ where: { docRef: body.code } });

    if (!move) {
      throw new Error("Code not found");
    }

    return {
      tin: move.tin,
      mrc: move.mrc ?? undefined,
      docRef: move.docRef,
      amount: move.amount,
      items: move.items,
      moveId: move.moveId,
    };
  }

  throw new Error("payload or code is required");
}

async function findRecentDuplicate(input: {
  tin: string;
  mrc?: string | null;
  docRef?: string | null;
  phone: string;
}) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const candidates = await prisma.globalQr.findMany({
    where: {
      tin: input.tin,
      mrc: input.mrc ?? null,
      docRef: input.docRef ?? null,
      createdAt: { gte: fiveMinutesAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const candidate of candidates) {
    try {
      if (decryptPhone(candidate.buyerPhoneEnc) === input.phone) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function issueOtpRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.phone !== "string") {
    return jsonErr("phone is required", 400);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpSession.create({
    data: {
      id: generateOtpSessionId(),
      phone: body.phone,
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  mockSms(body.phone, `Your Global QR code is ${code}`);

  return jsonOk({ expiresIn: 300, debugCode: code });
}

export async function verifyOtpRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.phone !== "string" || typeof body.code !== "string") {
    return jsonErr("phone and code are required", 400);
  }

  const session = await prisma.otpSession.findFirst({
    where: {
      phone: body.phone,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session || !(await verifyOtp(body.code, session.codeHash))) {
    return jsonErr("Invalid or expired OTP", 400);
  }

  await prisma.otpSession.update({
    where: { id: session.id },
    data: { verified: true },
  });

  const token = await issueJwt({ sub: body.phone, role: "citizen" });
  return jsonOk({ token, role: "citizen" });
}

export async function createRequestRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.phone !== "string") {
    return jsonErr("phone is required", 400);
  }

  if (!(await requireOtpOrCitizen(request, body.phone))) {
    return jsonErr("Recent verified OTP or citizen token required", 401);
  }

  let resolved: Awaited<ReturnType<typeof resolveRequestInput>>;

  try {
    resolved = await resolveRequestInput(body);
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Invalid request", 400);
  }

  const duplicate = await findRecentDuplicate({
    tin: resolved.tin,
    mrc: resolved.mrc,
    docRef: resolved.docRef,
    phone: body.phone,
  });

  if (duplicate) {
    return jsonOk({ gqId: duplicate.gqId, status: duplicate.status, eta: "24h" });
  }

  const gqId = await nextGqId();
  const created = await prisma.globalQr.create({
    data: {
      gqId,
      tin: resolved.tin,
      mrc: resolved.mrc,
      docRef: resolved.docRef,
      moveId: resolved.moveId,
      amount: resolved.amount,
      items: resolved.items,
      channel: typeof body.channel === "string" ? body.channel : "QR",
      buyerPhoneEnc: encryptPhone(body.phone),
      geo: typeof body.geo === "string" ? body.geo : undefined,
      status: "QUEUEING",
    },
  });

  const mrc = created.mrc ? await prisma.mrc.findUnique({ where: { mrc: created.mrc } }) : null;
  const status = mrc?.vendorId ? "GENERATING" : "STANDBY";
  const transitioned = await transitionGlobalQr(created.gqId, status, {
    actor: body.phone,
    role: "citizen",
    decision: status === "GENERATING" ? "ROUTED_TO_VENDOR" : "NO_VENDOR",
    decisionBy: "system",
  });

  if (status === "GENERATING") {
    fireVendorWebhook(created.gqId).catch((error) => console.error("[WEBHOOK FIRE FAILED]", error));
  }

  return jsonOk({ gqId: transitioned.gqId, status: transitioned.status, eta: "24h" });
}

export async function getRequestRoute(request: Request, gqId: string) {
  const user = await readBearerUser(request);
  const record = await prisma.globalQr.findUnique({ where: { gqId } });

  if (!record) {
    return jsonErr("Request not found", 404);
  }

  if (!user) {
    let phone: string | null = null;

    try {
      phone = decryptPhone(record.buyerPhoneEnc);
    } catch {
      return jsonErr("Unauthorized", 401);
    }

    if (!(await requireOtpOrCitizen(request, phone))) {
      return jsonErr("Unauthorized", 401);
    }
  }

  const timeline = await prisma.auditLog.findMany({
    where: { entity: "GlobalQr", entityId: gqId },
    orderBy: { ts: "asc" },
    select: { action: true, role: true, ts: true, after: true },
  });

  return jsonOk({
    gqId: record.gqId,
    status: record.status,
    tin: record.tin,
    mrc: record.mrc,
    docRef: record.docRef,
    amount: record.amount,
    channel: record.channel,
    scanTs: record.scanTs,
    deliveredVia: record.deliveredVia,
    deliveredTs: record.deliveredTs,
    timeline,
  });
}

export async function selfIssueRoute(request: Request, gqId: string) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["seller", "admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  if (!body || !isValidSdcNumber(body.sdcNumber)) {
    return jsonErr("Valid sdcNumber is required", 400);
  }

  const record = await prisma.globalQr.findUnique({ where: { gqId } });

  if (!record) {
    return jsonErr("Request not found", 404);
  }

  if (auth.user.role === "seller" && auth.user.tin !== record.tin) {
    return jsonErr("Forbidden", 403);
  }

  if (record.status !== "STANDBY" && record.status !== "REFUNDED") {
    return jsonErr("Request must be in STANDBY", 400);
  }

  const updated = await transitionGlobalQr(gqId, "REFUNDED", {
    actor: auth.user.sub,
    role: String(auth.user.role),
    decision: "SELLER_SELF_ISSUED",
    decisionBy: auth.user.sub,
    extra: { sdcNumber: body.sdcNumber as string },
  });

  return jsonOk({ gqId: updated.gqId, status: updated.status });
}

export async function adjustRequestRoute(request: Request, gqId: string) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["GQ_ADMIN", "admin"]);

  if (auth.response) {
    return auth.response;
  }

  if (!body || (body.decision !== "REFUND" && body.decision !== "FINAL_PUSH")) {
    return jsonErr("decision must be REFUND or FINAL_PUSH", 400);
  }

  const toStatus = body.decision === "REFUND" ? "REFUNDED" : "DONE";
  const updated = await transitionGlobalQr(gqId, toStatus, {
    actor: auth.user.sub,
    role: String(auth.user.role),
    decision: body.decision,
    decisionBy: auth.user.sub,
    extra:
      body.decision === "FINAL_PUSH"
        ? { sdcNumber: `SDC-${Date.now()}`, rraResponse: JSON.stringify({ pushed: true }) }
        : undefined,
  });

  await writeAudit({
    actor: auth.user.sub,
    role: String(auth.user.role),
    action: "ADMIN_ADJUST",
    entity: "GlobalQr",
    entityId: gqId,
    after: { decision: body.decision, reason: body.reason },
  });

  return jsonOk({ gqId: updated.gqId, status: updated.status });
}

export async function resolveCodeRoute(code: string) {
  const move = await prisma.move.findFirst({ where: { docRef: code } });

  if (!move) {
    return jsonErr("Code not found", 404);
  }

  const seller = await prisma.seller.findUnique({ where: { tin: move.tin } });

  return jsonOk({
    sellerName: seller?.name,
    tin: move.tin,
    amount: move.amount,
    docRef: move.docRef,
    mrc: move.mrc,
  });
}

export async function upsertMoveRoute(request: Request) {
  const { raw, body } = await readRawJson(request);

  if (!body || !verifyOptionalHmac(request, raw)) {
    return jsonErr("Invalid body or signature", 400);
  }

  const user = await authenticateVendorRequest(request, body);

  if (!user) {
    return jsonErr("Unauthorized vendor", 401);
  }

  const required = ["moveId", "vendorId", "tin", "moveType", "docRef", "items", "amount", "ts"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === null);

  if (missing.length) {
    return jsonErr("Missing move fields", 400, { missing });
  }

  if (user.role === "vendor" && user.vendorId && user.vendorId !== body.vendorId) {
    return jsonErr("Forbidden", 403);
  }

  const move = await prisma.move.upsert({
    where: { moveId: String(body.moveId) },
    create: {
      moveId: String(body.moveId),
      vendorId: String(body.vendorId),
      tin: String(body.tin),
      mrc: typeof body.mrc === "string" ? body.mrc : undefined,
      moveType: String(body.moveType),
      docRef: String(body.docRef),
      items: typeof body.items === "string" ? body.items : JSON.stringify(body.items),
      amount: Number(body.amount),
      currency: typeof body.currency === "string" ? body.currency : "RWF",
      ts: new Date(String(body.ts)),
      raw,
    },
    update: {
      tin: String(body.tin),
      mrc: typeof body.mrc === "string" ? body.mrc : undefined,
      moveType: String(body.moveType),
      docRef: String(body.docRef),
      items: typeof body.items === "string" ? body.items : JSON.stringify(body.items),
      amount: Number(body.amount),
      currency: typeof body.currency === "string" ? body.currency : "RWF",
      ts: new Date(String(body.ts)),
      raw,
    },
  });

  return jsonOk({ moveId: move.moveId, idempotent: true });
}

export async function invoiceCallbackRoute(request: Request) {
  const { raw, body } = await readRawJson(request);

  if (!body || !verifyOptionalHmac(request, raw)) {
    return jsonErr("Invalid body or signature", 400);
  }

  if (typeof body.gqId !== "string" || typeof body.sdcNumber !== "string") {
    return jsonErr("gqId and sdcNumber are required", 400);
  }

  try {
    const completed = await completeInvoice({
      gqId: body.gqId,
      sdcNumber: body.sdcNumber,
      rraResponse: body.rraResponse,
      invoicePdfUrl: typeof body.invoicePdfUrl === "string" ? body.invoicePdfUrl : undefined,
    });

    return jsonOk({ gqId: completed.gqId, status: completed.status });
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Invoice callback failed", 400);
  }
}

export async function getInvoiceRoute(request: Request, gqId: string) {
  const user = await readBearerUser(request);

  if (!user) {
    return jsonErr("Unauthorized", 401);
  }

  const record = await prisma.globalQr.findUnique({ where: { gqId } });

  if (!record) {
    return jsonErr("Invoice not found", 404);
  }

  return jsonOk({
    gqId: record.gqId,
    status: record.status,
    sdcNumber: record.sdcNumber,
    rraResponse: record.rraResponse,
    invoicePdfUrl: record.invoicePdfUrl,
    deliveredVia: record.deliveredVia,
    deliveredTs: record.deliveredTs,
  });
}

export async function paymentNotifyRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.txnId !== "string" || typeof body.payeeTin !== "string") {
    return jsonErr("txnId and payeeTin are required", 400);
  }

  const amount = Number(body.amount);
  const ts = new Date(String(body.ts ?? new Date().toISOString()));
  const low = amount * 0.95;
  const high = amount * 1.05;
  const windowStart = new Date(ts.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(ts.getTime() + 2 * 60 * 60 * 1000);
  const matches = await prisma.globalQr.findMany({
    where: {
      tin: body.payeeTin,
      amount: { gte: low, lte: high },
      scanTs: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { scanTs: "desc" },
  });
  const matchStatus = matches.length === 1 ? "LINKED" : matches.length > 1 ? "AMBIGUOUS" : "UNMATCHED";
  const payment = await prisma.payment.upsert({
    where: { txnId: body.txnId },
    create: {
      txnId: body.txnId,
      provider: String(body.provider ?? "UNKNOWN"),
      payerRef: typeof body.payerRef === "string" ? body.payerRef : undefined,
      payeeTin: body.payeeTin,
      amount,
      ts,
      gqId: matchStatus === "LINKED" ? matches[0].gqId : undefined,
      matchStatus,
    },
    update: {
      provider: String(body.provider ?? "UNKNOWN"),
      payerRef: typeof body.payerRef === "string" ? body.payerRef : undefined,
      payeeTin: body.payeeTin,
      amount,
      ts,
      gqId: matchStatus === "LINKED" ? matches[0].gqId : null,
      matchStatus,
    },
  });

  return jsonOk({ txnId: payment.txnId, matchStatus, gqId: payment.gqId });
}

export async function getPaymentRoute(txnId: string) {
  const payment = await prisma.payment.findUnique({ where: { txnId } });
  return payment ? jsonOk(payment) : jsonErr("Payment not found", 404);
}

export async function createSellerRoute(request: Request) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  if (!body || typeof body.tin !== "string" || typeof body.name !== "string") {
    return jsonErr("tin and name are required", 400);
  }

  const seller = await prisma.seller.upsert({
    where: { tin: body.tin },
    create: {
      tin: body.tin,
      name: body.name,
      sector: String(body.sector ?? "general"),
      contacts: typeof body.contacts === "string" ? body.contacts : undefined,
      vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined,
      status: typeof body.status === "string" ? body.status : "ACTIVE",
    },
    update: {
      name: body.name,
      sector: String(body.sector ?? "general"),
      contacts: typeof body.contacts === "string" ? body.contacts : undefined,
      vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined,
      status: typeof body.status === "string" ? body.status : "ACTIVE",
    },
  });

  return jsonOk(seller);
}

export async function sellerRequestsRoute(request: Request, tin: string) {
  const auth = await requireSellerForTin(request, tin);

  if (auth.response) {
    return auth.response;
  }

  const records = await prisma.globalQr.findMany({
    where: { tin, status: { in: ["QUEUEING", "STANDBY"] } },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(
    records.map((record) => {
      const { buyerPhoneEnc, ...safeRecord } = record;
      void buyerPhoneEnc;
      return safeRecord;
    }),
  );
}

export async function sellerMrcRoute(request: Request, tin: string) {
  const auth = await requireSellerForTin(request, tin);

  if (auth.response) {
    return auth.response;
  }

  return jsonOk(await prisma.mrc.findMany({ where: { tin }, orderBy: { issuedAt: "desc" } }));
}

export async function qrRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.tin !== "string") {
    return jsonErr("tin is required", 400);
  }

  let mrc = typeof body.mrc === "string" ? await prisma.mrc.findUnique({ where: { mrc: body.mrc } }) : null;

  if (!mrc) {
    mrc = await prisma.mrc.create({
      data: {
        mrc: typeof body.mrc === "string" ? body.mrc : nextMrc(),
        tin: body.tin,
        deviceType: String(body.deviceType ?? "QR"),
        locationLabel: typeof body.locationLabel === "string" ? body.locationLabel : undefined,
        qrVersion: String(body.qrVersion ?? "GQ1"),
        issuedAt: new Date(),
        issuedBy: "api",
      },
    });
  }

  const payload =
    mrc.qrVersion === "GQ2"
      ? buildDynamicPayload({
          tin: mrc.tin,
          mrc: mrc.mrc,
          txTs: new Date().toISOString(),
          docRef: `DOC-${Date.now()}`,
        })
      : buildStaticPayload({
          tin: mrc.tin,
          mrc: mrc.mrc,
          issuedTs: mrc.issuedAt.toISOString(),
        });
  const dataUrl = await QRCode.toDataURL(payload);

  return jsonOk({ mrc: mrc.mrc, payload, dataUrl });
}

export async function createMrcRoute(request: Request) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["MRC_ISSUER", "GQ_ADMIN", "admin"]);

  if (auth.response) {
    return auth.response;
  }

  if (!body || typeof body.tin !== "string") {
    return jsonErr("tin is required", 400);
  }

  const mrc = await prisma.mrc.create({
    data: {
      mrc: typeof body.mrc === "string" ? body.mrc : nextMrc(),
      tin: body.tin,
      vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined,
      locationLabel: typeof body.locationLabel === "string" ? body.locationLabel : undefined,
      deviceType: String(body.deviceType ?? "QR"),
      qrVersion: String(body.qrVersion ?? "GQ1"),
      status: "ACTIVE",
      issuedAt: new Date(),
      issuedBy: auth.user.sub,
    },
  });

  return jsonOk(mrc);
}

export async function getMrcRoute(mrcId: string) {
  const mrc = await prisma.mrc.findUnique({ where: { mrc: mrcId } });
  return mrc ? jsonOk(mrc) : jsonErr("MRC not found", 404);
}

export async function patchMrcRoute(request: Request, mrcId: string) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["MRC_ISSUER", "GQ_ADMIN", "admin"]);

  if (auth.response) {
    return auth.response;
  }

  if (!body || typeof body.action !== "string") {
    return jsonErr("action is required", 400);
  }

  const statusByAction: Record<string, string | undefined> = {
    ACTIVATE: "ACTIVE",
    SUSPEND: "SUSPENDED",
    RETIRE: "RETIRED",
    REASSIGN: undefined,
  };

  if (!(body.action in statusByAction)) {
    return jsonErr("Unsupported action", 400);
  }

  const updated = await prisma.mrc.update({
    where: { mrc: mrcId },
    data: {
      status: statusByAction[body.action] ?? undefined,
      vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined,
    },
  });

  await writeAudit({
    actor: auth.user.sub,
    role: String(auth.user.role),
    action: `MRC_${body.action}`,
    entity: "Mrc",
    entityId: mrcId,
    after: updated,
  });

  return jsonOk(updated);
}

export async function claimVendorMrcRoute(request: Request, vendorId: string) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["vendor", "admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user.role === "vendor" && auth.user.vendorId !== vendorId) {
    return jsonErr("Forbidden", 403);
  }

  if (!body || !Array.isArray(body.mrcs)) {
    return jsonErr("mrcs array is required", 400);
  }

  const result = await prisma.mrc.updateMany({
    where: { mrc: { in: body.mrcs.map(String) } },
    data: { vendorId },
  });

  return jsonOk({ claimed: result.count });
}

export async function createVendorRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.name !== "string") {
    return jsonErr("name is required", 400);
  }

  const credentials = await issueOAuthClientCredentials();
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : `VND-${Date.now()}`;
  const vendor = await prisma.vendor.create({
    data: {
      vendorId,
      name: body.name,
      vsdcRef: typeof body.vsdcRef === "string" ? body.vsdcRef : undefined,
      webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
      oauthClientId: credentials.clientId,
      oauthClientSecretHash: credentials.clientSecretHash,
      status: "PENDING",
    },
  });

  return jsonOk({
    vendorId: vendor.vendorId,
    oauthClientId: credentials.clientId,
    oauthClientSecret: credentials.clientSecret,
  });
}

export async function vendorHealthRoute(vendorId: string) {
  const vendor = await prisma.vendor.update({
    where: { vendorId },
    data: { lastHeartbeat: new Date(), status: "LIVE" },
  });

  return jsonOk({ vendorId: vendor.vendorId, status: vendor.status, lastHeartbeat: vendor.lastHeartbeat });
}

export async function authTokenRoute(request: Request) {
  const body = await readJson(request);

  if (!body) {
    return jsonErr("Invalid body", 400);
  }

  if (body.grant_type === "client_credentials") {
    if (typeof body.client_id !== "string" || typeof body.client_secret !== "string") {
      return jsonErr("client_id and client_secret are required", 400);
    }

    const vendor = await prisma.vendor.findFirst({ where: { oauthClientId: body.client_id } });

    if (!vendor?.oauthClientSecretHash || !(await verifyOAuthClientSecret(body.client_secret, vendor.oauthClientSecretHash))) {
      return jsonErr("Invalid client credentials", 401);
    }

    return jsonOk({ token: await issueVendorJwt(vendor.vendorId), role: "vendor", vendorId: vendor.vendorId });
  }

  if (body.grant_type === "password") {
    const login = typeof body.phone === "string" ? { phone: body.phone } : { email: String(body.email ?? "") };
    const user = await prisma.user.findFirst({ where: login });

    if (!user?.passwordHash || typeof body.password !== "string" || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return jsonErr("Invalid credentials", 401);
    }

    const token = await issueJwt({
      sub: user.id,
      role: user.role,
      tin: user.tin ?? undefined,
      vendorId: user.vendorId ?? undefined,
    });

    return jsonOk({ token, role: user.role, tin: user.tin, vendorId: user.vendorId });
  }

  if (typeof body.role === "string") {
    const user = await prisma.user.findFirst({ where: { role: body.role } });
    const token = await issueJwt({
      sub: user?.id ?? `demo-${body.role}`,
      role: body.role,
      tin: user?.tin ?? undefined,
      vendorId: user?.vendorId ?? undefined,
    });

    return jsonOk({ token, role: body.role, tin: user?.tin, vendorId: user?.vendorId });
  }

  return jsonErr("Unsupported grant", 400);
}

export async function rraConversionRoute(request: Request) {
  const auth = await requireAnyRole(request, ["rra", "RRA_AGENT", "admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const dateFrom = parseDateParam(url.searchParams.get("dateFrom"));
  const dateTo = parseDateParam(url.searchParams.get("dateTo"));
  const tin = url.searchParams.get("tin") ?? undefined;
  const sector = url.searchParams.get("sector") ?? undefined;
  const mrc = url.searchParams.get("mrc") ?? undefined;
  const hour = url.searchParams.get("hour");
  const records = await prisma.globalQr.findMany({
    where: {
      tin,
      mrc,
      scanTs: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
  });
  const sellers = await prisma.seller.findMany({
    where: { tin: { in: Array.from(new Set(records.map((record) => record.tin))) } },
  });
  const sellerByTin = new Map(sellers.map((seller) => [seller.tin, seller]));
  const filtered = records.filter((record) => {
    const seller = sellerByTin.get(record.tin);
    const hourMatches = hour ? record.scanTs.getHours() === Number(hour) : true;
    return (!sector || seller?.sector === sector) && hourMatches;
  });
  const invoices = filtered.filter((record) => record.status === "DONE").length;
  const bySector = new Map<string, { requests: number; invoices: number }>();
  const heat = new Map<string, { tin: string; hour: number; requests: number; invoices: number }>();

  for (const record of filtered) {
    const sellerSector = sellerByTin.get(record.tin)?.sector ?? "unknown";
    const sectorRow = bySector.get(sellerSector) ?? { requests: 0, invoices: 0 };
    sectorRow.requests += 1;
    sectorRow.invoices += record.status === "DONE" ? 1 : 0;
    bySector.set(sellerSector, sectorRow);

    const rowHour = record.scanTs.getHours();
    const key = `${record.tin}:${rowHour}`;
    const row = heat.get(key) ?? { tin: record.tin, hour: rowHour, requests: 0, invoices: 0 };
    row.requests += 1;
    row.invoices += record.status === "DONE" ? 1 : 0;
    heat.set(key, row);
  }

  return jsonOk({
    kpis: {
      requests: filtered.length,
      invoices,
      conversion: filtered.length ? invoices / filtered.length : 0,
    },
    bySector: Array.from(bySector.entries()).map(([name, row]) => ({
      sector: name,
      ...row,
      conversion: row.requests ? row.invoices / row.requests : 0,
    })),
    heatTable: Array.from(heat.values()).map((row) => ({
      ...row,
      conversion: row.requests ? row.invoices / row.requests : 0,
    })),
  });
}

export async function rraRecordRoute(request: Request, gqId: string) {
  const auth = await requireAnyRole(request, ["rra", "RRA_AGENT", "admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  const record = await prisma.globalQr.findUnique({ where: { gqId } });

  if (!record) {
    return jsonErr("Record not found", 404);
  }

  const decrypt = new URL(request.url).searchParams.get("decrypt") === "1";
  let phone = "***";

  if (decrypt && auth.user.role === "RRA_AGENT") {
    phone = decryptPhone(record.buyerPhoneEnc);
    await writeAudit({
      actor: auth.user.sub,
      role: String(auth.user.role),
      action: "RRA_DECRYPT_PHONE",
      entity: "GlobalQr",
      entityId: gqId,
    });
  } else {
    phone = maskPhone(decryptPhone(record.buyerPhoneEnc));
  }

  const { buyerPhoneEnc, ...safeRecord } = record;
  void buyerPhoneEnc;
  return jsonOk({ ...safeRecord, phone });
}

export async function rraBatchGetRoute(request: Request) {
  const auth = await requireAnyRole(request, ["rra", "RRA_AGENT", "admin", "GQ_ADMIN"]);
  if (auth.response) return auth.response;
  return jsonOk(await prisma.batchRun.findMany({ orderBy: { ts: "desc" } }));
}

export async function rraEvasionReportsRoute(request: Request) {
  const auth = await requireAnyRole(request, ["rra", "RRA_AGENT", "admin", "GQ_ADMIN"]);
  if (auth.response) return auth.response;
  return jsonOk(await prisma.evasionReport.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function createEvasionReportRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.sellerTin !== "string" || typeof body.phone !== "string") {
    return jsonErr("sellerTin and phone are required", 400);
  }

  const report = await prisma.evasionReport.create({
    data: {
      reportId: generateReportId(),
      sellerTin: body.sellerTin,
      phoneEnc: encryptPhone(body.phone),
      note: typeof body.note === "string" ? body.note : undefined,
      gqId: typeof body.gqId === "string" ? body.gqId : undefined,
      evidenceUrl: typeof body.evidenceUrl === "string" ? body.evidenceUrl : undefined,
    },
  });

  return jsonOk({ reportId: report.reportId, status: report.status });
}

export async function healthRoute() {
  await prisma.$queryRaw`SELECT 1`;
  return jsonOk({ status: "ok", ts: new Date().toISOString() });
}

export async function statusRoute() {
  const grouped = await prisma.globalQr.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const counts = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0]));

  for (const row of grouped) {
    counts[row.status] = row._count.status;
  }

  return jsonOk({ queues: counts });
}

export async function simulateScanRoute(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonErr("Not available in production", 404);
  }

  let move = await prisma.move.findFirst({ orderBy: { ts: "desc" } });

  if (!move) {
    const seller = await prisma.seller.findFirst();
    const mrc = await prisma.mrc.findFirst({ where: seller ? { tin: seller.tin } : undefined });

    if (!seller) {
      return jsonErr("Seed data required", 400);
    }

    move = await prisma.move.create({
      data: {
        moveId: `MOV-SIM-${Date.now()}`,
        vendorId: seller.vendorId ?? "VND-SIM",
        tin: seller.tin,
        mrc: mrc?.mrc,
        moveType: "ORDER",
        docRef: `SIM-${Date.now()}`,
        items: JSON.stringify([{ name: "Demo item", qty: 1, price: 1000 }]),
        amount: 1000,
        ts: new Date(),
      },
    });
  }

  const code = "123456";
  await prisma.otpSession.create({
    data: {
      id: generateOtpSessionId(),
      phone: "+250788000001",
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: true,
    },
  });

  const fakeRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: move.docRef,
      phone: "+250788000001",
      channel: "QR",
      geo: "-1.9441,30.0619",
    }),
  });

  return createRequestRoute(fakeRequest);
}

export async function listRouteFiles() {
  return [];
}
