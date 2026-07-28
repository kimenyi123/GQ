import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const result = await p.globalQr.updateMany({
  where: {
    status: "DONE",
    OR: [{ vsdcSignature: null }, { vsdcInternalData: null }, { vsdcSignature: "" }, { vsdcInternalData: "" }],
  },
  data: {
    status: "GENERATING",
    decision: "UNDER_PROCESSING",
    processingNote: "Awaiting VSDC receipt signature from Ishyiga — still GENERATING",
    deliveredVia: null,
    deliveredTs: null,
    invoicePdfUrl: null,
  },
});

console.log(JSON.stringify({ ok: true, repaired: result.count }));
await p.$disconnect();
