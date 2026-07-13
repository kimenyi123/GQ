import { decryptPhone } from "./crypto";
import { markDelivered, mockSms } from "./delivery";
import { prisma } from "./prisma";
import { transitionGlobalQr } from "./state-machine";
import { writeAudit } from "./audit";

export type CompleteInvoiceInput = {
  gqId: string;
  sdcNumber: string;
  rraResponse?: unknown;
  invoicePdfUrl?: string;
  actor?: string;
  role?: string;
};

export async function completeInvoice(input: CompleteInvoiceInput) {
  const current = await prisma.globalQr.findUnique({ where: { gqId: input.gqId } });

  if (!current) {
    throw new Error("Global QR request not found");
  }

  if (current.status === "DONE") {
    return current;
  }

  if (current.status !== "GENERATING") {
    throw new Error(`Cannot complete invoice from status ${current.status}`);
  }

  const updated = await transitionGlobalQr(input.gqId, "DONE", {
    actor: input.actor ?? "vendor-callback",
    role: input.role ?? "vendor",
    decision: "RRA_ACCEPTED",
    decisionBy: input.actor ?? "vendor-callback",
    extra: {
      sdcNumber: input.sdcNumber,
      rraResponse:
        typeof input.rraResponse === "string"
          ? input.rraResponse
          : JSON.stringify(input.rraResponse ?? { accepted: true }),
      invoicePdfUrl: input.invoicePdfUrl,
    },
  });

  try {
    const phone = decryptPhone(updated.buyerPhoneEnc);
    mockSms(phone, `Your EBM invoice ${updated.sdcNumber} is ready for ${updated.gqId}.`);
    await markDelivered(updated.gqId, "SMS");
  } catch {
    await writeAudit({
      actor: input.actor ?? "vendor-callback",
      role: input.role ?? "vendor",
      action: "DELIVERY_FAILED",
      entity: "GlobalQr",
      entityId: updated.gqId,
      after: { reason: "Could not decrypt or deliver phone" },
    });
  }

  await writeAudit({
    actor: input.actor ?? "vendor-callback",
    role: input.role ?? "vendor",
    action: "INVOICE_CALLBACK",
    entity: "GlobalQr",
    entityId: updated.gqId,
    after: {
      sdcNumber: input.sdcNumber,
      invoicePdfUrl: input.invoicePdfUrl,
    },
  });

  return prisma.globalQr.findUniqueOrThrow({ where: { gqId: input.gqId } });
}
