import { buildDynamicPayload } from "./qr";

export type SimCartLine = {
  code: string;
  name: string;
  qty: number;
  price: number;
  tvaBand: string;
};

export type SimPayment = {
  railCode: string;
  railName: string;
  paidOn: string;
  paidFrom: string;
  txnId: string;
  amount: number;
};

export const SIM_PAYMENT_RAILS = [
  { code: "MTN_MOMO", name: "MTN MoMo Pay", paidOn: "1821234567", ussd: "*182*8*1*{code}*{amount}#" },
  { code: "BK", name: "Bank of Kigali", paidOn: "55544", ussd: "" },
  { code: "BPR", name: "BPR Bank", paidOn: "3321", ussd: "" },
  { code: "AIRTEL", name: "Airtel Money", paidOn: "55512", ussd: "" },
  { code: "ACCESS", name: "Access Bank", paidOn: "4555", ussd: "" },
  { code: "CASH", name: "Cash (manual)", paidOn: "TILL-01", ussd: "" },
] as const;

export const SIM_PRINT_OPTIONS = ["EPSON", "A4", "NONE"] as const;
export type SimPrintOption = (typeof SIM_PRINT_OPTIONS)[number];

export function simCartTotal(lines: SimCartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty * line.price, 0);
}

export function mintDocRef(ijisho = "INVOICE", employe = "SIM") {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]/g, "") || "SALE";
  return `${safe(ijisho)}-${safe(employe)}-${Date.now()}`;
}

export function buildGq2Payload(tin: string, mrc: string, docRef: string) {
  const txTs = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return buildDynamicPayload({ tin, mrc, txTs, docRef });
}

/** Demo VSDC stamp shape (16 + 26 Base32) — not a real SKMM signature. */
export function fakeVsdcStamp(docRef: string) {
  const seed = docRef.replace(/\W/g, "").toUpperCase();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let signature = "";
  let internalData = "";
  for (let i = 0; i < 16; i++) {
    signature += alphabet[(seed.charCodeAt(i % seed.length) + i * 7) % alphabet.length];
  }
  for (let i = 0; i < 26; i++) {
    internalData += alphabet[(seed.charCodeAt((i + 3) % seed.length) + i * 11) % alphabet.length];
  }
  return { vsdcSignature: signature, vsdcInternalData: internalData };
}

export function buildReceiptText(input: {
  merchantName: string;
  tin: string;
  mrc: string;
  docRef: string;
  buyerTin: string;
  buyerName: string;
  lines: SimCartLine[];
  payment?: SimPayment | null;
  gqId?: string;
  vsdcSignature?: string;
  vsdcInternalData?: string;
  printOption: SimPrintOption;
  promoText?: string;
}) {
  const total = simCartTotal(input.lines);
  const itemLines = input.lines
    .map(
      (l) =>
        `${l.qty}x ${l.name} @ ${l.price.toLocaleString()} = ${(l.qty * l.price).toLocaleString()} RWF [${l.tvaBand || "B"}]`,
    )
    .join("\n");

  const payBlock = input.payment
    ? [
        "",
        "PAYMENT",
        `Method: ${input.payment.railName} (${input.payment.railCode})`,
        `Paid on (merchant): ${input.payment.paidOn}`,
        `Paid from (buyer): ${input.payment.paidFrom}`,
        `Amount: ${input.payment.amount.toLocaleString()} RWF`,
        `Txn ID: ${input.payment.txnId}`,
      ].join("\n")
    : "";

  const vsdcBlock =
    input.vsdcSignature && input.vsdcInternalData
      ? `\nVSDC STAMP\nSignature: ${input.vsdcSignature}\nInternal: ${input.vsdcInternalData}`
      : "";

  const promoBlock = input.promoText?.trim()
    ? `\nPROMOTION\n${input.promoText.trim()}`
    : "";

  return [
    "ISHYIGA ERP — EBM RECEIPT (SIMULATOR)",
    `Merchant: ${input.merchantName}`,
    `TIN: ${input.tin}   MRC: ${input.mrc}`,
    `docRef: ${input.docRef}`,
    input.gqId ? `GQ ID: ${input.gqId}` : "",
    `Buyer: ${input.buyerName || "Walk-in"}${input.buyerTin ? ` (TIN ${input.buyerTin})` : ""}`,
    "",
    "ITEMS",
    itemLines,
    "",
    `TOTAL: ${total.toLocaleString()} RWF`,
    payBlock,
    vsdcBlock,
    promoBlock,
    "",
    `Print: ${input.printOption}`,
    `Time: ${new Date().toLocaleString("en-RW", { timeZone: "Africa/Kigali" })}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function randomTxnId(railCode: string) {
  return `${railCode}-${Date.now().toString(36).toUpperCase()}`;
}
