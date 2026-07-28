import type { GlobalQr, Prisma } from "@prisma/client";
import { encryptPhone, hashPhone } from "./crypto";
import { signGqRequest } from "./gq-sign";
import { effectiveCitizenStatus } from "./gq-status";
import { nextGqId } from "./ids";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";
import { fireVendorWebhook } from "./vendor-webhook";

function dec(value: Prisma.Decimal | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

export function dbPublicRequestView(row: GlobalQr) {
  const displayStatus = effectiveCitizenStatus(row.status, row.vsdcSignature, row.vsdcInternalData);
  return {
    gqId: row.gqId,
    payloadId: row.payloadId,
    status: displayStatus,
    rawStatus: row.status,
    tin: row.tin,
    tinSeller: row.tinSeller ?? row.tin,
    tinBuyer: row.tinBuyer,
    mrc: row.mrc,
    docId: row.docId,
    docRef: row.docRef ?? row.docId,
    amount: dec(row.amount),
    declaredAmount: dec(row.declaredAmount),
    vat: null as number | null,
    channel: row.channel,
    scanTs: row.scanTs.toISOString(),
    time: row.scanTs.toISOString(),
    gps: row.geo,
    timezone: row.timezone,
    decision: row.decision,
    processingNote: row.processingNote,
    vendorId: row.vendorId,
    deliveredVia: row.deliveredVia,
    deliveredTs: row.deliveredTs?.toISOString() ?? null,
    invoicePdfUrl: row.invoicePdfUrl,
    sdcNumber: row.sdcNumber,
    paymentSms: row.paymentSms ? "[provided]" : null,
    bank: row.bank,
    bankTxnId: row.bankTxnId,
    bankAmount: dec(row.bankAmount),
    gqPayload: row.gqPayload,
    gqRequestSignature: row.gqRequestSignature,
    vsdcSignature: row.vsdcSignature,
    vsdcInternalData: row.vsdcInternalData,
  };
}

export function dbInvoiceView(row: GlobalQr) {
  return {
    gqId: row.gqId,
    status: row.status,
    sdcNumber: row.sdcNumber,
    rraResponse: row.rraResponse,
    invoicePdfUrl: row.invoicePdfUrl,
    invoiceOriginal: row.invoiceOriginal ? JSON.parse(row.invoiceOriginal) : null,
    deliveredVia: row.deliveredVia,
    deliveredTs: row.deliveredTs?.toISOString() ?? null,
    processingNote: row.processingNote,
    amount: dec(row.amount),
    tinSeller: row.tinSeller ?? row.tin,
    tinBuyer: row.tinBuyer,
    docId: row.docId,
    mrc: row.mrc,
    gqRequestSignature: row.gqRequestSignature,
    vsdcSignature: row.vsdcSignature,
    vsdcInternalData: row.vsdcInternalData,
  };
}

export async function dbGetRequest(gqId: string) {
  return prisma.globalQr.findUnique({ where: { gqId } });
}

export async function dbListRequestsForTin(tin: string) {
  return prisma.globalQr.findMany({
    where: { OR: [{ tin }, { tinSeller: tin }] },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function dbListRequestsForPhoneHash(phoneHash: string) {
  return prisma.globalQr.findMany({
    where: { buyerPhoneHash: phoneHash },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function dbCreateRequest(input: {
  phone: string;
  tin: string;
  mrc?: string | null;
  docId?: string | null;
  docRef?: string | null;
  moveId?: string | null;
  amount?: number | null;
  items?: string | null;
  type?: string;
  vendorId?: string | null;
  channel?: string;
  geo?: string | null;
  timezone?: string | null;
  tinBuyer?: string | null;
  declaredAmount?: number | null;
  paymentSms?: string | null;
  bank?: string | null;
  bankTxnId?: string | null;
  bankAmount?: number | null;
  payload?: string | null;
}) {
  const phoneHash = hashPhone(input.phone);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const dup = await prisma.globalQr.findFirst({
    where: {
      tin: input.tin,
      mrc: input.mrc ?? null,
      docId: input.docId ?? null,
      buyerPhoneHash: phoneHash,
      createdAt: { gte: fiveMinAgo },
    },
  });
  if (dup) return dup;

  const mrcRow = input.mrc
    ? await prisma.mrc.findUnique({ where: { mrc: input.mrc } })
    : null;
  const hasVendor = Boolean(input.vendorId ?? mrcRow?.vendorId);
  const status = hasVendor ? "GENERATING" : "STANDBY";
  const decision = hasVendor ? "ROUTED_TO_VENDOR" : "NO_VENDOR";
  const gqId = await nextGqId();
  const scanTs = new Date();
  const channel = input.channel ?? "QR";
  const gqRequestSignature = signGqRequest({
    gqId,
    tin: input.tin,
    mrc: input.mrc,
    amount: input.amount,
    declaredAmount: input.declaredAmount,
    phoneHash,
    scanTs,
    channel,
    payload: input.payload,
  });

  const row = await prisma.globalQr.create({
    data: {
      gqId,
      payloadId: gqId,
      requestType: input.type ?? "ORDER",
      tin: input.tin,
      tinSeller: input.tin,
      tinBuyer: input.tinBuyer ?? null,
      mrc: input.mrc ?? null,
      docRef: input.docRef ?? input.docId ?? null,
      docId: input.docId ?? null,
      moveId: input.moveId ?? null,
      vendorId: input.vendorId ?? mrcRow?.vendorId ?? null,
      amount: input.amount ?? null,
      declaredAmount: input.declaredAmount ?? null,
      items: input.items ?? null,
      channel,
      buyerPhoneEnc: encryptPhone(input.phone),
      buyerPhoneHash: phoneHash,
      geo: input.geo ?? null,
      timezone: input.timezone ?? "Africa/Kigali",
      bank: input.bank ?? null,
      bankTxnId: input.bankTxnId ?? null,
      bankAmount: input.bankAmount ?? null,
      paymentSms: input.paymentSms ?? null,
      scanTs,
      gqPayload: input.payload ?? null,
      gqRequestSignature,
      status,
      decision,
      decisionBy: "system",
      decisionTs: new Date(),
      processingNote: hasVendor ? "Queued for VSDC" : "No software - seller self-issue",
    },
  });

  await writeAudit({
    actor: input.phone,
    role: "citizen",
    action: "GLOBAL_QR_CREATE",
    entity: "GlobalQr",
    entityId: gqId,
    after: { status, decision, gqRequestSignature },
  });

  if (status === "GENERATING") {
    void fireVendorWebhook(gqId);
  }

  return row;
}

export async function dbStartProcessing(gqId: string, actor: string) {
  const row = await prisma.globalQr.findUnique({ where: { gqId } });
  if (!row) throw new Error("Request not found");
  if (row.status !== "QUEUEING" && row.status !== "GENERATING" && row.status !== "STANDBY") {
    throw new Error(`Cannot process from ${row.status}`);
  }

  const updated = await prisma.globalQr.update({
    where: { gqId },
    data: {
      status: "GENERATING",
      decision: "UNDER_PROCESSING",
      decisionBy: actor,
      decisionTs: new Date(),
      processingNote: "Under processing on Ishyiga / vendor VSDC",
    },
  });

  await writeAudit({
    actor,
    role: "seller",
    action: "UNDER_PROCESSING",
    entity: "GlobalQr",
    entityId: gqId,
    after: { status: updated.status, decision: updated.decision },
  });

  return updated;
}

export async function dbAvailInvoice(
  gqId: string,
  input: {
    sdcNumber: string;
    actor: string;
    role?: string;
    invoiceOriginal?: unknown;
    vsdcSignature?: string | null;
    vsdcInternalData?: string | null;
  },
) {
  const row = await prisma.globalQr.findUnique({ where: { gqId } });
  if (!row) throw new Error("Request not found");
  if (row.status === "DONE") return row;

  const invoiceOriginal =
    typeof input.invoiceOriginal === "string"
      ? input.invoiceOriginal
      : JSON.stringify(
          input.invoiceOriginal ?? {
            sdcNumber: input.sdcNumber,
            tin: row.tinSeller ?? row.tin,
            buyerTin: row.tinBuyer,
            amount: dec(row.amount),
            docId: row.docId,
            mrc: row.mrc,
            issuedAt: new Date().toISOString(),
          },
        );

  const vsdcSignature = input.vsdcSignature?.trim() || null;
  const vsdcInternalData = input.vsdcInternalData?.trim() || null;
  const hasVsdcStamp = Boolean(vsdcSignature && vsdcInternalData);

  const updated = await prisma.globalQr.update({
    where: { gqId },
    data: {
      status: hasVsdcStamp ? "DONE" : "GENERATING",
      decision: hasVsdcStamp ? "RRA_ACCEPTED" : "UNDER_PROCESSING",
      decisionBy: input.actor,
      decisionTs: new Date(),
      sdcNumber: input.sdcNumber,
      vsdcSignature,
      vsdcInternalData,
      rraResponse: JSON.stringify({
        accepted: hasVsdcStamp,
        sdcNumber: input.sdcNumber,
        signature: vsdcSignature,
        internalData: vsdcInternalData,
      }),
      invoiceOriginal: hasVsdcStamp ? invoiceOriginal : row.invoiceOriginal,
      invoicePdfUrl: hasVsdcStamp ? `/i/${gqId}` : row.invoicePdfUrl,
      deliveredVia: hasVsdcStamp ? "PULL" : row.deliveredVia,
      deliveredTs: hasVsdcStamp ? new Date() : row.deliveredTs,
      processingNote: hasVsdcStamp
        ? "EBM available for buyer pull"
        : "Awaiting VSDC receipt signature from Ishyiga — still GENERATING",
    },
  });

  await writeAudit({
    actor: input.actor,
    role: input.role ?? "seller",
    action: hasVsdcStamp ? "INVOICE_AVAIL" : "VSDC_PENDING",
    entity: "GlobalQr",
    entityId: gqId,
    after: {
      sdcNumber: input.sdcNumber,
      vsdcSignature,
      vsdcInternalData,
      status: updated.status,
    },
  });

  return updated;
}

export async function dbPing() {
  await prisma.$queryRaw`SELECT 1 AS ok`;
}
