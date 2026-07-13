import { signPayload } from "./hmac";
import { completeInvoice } from "./invoice-service";
import { prisma } from "./prisma";

export async function fireVendorWebhook(gqId: string) {
  const record = await prisma.globalQr.findUnique({ where: { gqId } });

  if (!record) {
    return;
  }

  const mrc = record.mrc
    ? await prisma.mrc.findUnique({ where: { mrc: record.mrc } })
    : null;
  const vendor = mrc?.vendorId
    ? await prisma.vendor.findUnique({ where: { vendorId: mrc.vendorId } })
    : null;

  if (!vendor) {
    return;
  }

  const payload = {
    gqId: record.gqId,
    tin: record.tin,
    mrc: record.mrc,
    docRef: record.docRef,
    amount: record.amount,
    items: record.items,
    requestedAt: record.createdAt,
  };
  const raw = JSON.stringify(payload);
  const signature = signPayload(raw, process.env.GQ_HMAC_SECRET ?? "dev-hmac-secret-change-me");

  const useMock =
    !vendor.webhookUrl ||
    vendor.webhookUrl.startsWith("mock://") ||
    vendor.webhookUrl.includes("example.com");

  if (useMock) {
    console.log(`[MOCK VENDOR WEBHOOK] vendor=${vendor.vendorId} gqId=${gqId}`);

    if (
      vendor.name.toLowerCase().includes("ishyiga") ||
      vendor.vendorId === "VND-ISHYIGA"
    ) {
      setTimeout(() => {
        completeInvoice({
          gqId,
          sdcNumber: `SDC-${Date.now()}`,
          rraResponse: { accepted: true, vendorId: vendor.vendorId, mode: "mock-auto" },
          invoicePdfUrl: `/demo/invoices/${gqId}.pdf`,
          actor: vendor.vendorId,
          role: "vendor",
        }).catch((error) => {
          console.error("[MOCK VENDOR CALLBACK FAILED]", error);
        });
      }, 1000);
    }

    return;
  }

  try {
    const response = await fetch(vendor.webhookUrl!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gq-signature": signature,
      },
      body: raw,
    });

    if (!response.ok) {
      console.error(`[VENDOR WEBHOOK FAILED] vendor=${vendor.vendorId} status=${response.status}`);
    }
  } catch (error) {
    console.error("[VENDOR WEBHOOK ERROR]", error);
  }
}
