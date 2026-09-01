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
import { encryptPhone, decryptPhone, hashPhone } from "./crypto";
import { mockSms } from "./delivery";
import { completeInvoice } from "./invoice-service";
import {
  generateOtpSessionId,
  generateReportId,
  nextGqId,
  nextMrc,
} from "./ids";
import { prisma } from "./prisma";
import { DEMO_OTP_CODE, isDemoOtpCode, isOpenLoginEnabled, normalizeRwandaPhone } from "./demo-auth";
import {
  buildDynamicPayload,
  buildGq3ScanUrl,
  buildMomoPayload,
  buildStaticPayload,
  parseQrPayload,
} from "./qr";
import { maskPhone, parseDateParam, readJson, readRawJson, verifyOptionalHmac } from "./request-utils";
import { transitionGlobalQr } from "./state-machine";
import { fireVendorWebhook } from "./vendor-webhook";
import { writeAudit } from "./audit";
import { isDatabaseConfigured, isDatabaseReady } from "./db-ready";
import {
  ensureMemorySeed,
  getMemoryDb,
  memAvailInvoice,
  memCreateRequest,
  memFindUserByPhone,
  memFindUserByRole,
  memFindVendorByClientId,
  memGetRequest,
  memHasRecentVerifiedOtp,
  memInvoiceView,
  memIssueOtp,
  memListMrcsForTin,
  memListRequestsForPhoneHash,
  memListRequestsForTin,
  memPublicRequestView,
  memResolveFromDocId,
  memResolveFromPayload,
  memStartProcessing,
  memVerifyOtp,
} from "./memory-db";
import { PILOT_PASSWORD, PILOT_SELLERS } from "./pilot-catalog";
import {
  dbAvailInvoice,
  dbCreateRequest,
  dbGetRequest,
  dbInvoiceView,
  dbListRequestsForPhoneHash,
  dbListRequestsForTin,
  dbPublicRequestView,
  dbStartProcessing,
} from "./gq-repository";

const REQUEST_STATUSES = ["QUEUEING", "GENERATING", "STANDBY", "ADJUST", "DONE", "REFUNDED", "FAILED"];

function isValidSdcNumber(value: unknown) {
  return typeof value === "string" && /^[a-z0-9]{8,}$/i.test(value);
}

async function requireOtpOrCitizen(request: Request, phone: string) {
  const normalized = normalizeRwandaPhone(phone);
  const bearer = await readBearerUser(request);

  if (bearer?.role === "citizen" && normalizeRwandaPhone(String(bearer.sub)) === normalized) {
    return true;
  }

  if (await memHasRecentVerifiedOtp(normalized)) {
    return true;
  }

  if (!(await isDatabaseReady())) {
    return false;
  }

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const latest = await prisma.otpSession.findFirst({
      where: {
        phone: normalized,
        verified: true,
        createdAt: { gte: tenMinutesAgo },
      },
      orderBy: { createdAt: "desc" },
    });
    return Boolean(latest);
  } catch {
    return false;
  }
}

async function resolveRequestInput(body: Record<string, unknown>) {
  await ensureMemorySeed();

  if (typeof body.payload === "string") {
    const parsed = parseQrPayload(body.payload);
    const mem = memResolveFromPayload({
      version: parsed.version,
      tin: parsed.tin,
      mrc: parsed.mrc,
      docRef: parsed.version === "GQ2" ? parsed.docRef : undefined,
      docId: parsed.version === "GQ2" ? parsed.docRef : undefined,
      momoCode: parsed.version === "GQ3" ? parsed.momoCode : undefined,
      name: parsed.version === "GQ3" ? parsed.name : undefined,
    });

    if (mem.moveId || mem.mrc) {
      return {
        tin: mem.tin,
        mrc: mem.mrc,
        docRef: mem.docId,
        docId: mem.docId,
        amount: mem.amount ?? undefined,
        items: mem.items ?? undefined,
        moveId: mem.moveId,
        vendorId: mem.vendorId,
        type: mem.type,
        momoCode: mem.momoCode ?? undefined,
        merchantName: mem.merchantName ?? undefined,
      };
    }

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
      docId: parsed.version === "GQ2" ? parsed.docRef : move?.docRef,
      amount: move?.amount,
      items: move?.items,
      moveId: move?.moveId,
      vendorId: null as string | null,
      type: move?.moveType,
    };
  }

  if (typeof body.code === "string") {
    const mem = memResolveFromDocId(body.code);
    if (mem) {
      return {
        tin: mem.tin,
        mrc: mem.mrc,
        docRef: mem.docId,
        docId: mem.docId,
        amount: mem.amount,
        items: mem.items,
        moveId: mem.moveId,
        vendorId: mem.vendorId,
        type: mem.type,
      };
    }

    const move = await prisma.move.findFirst({ where: { docRef: body.code } });

    if (!move) {
      throw new Error("Code not found");
    }

    return {
      tin: move.tin,
      mrc: move.mrc ?? undefined,
      docRef: move.docRef,
      docId: move.docRef,
      amount: move.amount,
      items: move.items,
      moveId: move.moveId,
      vendorId: null as string | null,
      type: move.moveType,
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
  const phoneHash = hashPhone(input.phone);
  return prisma.globalQr.findFirst({
    where: {
      tin: input.tin,
      mrc: input.mrc ?? null,
      docRef: input.docRef ?? null,
      buyerPhoneHash: phoneHash,
      createdAt: { gte: fiveMinutesAgo },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function issueOtpRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.phone !== "string") {
    return jsonErr("phone is required", 400);
  }

  const phone = normalizeRwandaPhone(body.phone);
  const { code, expiresIn } = await memIssueOtp(phone);
  try {
    await prisma.otpSession.create({
      data: {
        id: generateOtpSessionId(),
        phone,
        codeHash: await hashOtp(code),
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });
  } catch {
    /* in-memory pilot may run without DB */
  }
  mockSms(phone, `Your Global QR code is ${code}`);

  return jsonOk({ expiresIn, debugCode: isOpenLoginEnabled() ? code : undefined, pilot: isOpenLoginEnabled() });
}

export async function verifyOtpRoute(request: Request) {
  const body = await readJson(request);

  if (!body || typeof body.phone !== "string" || typeof body.code !== "string") {
    return jsonErr("phone and code are required", 400);
  }

  const phone = normalizeRwandaPhone(body.phone);

  if (isDemoOtpCode(body.code)) {
    await memVerifyOtp(phone, body.code);
    const token = await issueJwt({ sub: phone, role: "citizen" });
    return jsonOk({ token, role: "citizen", pilot: true });
  }

  const ok = await memVerifyOtp(phone, body.code);
  if (!ok) {
    try {
      const session = await prisma.otpSession.findFirst({
        where: {
          phone,
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
    } catch {
      return jsonErr("Invalid or expired OTP", 400);
    }
  }

  const token = await issueJwt({ sub: phone, role: "citizen" });
  return jsonOk({ token, role: "citizen" });
}

export async function createRequestRoute(request: Request) {
  try {
    const body = await readJson(request);

    if (!body || typeof body.phone !== "string") {
      return jsonErr("phone is required", 400);
    }

    const phone = normalizeRwandaPhone(body.phone);

    if (!(await requireOtpOrCitizen(request, phone))) {
      return jsonErr("Recent verified OTP or citizen token required", 401);
    }

    let resolved: Awaited<ReturnType<typeof resolveRequestInput>>;

    try {
      resolved = await resolveRequestInput(body);
    } catch (error) {
      return jsonErr(error instanceof Error ? error.message : "Invalid request", 400);
    }

    const declaredRaw = body.declaredAmount ?? body.myAmount;
    const declaredAmount =
      typeof declaredRaw === "number"
        ? declaredRaw
        : typeof declaredRaw === "string"
          ? Number(declaredRaw)
          : null;

    const itemsOverride =
      typeof body.items === "string" ? body.items : (resolved.items ?? null);

    const input = {
      phone,
      tin: resolved.tin,
      mrc: resolved.mrc,
      docId: resolved.docId ?? resolved.docRef,
      docRef: resolved.docRef ?? resolved.docId,
      moveId: resolved.moveId,
      amount:
        typeof resolved.amount === "number"
          ? resolved.amount
          : Number.isFinite(declaredAmount as number)
            ? (declaredAmount as number)
            : null,
      items: itemsOverride,
      type: resolved.type,
      vendorId: resolved.vendorId,
      channel: typeof body.channel === "string" ? body.channel : "QR",
      geo: typeof body.geo === "string" ? body.geo : null,
      timezone: typeof body.timezone === "string" ? body.timezone : "Africa/Kigali",
      tinBuyer:
        typeof body.buyerTin === "string"
          ? body.buyerTin
          : typeof body.tinBuyer === "string"
            ? body.tinBuyer
            : null,
      declaredAmount: Number.isFinite(declaredAmount as number) ? (declaredAmount as number) : null,
      paymentSms: typeof body.paymentSms === "string" ? body.paymentSms : null,
      bank: resolved.type === "MOMO" ? "MOMO" : typeof body.bank === "string" ? body.bank : null,
      bankTxnId:
        typeof body.bankTxnId === "string"
          ? body.bankTxnId
          : typeof body.momoTxnId === "string"
            ? body.momoTxnId
            : null,
      bankAmount: typeof body.bankAmount === "number" ? body.bankAmount : null,
      payload: typeof body.payload === "string" ? body.payload : null,
    };

    if (await isDatabaseReady()) {
      try {
        const created = await dbCreateRequest(input);
        return jsonOk({
          gqId: created.gqId,
          status: created.status,
          decision: created.decision,
          processingNote: created.processingNote,
          gqRequestSignature: created.gqRequestSignature,
          eta: "24h",
          storage: "database",
        });
      } catch (error) {
        console.error("[DB_CREATE_FAILED]", error);
        const message = error instanceof Error ? error.message : "Database insert failed";
        return jsonErr(`Database insert failed: ${message}`, 503);
      }
    }

    if (isDatabaseConfigured()) {
      return jsonErr(
        "Database is configured but not connected — check DATABASE_URL password and restart the server",
        503,
      );
    }

    await ensureMemorySeed();
    const created = await memCreateRequest(input);
    return jsonOk({
      gqId: created.gqId,
      status: created.status,
      decision: created.decision,
      processingNote: created.processingNote,
      gqRequestSignature: created.gqRequestSignature,
      eta: "24h",
      storage: "memory",
    });
  } catch (error) {
    console.error("[CREATE_REQUEST_FAILED]", error);
    return jsonErr(error instanceof Error ? error.message : "Saba failed", 500);
  }
}

export async function listMyRequestsRoute(request: Request) {
  const user = await readBearerUser(request);

  if (!user || user.role !== "citizen" || !user.sub) {
    return jsonErr("Citizen token required", 401);
  }

  const phoneHash = hashPhone(normalizeRwandaPhone(String(user.sub)));
  if (await isDatabaseReady()) {
    try {
      const rows = await dbListRequestsForPhoneHash(phoneHash);
      return jsonOk(rows.map(dbPublicRequestView));
    } catch {
      /* memory fallback */
    }
  }
  await ensureMemorySeed();
  return jsonOk(memListRequestsForPhoneHash(phoneHash).map(memPublicRequestView));
}

export async function getRequestRoute(request: Request, gqId: string) {
  let record = null as Awaited<ReturnType<typeof dbGetRequest>>;
  let mem = null as ReturnType<typeof memGetRequest>;

  if (await isDatabaseReady()) {
    try {
      record = await dbGetRequest(gqId);
    } catch {
      record = null;
    }
  }
  if (!record) {
    await ensureMemorySeed();
    mem = memGetRequest(gqId);
    if (!mem) return jsonErr("Request not found", 404);
  }

  const user = await readBearerUser(request);

  if (!user) {
    try {
      const phone = record ? decryptPhone(record.buyerPhoneEnc) : decryptPhone(mem!.phoneEnc);
      if (!(await requireOtpOrCitizen(request, phone))) {
        return jsonErr("Unauthorized", 401);
      }
    } catch {
      return jsonErr("Unauthorized", 401);
    }
  }

  let timeline: { action: string; role: string; ts: Date | string; after: string | null }[] = [];
  if (record && (await isDatabaseReady())) {
    try {
      timeline = await prisma.auditLog.findMany({
        where: { entity: "GlobalQr", entityId: gqId },
        orderBy: { ts: "asc" },
        select: { action: true, role: true, ts: true, after: true },
      });
    } catch {
      timeline = [];
    }
  } else if (mem) {
    timeline = getMemoryDb()
      .audits.filter((a) => a.entity === "GlobalQr" && a.entityId === gqId)
      .map((a) => ({ action: a.action, role: a.role, ts: a.ts, after: a.after }));
  }

  if (record) {
    return jsonOk({ ...dbPublicRequestView(record), timeline });
  }
  return jsonOk({ ...memPublicRequestView(mem!), timeline });
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
  await ensureMemorySeed();
  const mem = memResolveFromDocId(code);
  if (mem) {
    return jsonOk({
      sellerName: mem.sellerName,
      tin: mem.tin,
      amount: mem.amount,
      vat: mem.vat,
      docRef: mem.docId,
      docId: mem.docId,
      mrc: mem.mrc,
      type: mem.type,
    });
  }

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

  if (await isDatabaseReady()) {
    try {
      const record = await dbGetRequest(gqId);
      if (record) return jsonOk(dbInvoiceView(record));
    } catch {
      /* memory fallback */
    }
  }

  await ensureMemorySeed();
  const mem = memGetRequest(gqId);
  if (!mem) return jsonErr("Invoice not found", 404);
  return jsonOk(memInvoiceView(mem));
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

  if (await isDatabaseReady()) {
    try {
      const records = await dbListRequestsForTin(tin);
      return jsonOk(records.map(dbPublicRequestView));
    } catch {
      /* memory fallback */
    }
  }

  await ensureMemorySeed();
  return jsonOk(memListRequestsForTin(tin).map(memPublicRequestView));
}

export async function sellerMrcRoute(request: Request, tin: string) {
  const auth = await requireSellerForTin(request, tin);

  if (auth.response) {
    return auth.response;
  }

  await ensureMemorySeed();
  const memMrcs = memListMrcsForTin(tin);
  if (memMrcs.length) {
    return jsonOk(memMrcs);
  }

  return jsonOk(await prisma.mrc.findMany({ where: { tin }, orderBy: { issuedAt: "desc" } }));
}

export async function processRequestRoute(request: Request, gqId: string) {
  const auth = await requireAnyRole(request, ["seller", "admin", "GQ_ADMIN", "vendor"]);
  if (auth.response) return auth.response;

  await ensureMemorySeed();
  let existing = null as Awaited<ReturnType<typeof dbGetRequest>>;
  if (await isDatabaseReady()) {
    try {
      existing = await dbGetRequest(gqId);
    } catch {
      existing = null;
    }
  }
  const mem = existing ? null : memGetRequest(gqId);
  if (!existing && !mem) return jsonErr("Request not found", 404);

  const sellerTin = existing
    ? (existing.tinSeller ?? existing.tin)
    : (mem!.tinSeller ?? mem!.tin);
  if (auth.user.role === "seller" && auth.user.tin && auth.user.tin !== sellerTin) {
    return jsonErr("Forbidden", 403);
  }

  try {
    if (existing && (await isDatabaseReady())) {
      const row = await dbStartProcessing(gqId, String(auth.user.sub));
      return jsonOk({
        ...dbPublicRequestView(row),
        message: "Under processing on Ishyiga / vendor VSDC",
      });
    }
    const row = memStartProcessing(gqId, String(auth.user.sub));
    return jsonOk({
      ...memPublicRequestView(row),
      message: "Under processing on Ishyiga / vendor VSDC",
    });
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Process failed", 400);
  }
}

export async function availInvoiceRoute(request: Request, gqId: string) {
  const body = await readJson(request);
  const auth = await requireAnyRole(request, ["seller", "admin", "GQ_ADMIN", "vendor"]);
  if (auth.response) return auth.response;

  await ensureMemorySeed();
  let existing = null as Awaited<ReturnType<typeof dbGetRequest>>;
  if (await isDatabaseReady()) {
    try {
      existing = await dbGetRequest(gqId);
    } catch {
      existing = null;
    }
  }
  const mem = existing ? null : memGetRequest(gqId);
  if (!existing && !mem) return jsonErr("Request not found", 404);

  const sellerTin = existing
    ? (existing.tinSeller ?? existing.tin)
    : (mem!.tinSeller ?? mem!.tin);
  if (auth.user.role === "seller" && auth.user.tin && auth.user.tin !== sellerTin) {
    return jsonErr("Forbidden", 403);
  }

  const sdcNumber =
    typeof body?.sdcNumber === "string" && body.sdcNumber
      ? body.sdcNumber
      : `SDC-ISH-${Date.now().toString(36).toUpperCase()}`;
  const vsdcSignature =
    typeof body?.vsdcSignature === "string"
      ? body.vsdcSignature
      : typeof body?.signature === "string"
        ? body.signature
        : null;
  const vsdcInternalData =
    typeof body?.vsdcInternalData === "string"
      ? body.vsdcInternalData
      : typeof body?.internalData === "string"
        ? body.internalData
        : null;

  try {
    if (existing && (await isDatabaseReady())) {
      const row = await dbAvailInvoice(gqId, {
        sdcNumber,
        actor: String(auth.user.sub),
        role: String(auth.user.role),
        invoiceOriginal: body?.invoiceOriginal,
        vsdcSignature,
        vsdcInternalData,
      });
      return jsonOk(dbInvoiceView(row));
    }
    const row = memAvailInvoice(gqId, {
      sdcNumber,
      actor: String(auth.user.sub),
      role: String(auth.user.role),
      invoiceOriginal: body?.invoiceOriginal,
      vsdcSignature,
      vsdcInternalData,
    });
    return jsonOk(memInvoiceView(row));
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Avail failed", 400);
  }
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

  await ensureMemorySeed();

  if (body.grant_type === "client_credentials") {
    if (typeof body.client_id !== "string" || typeof body.client_secret !== "string") {
      return jsonErr("client_id and client_secret are required", 400);
    }

    const memVendor = memFindVendorByClientId(body.client_id);
    if (memVendor?.oauthClientSecretHash && (await verifyOAuthClientSecret(body.client_secret, memVendor.oauthClientSecretHash))) {
      return jsonOk({
        token: await issueVendorJwt(memVendor.vendorId),
        role: "vendor",
        vendorId: memVendor.vendorId,
      });
    }

    const vendor = await prisma.vendor.findFirst({ where: { oauthClientId: body.client_id } });

    if (!vendor?.oauthClientSecretHash || !(await verifyOAuthClientSecret(body.client_secret, vendor.oauthClientSecretHash))) {
      return jsonErr("Invalid client credentials", 401);
    }

    return jsonOk({ token: await issueVendorJwt(vendor.vendorId), role: "vendor", vendorId: vendor.vendorId });
  }

  if (body.grant_type === "password") {
    if (typeof body.password !== "string") {
      return jsonErr("Invalid credentials", 401);
    }

    const memUser =
      typeof body.phone === "string"
        ? memFindUserByPhone(body.phone)
        : Array.from(getMemoryDb().users.values()).find((u) => u.email === body.email) ?? null;

    if (memUser?.passwordHash && (await bcrypt.compare(body.password, memUser.passwordHash))) {
      const token = await issueJwt({
        sub: memUser.id,
        role: memUser.role,
        tin: memUser.tin ?? undefined,
        vendorId: memUser.vendorId ?? undefined,
      });
      return jsonOk({
        token,
        role: memUser.role,
        tin: memUser.tin,
        vendorId: memUser.vendorId,
        name: memUser.name,
      });
    }

    const login = typeof body.phone === "string" ? { phone: body.phone } : { email: String(body.email ?? "") };
    const user = await prisma.user.findFirst({ where: login });

    if (!user?.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
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
    const memUser = memFindUserByRole(body.role);
    const user = memUser ?? (await prisma.user.findFirst({ where: { role: body.role } }));
    const token = await issueJwt({
      sub: user?.id ?? `demo-${body.role}`,
      role: body.role,
      tin: user && "tin" in user ? user.tin ?? undefined : undefined,
      vendorId: user && "vendorId" in user ? user.vendorId ?? undefined : undefined,
    });

    return jsonOk({
      token,
      role: body.role,
      tin: user && "tin" in user ? user.tin : undefined,
      vendorId: user && "vendorId" in user ? user.vendorId : undefined,
    });
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
  const configured = isDatabaseConfigured();
  const ready = configured ? await isDatabaseReady() : false;
  if (ready) {
    return jsonOk({
      status: "ok",
      database: "connected",
      configured: true,
      storage: "database",
      ts: new Date().toISOString(),
    });
  }
  return jsonOk({
    status: "ok",
    database: configured ? "configured-not-connected" : "not-configured",
    configured,
    storage: configured ? "none" : "memory-fallback",
    hint: configured
      ? "DATABASE_URL is set but Prisma cannot connect — check password, firewall, and restart"
      : "Set DATABASE_URL password in .env (replace YOUR_PASSWORD) for EBM_RW persistence",
    ts: new Date().toISOString(),
  });
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

export async function listTestQrsRoute() {
  if (process.env.NODE_ENV === "production") {
    return jsonErr("Not available in production", 404);
  }

  const db = await ensureMemorySeed();
  const now = new Date().toISOString();

  const cards = db.catalog.map((s) => {
    const gq3Text =
      s.qrKind === "GQ3"
        ? buildMomoPayload({
            tin: s.tin,
            mrc: s.mrc,
            momoCode: s.momoCode ?? "",
            name: s.merchantName ?? s.business,
          })
        : undefined;

    const payload =
      s.qrKind === "GQ1"
        ? buildStaticPayload({ tin: s.tin, mrc: s.mrc, issuedTs: now })
        : gq3Text
          ? buildGq3ScanUrl(gq3Text)
          : buildDynamicPayload({
              tin: s.tin,
              mrc: s.mrc,
              txTs: now,
              docRef: s.docId,
            });

    return {
      ...s,
      payload,
      ...(gq3Text ? { gq3Payload: gq3Text } : {}),
      docLabel: s.docType.replace("_", " "),
      deviceLabel: s.device,
    };
  });

  const byBusiness = PILOT_SELLERS.map((seller) => {
    const rows = cards.filter((c) => c.tin === seller.tin);
    return {
      tin: seller.tin,
      name: seller.name,
      phone: seller.phone,
      password: PILOT_PASSWORD,
      vendorId: seller.vendorId,
      stack: rows[0]?.stack ?? "",
      tableCount: rows.filter((r) => r.device === "TABLE").length,
      desktopCount: rows.filter((r) => r.device === "DESKTOP" || r.device === "WINDOWS").length,
      mrcSample: rows[0]?.mrc,
      qrs: rows.length,
    };
  });

  return jsonOk({
    generatedAt: now,
    storage: "in-memory (resets on server restart)",
    mrcFormat: "VVVCCCXXXXXX — vendor3 + seller3 + device#",
    buyerInputs: {
      required: ["phone", "buyerTin if B2B"],
      optionalFastTreatment: ["myAmount / declaredAmount", "paymentSms (MoMo/Bank)"],
      autoOnScan: ["geo", "scanTs", "timezone"],
    },
    companies: byBusiness,
    scenarios: cards,
    counts: {
      total: cards.length,
      byDevice: {
        TABLE: cards.filter((c) => c.device === "TABLE").length,
        DESKTOP: cards.filter((c) => c.device === "DESKTOP").length,
        WINDOWS: cards.filter((c) => c.device === "WINDOWS").length,
        MOMO: cards.filter((c) => c.device === "MOMO").length,
      },
      byBusiness: Object.fromEntries(byBusiness.map((b) => [b.name, b.qrs])),
    },
  });
}

export async function listPilotSellersRoute() {
  await ensureMemorySeed();
  return jsonOk({
    password: PILOT_PASSWORD,
    sellers: PILOT_SELLERS.map((s) => ({
      tin: s.tin,
      name: s.name,
      phone: s.phone,
      vendorId: s.vendorId,
      sector: s.sector,
    })),
  });
}

export async function upsertDraftRoute(request: Request) {
  const { raw, body } = await readRawJson<Record<string, unknown>>(request);
  if (!body || !verifyOptionalHmac(request, raw)) {
    return jsonErr("Invalid body or HMAC", 401);
  }

  const docRef = String(body.docRef ?? "");
  const tin = String(body.tin ?? "");
  const mrc = String(body.mrc ?? "");
  if (!docRef || !tin || !mrc) {
    return jsonErr("docRef, tin and mrc are required", 400);
  }

  const { upsertDraft } = await import("./gq-drafts");
  const draft = await upsertDraft({
    docRef,
    tin,
    mrc,
    status: typeof body.status === "string" ? (body.status as "DRAFT") : "DRAFT",
    ijisho: typeof body.ijisho === "string" ? body.ijisho : null,
    buyerTin: typeof body.buyerTin === "string" ? body.buyerTin : null,
    buyerName: typeof body.buyerName === "string" ? body.buyerName : null,
    amount: typeof body.amount === "number" ? body.amount : null,
    tva: typeof body.tva === "number" ? body.tva : null,
    items: body.items,
    gqPayload: typeof body.gqPayload === "string" ? body.gqPayload : null,
    gqUrl: typeof body.gqUrl === "string" ? body.gqUrl : null,
    railCode: typeof body.railCode === "string" ? body.railCode : null,
    railTxnId: typeof body.railTxnId === "string" ? body.railTxnId : null,
    railAmount: typeof body.railAmount === "number" ? body.railAmount : null,
    railSource: typeof body.railSource === "string" ? body.railSource : null,
  });

  return jsonOk(draft);
}

export async function patchDraftStatusRoute(request: Request, docRef: string) {
  const { raw, body } = await readRawJson<Record<string, unknown>>(request);
  if (!body || !verifyOptionalHmac(request, raw)) {
    return jsonErr("Invalid body or HMAC", 401);
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!status) {
    return jsonErr("status is required", 400);
  }

  const { patchDraftStatus } = await import("./gq-drafts");
  try {
    const draft = await patchDraftStatus(docRef, {
      status: status as "DRAFT",
      gqPayload: typeof body.gqPayload === "string" ? body.gqPayload : undefined,
      gqUrl: typeof body.gqUrl === "string" ? body.gqUrl : undefined,
      railCode: typeof body.railCode === "string" ? body.railCode : undefined,
      railTxnId: typeof body.railTxnId === "string" ? body.railTxnId : undefined,
      railAmount: typeof body.railAmount === "number" ? body.railAmount : undefined,
      railSource: typeof body.railSource === "string" ? body.railSource : undefined,
    });
    return jsonOk(draft);
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Draft update failed", 404);
  }
}

export async function getDraftRoute(docRef: string) {
  const { getDraft } = await import("./gq-drafts");
  const draft = await getDraft(docRef);
  if (!draft) {
    return jsonErr("Draft not found", 404);
  }
  return jsonOk(draft);
}

export async function simulatorLanProxyRoute(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonErr("Not available in production", 404);
  }

  const url = new URL(request.url);
  const base = url.searchParams.get("base")?.replace(/\/+$/, "");
  const path = url.searchParams.get("path") ?? "/draft/current";
  const method = (url.searchParams.get("method") ?? "GET").toUpperCase();

  if (!base || !/^https?:\/\//i.test(base)) {
    return jsonErr("base query param must be http(s) ERP LAN URL", 400);
  }

  try {
    const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const init: RequestInit = { method, headers: { Accept: "application/json" } };
    if (method !== "GET" && method !== "HEAD") {
      const body = await request.text();
      init.body = body;
      init.headers = { ...init.headers, "Content-Type": "application/json" };
    }
    const res = await fetch(target, init);
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* plain text */
    }
    return jsonOk({ status: res.status, data });
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "LAN proxy failed", 502);
  }
}

export async function simulatorMakeEbmRoute(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonErr("Not available in production", 404);
  }

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonErr("Invalid JSON", 400);

  const docRef = String(body.docRef ?? "");
  const tin = String(body.tin ?? "");
  const mrc = String(body.mrc ?? "");
  const buyerPhone = normalizeRwandaPhone(String(body.buyerPhone ?? "+250788000001"));
  const buyerTin = typeof body.buyerTin === "string" ? body.buyerTin : "";
  const buyerName = typeof body.buyerName === "string" ? body.buyerName : "";
  const amount = Number(body.amount);
  const items = body.items;
  const gqPayload = typeof body.gqPayload === "string" ? body.gqPayload : null;
  const invoiceOriginal = typeof body.invoiceOriginal === "string" ? body.invoiceOriginal : null;
  const printOption = typeof body.printOption === "string" ? body.printOption : "EPSON";
  const promoText = typeof body.promoText === "string" ? body.promoText : "";
  const railCode = typeof body.railCode === "string" ? body.railCode : "";
  const railTxnId = typeof body.railTxnId === "string" ? body.railTxnId : "";
  const paidFrom = typeof body.paidFrom === "string" ? body.paidFrom : buyerPhone;
  const paidOn = typeof body.paidOn === "string" ? body.paidOn : "";
  const vsdcSignature = typeof body.vsdcSignature === "string" ? body.vsdcSignature : null;
  const vsdcInternalData = typeof body.vsdcInternalData === "string" ? body.vsdcInternalData : null;

  if (!docRef || !tin || !mrc || !Number.isFinite(amount)) {
    return jsonErr("docRef, tin, mrc and amount are required", 400);
  }
  if (!vsdcSignature || !vsdcInternalData) {
    return jsonErr("vsdcSignature (16) and vsdcInternalData (26) are required", 400);
  }

  const { patchDraftStatus, upsertDraft } = await import("./gq-drafts");

  await upsertDraft({
    docRef,
    tin,
    mrc,
    status: "PAID",
    buyerTin,
    buyerName,
    amount,
    items,
    gqPayload,
    railCode,
    railTxnId,
    railAmount: amount,
    railSource: "simulator",
  });

  await patchDraftStatus(docRef, {
    status: "STAMPED",
    railCode,
    railTxnId,
    railAmount: amount,
    railSource: "simulator",
  });

  try {
    await prisma.otpSession.create({
      data: {
        id: generateOtpSessionId(),
        phone: buyerPhone,
        codeHash: await hashOtp(DEMO_OTP_CODE),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        verified: true,
      },
    });
  } catch {
    /* ok if exists */
  }

  await ensureMemorySeed();
  const itemsJson =
    typeof items === "string" ? items : items != null ? JSON.stringify(items) : null;

  let row;
  if (await isDatabaseReady()) {
    try {
      row = await dbCreateRequest({
        phone: buyerPhone,
        tin,
        mrc,
        docRef,
        docId: docRef,
        amount,
        items: itemsJson,
        type: "ORDER",
        channel: "SIMULATOR",
        tinBuyer: buyerTin || null,
        bank: railCode || null,
        bankTxnId: railTxnId || null,
        bankAmount: amount,
        payload: gqPayload,
        paymentSms: promoText ? `PROMO:${promoText.slice(0, 120)}` : null,
      });
    } catch {
      row = null;
    }
  }

  if (!row) {
    const mem = await memCreateRequest({
      phone: buyerPhone,
      tin,
      mrc,
      docId: docRef,
      amount,
      items: itemsJson,
      type: "ORDER",
      channel: "SIMULATOR",
      tinBuyer: buyerTin || null,
      bank: railCode || null,
      bankTxnId: railTxnId || null,
      bankAmount: amount,
    });
    row = mem as unknown as { gqId: string; status: string };
  }

  const gqId = row.gqId;
  const sdcNumber = `SDC${Date.now().toString(36).toUpperCase().slice(-8)}`;

  try {
    if (await isDatabaseReady()) {
      await dbAvailInvoice(gqId, {
        sdcNumber,
        actor: "simulator",
        role: "vendor",
        invoiceOriginal,
        vsdcSignature,
        vsdcInternalData,
      });
    } else {
      memAvailInvoice(gqId, {
        sdcNumber,
        actor: "simulator",
        role: "vendor",
        invoiceOriginal,
        vsdcSignature,
        vsdcInternalData,
      });
    }
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Avail failed", 400);
  }

  return jsonOk({
    gqId,
    status: "DONE",
    sdcNumber,
    docRef,
    trackerUrl: `/r/${gqId}`,
    invoiceUrl: `/i/${gqId}`,
    receipt: invoiceOriginal,
    printOption,
    promoText,
    payment: { railCode, railTxnId, paidFrom, paidOn, amount },
  });
}

export async function listRouteFiles() {
  return [];
}
