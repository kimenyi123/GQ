import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

await p.vendor.upsert({
  where: { vendorId: "VND-ISHYIGA" },
  create: {
    vendorId: "VND-ISHYIGA",
    name: "Ishyiga",
    vsdcRef: "ISHYIGA_API_VSDC",
    status: "LIVE",
  },
  update: {},
});

await p.seller.upsert({
  where: { tin: "100000101" },
  create: {
    tin: "100000101",
    name: "Algorithm Inc.",
    sector: "pharmacy",
    vendorId: "VND-ISHYIGA",
    status: "ACTIVE",
  },
  update: {},
});

await p.mrc.upsert({
  where: { mrc: "ISHSER000006" },
  create: {
    mrc: "ISHSER000006",
    tin: "100000101",
    vendorId: "VND-ISHYIGA",
    locationLabel: "Main counter",
    deviceType: "COUNTER",
    qrVersion: "GQ3",
    issuedAt: new Date(),
    issuedBy: "seed",
  },
  update: {},
});

console.log(
  JSON.stringify({
    ok: true,
    vendors: await p.vendor.count(),
    sellers: await p.seller.count(),
    mrcs: await p.mrc.count(),
  }),
);

await p.$disconnect();
