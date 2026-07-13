import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptPhone, hashPhone } from "../src/lib/crypto";

process.env.GQ_PHONE_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.GQ_OTP_PEPPER ??= "dev-otp-pepper";

const prisma = new PrismaClient();
const demoPassword = "GqDemo#2026";

const vendors = [
  {
    vendorId: "VND-ISHYIGA",
    name: "Ishyiga",
    vsdcRef: "VSDC-ISHYIGA-LIVE",
    webhookUrl: "mock://ishyiga",
    oauthClientId: "gq_ishyiga_demo",
    status: "LIVE",
    lastHeartbeat: new Date(),
  },
  {
    vendorId: "VND-ODOO",
    name: "Odoo-demo",
    vsdcRef: "VSDC-ODOO-DEMO",
    webhookUrl: "https://odoo.example.com/gq/webhook",
    oauthClientId: "gq_odoo_demo",
    status: "PENDING",
    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    vendorId: "VND-SAGE",
    name: "Sage-demo",
    vsdcRef: "VSDC-SAGE-DEMO",
    webhookUrl: "https://sage.example.com/gq/webhook",
    oauthClientId: "gq_sage_demo",
    status: "PENDING",
    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 60 * 8),
  },
];

const sellers = [
  {
    tin: "100000001",
    name: "Chez Kivu",
    sector: "hospitality",
    contacts: "+250788000010, manager@chezkivu.rw",
    vendorId: "VND-ISHYIGA",
  },
  {
    tin: "100000002",
    name: "Kigali Butike",
    sector: "butike",
    contacts: "+250788000011",
    vendorId: "VND-ISHYIGA",
  },
  {
    tin: "100000003",
    name: "Nyamirambo Diner",
    sector: "hospitality",
    contacts: "+250788000012",
    vendorId: "VND-ODOO",
  },
  {
    tin: "100000004",
    name: "Musanze Market Shop",
    sector: "butike",
    contacts: "+250788000013",
    vendorId: "VND-SAGE",
  },
  {
    tin: "100000005",
    name: "Lake View Hotel",
    sector: "hospitality",
    contacts: "+250788000014",
    vendorId: "VND-ISHYIGA",
  },
  {
    tin: "100000006",
    name: "Rubavu Mini Market",
    sector: "butike",
    contacts: "+250788000015",
    vendorId: "VND-ODOO",
  },
];

const mrcs = [
  ["MRC-CKT001", "100000001", "Table 1", "TABLE", "GQ1"],
  ["MRC-CKT004", "100000001", "Table 4", "TABLE", "GQ1"],
  ["MRC-CKCNT1", "100000001", "Main counter", "COUNTER", "GQ2"],
  ["MRC-CKONL1", "100000001", "Online orders", "ONLINE", "GQ2"],
  ["MRC-KBCNT1", "100000002", "Counter 1", "COUNTER", "GQ1"],
  ["MRC-KBCNT2", "100000002", "Counter 2", "COUNTER", "GQ1"],
  ["MRC-KBTRK1", "100000002", "Delivery truck", "TRUCK", "GQ2"],
  ["MRC-NDT001", "100000003", "Table 1", "TABLE", "GQ1"],
  ["MRC-NDT002", "100000003", "Table 2", "TABLE", "GQ1"],
  ["MRC-NDCNT1", "100000003", "Counter", "COUNTER", "GQ2"],
  ["MRC-MMCNT1", "100000004", "Front counter", "COUNTER", "GQ1"],
  ["MRC-MMTRK1", "100000004", "Supply truck", "TRUCK", "GQ2"],
  ["MRC-LVREC1", "100000005", "Reception", "COUNTER", "GQ1"],
  ["MRC-LVT010", "100000005", "Table 10", "TABLE", "GQ1"],
  ["MRC-RBCNT1", "100000006", "Counter", "COUNTER", "GQ1"],
] as const;

const moveTypes = ["ORDER", "PROFORMA", "DELIVERY", "BANK", "MOMO"];
const channels = ["TABLES", "USSD", "DEVICE", "QR", "LINK"];
const statuses = [
  ...Array(80).fill("DONE"),
  ...Array(15).fill("QUEUEING"),
  ...Array(10).fill("GENERATING"),
  ...Array(8).fill("STANDBY"),
  ...Array(4).fill("ADJUST"),
  ...Array(2).fill("REFUNDED"),
  "FAILED",
];

function daysAgo(days: number, offsetHours = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 + offsetHours * 60 * 60 * 1000);
}

function amountFor(index: number) {
  return 1500 + (index % 17) * 1250;
}

function itemsFor(index: number) {
  return JSON.stringify([
    {
      name: index % 3 === 0 ? "Brochette" : index % 3 === 1 ? "Coffee" : "Groceries",
      qty: 1 + (index % 4),
      price: amountFor(index),
    },
  ]);
}

async function main() {
  const oauthSecretHash = await bcrypt.hash("demo-oauth-secret", 12);
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  await prisma.auditLog.deleteMany();
  await prisma.batchRun.deleteMany();
  await prisma.evasionReport.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.globalQr.deleteMany();
  await prisma.move.deleteMany();
  await prisma.otpSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mrc.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.vendor.deleteMany();

  await prisma.vendor.createMany({
    data: vendors.map((vendor) => ({
      ...vendor,
      oauthClientSecretHash: oauthSecretHash,
    })),
  });

  await prisma.seller.createMany({ data: sellers });

  await prisma.mrc.createMany({
    data: mrcs.map(([mrc, tin, locationLabel, deviceType, qrVersion], index) => ({
      mrc,
      tin,
      vendorId: sellers.find((seller) => seller.tin === tin)?.vendorId,
      locationLabel,
      deviceType,
      qrVersion,
      issuedAt: daysAgo(30 - index),
      issuedBy: "seed-admin",
    })),
  });

  const moves = Array.from({ length: 200 }, (_, index) => {
    const mrc = mrcs[index % mrcs.length];
    const seller = sellers.find((entry) => entry.tin === mrc[1])!;

    return {
      moveId: `MOV-${String(index + 1).padStart(6, "0")}`,
      vendorId: seller.vendorId!,
      tin: seller.tin,
      mrc: mrc[0],
      moveType: moveTypes[index % moveTypes.length],
      docRef: `DOC-${String(index + 1).padStart(6, "0")}`,
      items: itemsFor(index),
      amount: amountFor(index),
      currency: "RWF",
      ts: daysAgo(index % 14, index % 12),
      raw: JSON.stringify({ source: "seed", index }),
    };
  });

  await prisma.move.createMany({ data: moves });

  const globalQr = statuses.map((status, index) => {
    const move = moves[index];
    const done = status === "DONE";
    const refunded = status === "REFUNDED";
    // First 20 requests belong to the demo citizen phone so /my has real data
    const phone = index < 20 ? "+250788000001" : `+2507881${String(index).padStart(5, "0")}`;

    return {
      gqId: `GQ-${String(index + 1).padStart(6, "0")}`,
      tin: move.tin,
      mrc: move.mrc,
      docRef: move.docRef,
      moveId: move.moveId,
      amount: move.amount,
      items: move.items,
      channel: channels[index % channels.length],
      buyerPhoneEnc: encryptPhone(phone),
      buyerPhoneHash: hashPhone(phone),
      buyerEmail: index % 4 === 0 ? `buyer${index}@example.com` : null,
      geo: index % 5 === 0 ? "-1.9441,30.0619" : null,
      scanTs: daysAgo(index % 14, index % 8),
      status,
      decision: done ? "RRA_ACCEPTED" : refunded ? "REFUND_APPROVED" : null,
      decisionBy: done || refunded ? "seed-agent" : null,
      decisionTs: done || refunded ? daysAgo(index % 10, 2) : null,
      sdcNumber: done ? `SDC-${String(500000 + index)}` : null,
      rraResponse: done
        ? JSON.stringify({ accepted: true, rraRef: `RRA-${String(index + 1).padStart(6, "0")}` })
        : null,
      invoicePdfUrl: done ? `/demo/invoices/GQ-${String(index + 1).padStart(6, "0")}.pdf` : null,
      deliveredVia: done ? (index % 2 === 0 ? "SMS" : "EMAIL") : null,
      deliveredTs: done ? daysAgo(index % 9, 3) : null,
      createdAt: daysAgo(index % 14, index % 5),
    };
  });

  await prisma.globalQr.createMany({ data: globalQr });

  await prisma.payment.createMany({
    data: globalQr.slice(0, 60).map((record, index) => ({
      txnId: `PAY-${String(index + 1).padStart(6, "0")}`,
      provider: index % 2 === 0 ? "MOMO" : "BANK",
      payerRef: `PAYER-${String(index + 1).padStart(4, "0")}`,
      payeeTin: record.tin,
      amount: record.amount ?? 0,
      ts: daysAgo(index % 12, 1),
      gqId: record.gqId,
      matchStatus: "MATCHED",
    })),
  });

  await prisma.evasionReport.createMany({
    data: globalQr.slice(85, 90).map((record, index) => ({
      reportId: `REP-${String(index + 1).padStart(6, "0")}`,
      gqId: record.gqId,
      sellerTin: record.tin,
      phoneEnc: encryptPhone(`+2507889${String(index).padStart(5, "0")}`),
      note: index === 0 ? "Seller declined to provide EBM invoice." : "Invoice not received.",
      evidenceUrl: index % 2 === 0 ? `https://example.com/evidence/${index}` : null,
      status: index < 2 ? "REVIEWING" : "NEW",
      createdAt: daysAgo(index + 1),
    })),
  });

  await prisma.batchRun.createMany({
    data: [0, 1, 2].map((index) => ({
      id: `BAT-${String(index + 1).padStart(6, "0")}`,
      date: daysAgo(index + 1),
      pushed: 24 + index,
      refunded: index,
      failed: index === 2 ? 1 : 0,
      report: JSON.stringify({ note: "Demo nightly batch", index }),
    })),
  });

  await prisma.user.createMany({
    data: [
      {
        id: "USR-CITIZEN",
        phone: "+250788000001",
        passwordHash,
        role: "citizen",
        name: "Demo Citizen",
      },
      {
        id: "USR-SELLER",
        phone: "+250788000010",
        passwordHash,
        role: "seller",
        tin: "100000001",
        name: "Chez Kivu Seller",
      },
      {
        id: "USR-VENDOR",
        phone: "+250788000020",
        email: "vendor@ishyiga.example",
        passwordHash,
        role: "vendor",
        vendorId: "VND-ISHYIGA",
        name: "Ishyiga Vendor",
      },
      {
        id: "USR-AGENT",
        phone: "+250788000030",
        passwordHash,
        role: "agent",
        name: "RRA Field Agent",
      },
      {
        id: "USR-ADMIN",
        phone: "+250788000040",
        email: "admin@gq.example",
        passwordHash,
        role: "admin",
        name: "GQ Admin",
      },
      {
        id: "USR-RRA",
        phone: "+250788000050",
        email: "rra@gq.example",
        passwordHash,
        role: "rra",
        name: "RRA Officer",
      },
    ],
  });

  await prisma.otpSession.create({
    data: {
      id: "OTP-DEMO",
      phone: "+250788000001",
      codeHash: await bcrypt.hash(`123456:${process.env.GQ_OTP_PEPPER}`, 10),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      id: "AUD-SEED",
      actor: "seed",
      role: "system",
      action: "SEED_DATABASE",
      entity: "Database",
      entityId: "dev",
      after: JSON.stringify({
        vendors: vendors.length,
        sellers: sellers.length,
        mrcs: mrcs.length,
        moves: moves.length,
        globalQr: globalQr.length,
      }),
    },
  });

  console.log("Global QR demo seed complete");
  console.log("Demo password:", demoPassword);
  console.log("Demo phones:");
  console.log("  citizen: +250788000001");
  console.log("  seller:  +250788000010 (Chez Kivu TIN 100000001)");
  console.log("  vendor:  +250788000020");
  console.log("  agent:   +250788000030");
  console.log("  admin:   +250788000040");
  console.log("  rra:     +250788000050");
  console.log("Demo OTP:", "123456");
  console.log("OAuth clients:", vendors.map((vendor) => vendor.oauthClientId).join(", "));
  console.log("OAuth secret:", "demo-oauth-secret");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
