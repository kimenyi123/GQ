import { customAlphabet, nanoid } from "nanoid";
import { prisma } from "./prisma";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const upperId = customAlphabet(alphabet, 10);

export async function nextGqId() {
  const latest = await prisma.globalQr.findFirst({
    orderBy: { gqId: "desc" },
    select: { gqId: true },
    where: { gqId: { startsWith: "GQ-" } },
  });
  const lastNumber = latest?.gqId.match(/^GQ-(\d+)$/)?.[1];
  const next = lastNumber ? Number(lastNumber) + 1 : 1;

  return `GQ-${String(next).padStart(6, "0")}`;
}

export function nextMrc() {
  return `MRC-${upperId(6)}`;
}

export function generateMoveId() {
  return `MOV-${upperId(12)}`;
}

export function generateReportId() {
  return `REP-${upperId(10)}`;
}

export function generatePaymentTxnId() {
  return `PAY-${upperId(12)}`;
}

export function generateBatchRunId() {
  return `BAT-${upperId(10)}`;
}

export function generateOtpSessionId() {
  return `OTP-${upperId(10)}`;
}

export function generateUserId() {
  return `USR-${upperId(10)}`;
}

export function generateAuditId() {
  return `AUD-${nanoid(16)}`;
}

export function generateOAuthClientId() {
  return `gq_${nanoid(24)}`;
}

export function generateOAuthClientSecret() {
  return `gqs_${nanoid(40)}`;
}
