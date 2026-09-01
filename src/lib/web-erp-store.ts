import { buildDynamicPayload } from "./qr";
import type { SimCartLine, SimPrintOption } from "./simulator-helpers";
import { simCartTotal } from "./simulator-helpers";

export type WebErpSnapshot = {
  docRef: string;
  status: "DRAFT" | "READY" | "PAYING" | "PAID" | "STAMPED";
  ijisho: string;
  tin: string;
  mrc: string;
  employe: string;
  merchantName: string;
  buyerTin: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  tva: number;
  items: SimCartLine[];
  gqPayload: string;
  gqUrl: string;
  railCode: string;
  railTxnId: string;
  railAmount: number;
  railSource: string;
  printOption: SimPrintOption;
  promoText: string;
  updatedAt: number;
};

type SessionInput = {
  tin: string;
  mrc: string;
  employe?: string;
  merchantName?: string;
  buyerTin?: string;
  buyerName?: string;
  buyerPhone?: string;
  ijisho?: string;
  items: SimCartLine[];
  printOption?: SimPrintOption;
  promoText?: string;
  docRef?: string;
};

const g = globalThis as typeof globalThis & { __webErpCurrent?: WebErpSnapshot | null };

function store() {
  if (g.__webErpCurrent === undefined) g.__webErpCurrent = null;
  return g;
}

export function webErpCurrent() {
  return store().__webErpCurrent;
}

export function webErpReset() {
  store().__webErpCurrent = null;
}

function estimateTva(items: SimCartLine[]) {
  return items.reduce((sum, line) => {
    const band = (line.tvaBand || "B").toUpperCase();
    const rate = band === "A" ? 0 : band === "C" ? 0.18 : 0.18;
    const lineTotal = line.qty * line.price;
    return sum + (lineTotal - lineTotal / (1 + rate));
  }, 0);
}

function mintDocRef(ijisho: string, employe: string) {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]/g, "") || "SALE";
  return `${safe(ijisho)}-${safe(employe)}-${Date.now()}`;
}

function buildGq2(tin: string, mrc: string, docRef: string) {
  const txTs = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return buildDynamicPayload({ tin, mrc, txTs, docRef });
}

export function webErpUpsertSession(input: SessionInput): WebErpSnapshot {
  const cur = store().__webErpCurrent;
  const employe = input.employe ?? cur?.employe ?? "WEB-CASHIER";
  const ijisho = input.ijisho ?? cur?.ijisho ?? "INVOICE";
  const docRef = input.docRef ?? cur?.docRef ?? mintDocRef(ijisho, employe);
  const amount = simCartTotal(input.items);
  const snap: WebErpSnapshot = {
    docRef,
    status: cur?.status === "PAID" || cur?.status === "STAMPED" ? cur.status : "DRAFT",
    ijisho,
    tin: input.tin,
    mrc: input.mrc,
    employe,
    merchantName: input.merchantName ?? cur?.merchantName ?? "Web ERP Shop",
    buyerTin: input.buyerTin ?? "",
    buyerName: input.buyerName ?? "",
    buyerPhone: input.buyerPhone ?? cur?.buyerPhone ?? "+250788000001",
    amount,
    tva: estimateTva(input.items),
    items: input.items,
    gqPayload: cur?.gqPayload ?? "",
    gqUrl: cur?.gqUrl ?? "",
    railCode: cur?.railCode ?? "",
    railTxnId: cur?.railTxnId ?? "",
    railAmount: cur?.railAmount ?? 0,
    railSource: cur?.railSource ?? "",
    printOption: input.printOption ?? cur?.printOption ?? "EPSON",
    promoText: input.promoText ?? cur?.promoText ?? "",
    updatedAt: Date.now(),
  };
  if (snap.status === "DRAFT") {
    snap.gqPayload = "";
    snap.gqUrl = "";
  }
  store().__webErpCurrent = snap;
  return snap;
}

export function webErpPushReady(appBaseUrl: string): WebErpSnapshot | null {
  const cur = store().__webErpCurrent;
  if (!cur || cur.items.length === 0) return null;
  const gqPayload = buildGq2(cur.tin, cur.mrc, cur.docRef);
  const base = appBaseUrl.replace(/\/+$/, "");
  const gqUrl = `${base}/?payload=${encodeURIComponent(gqPayload)}`;
  const snap: WebErpSnapshot = {
    ...cur,
    status: "READY",
    gqPayload,
    gqUrl,
    updatedAt: Date.now(),
  };
  store().__webErpCurrent = snap;
  return snap;
}

export function webErpMarkPaid(
  docRef: string,
  railCode: string,
  txnId: string,
  amount: number,
  source: string,
): WebErpSnapshot | null {
  const cur = store().__webErpCurrent;
  if (!cur || cur.docRef !== docRef) return null;
  const snap: WebErpSnapshot = {
    ...cur,
    status: "PAID",
    railCode,
    railTxnId: txnId,
    railAmount: amount,
    railSource: source,
    updatedAt: Date.now(),
  };
  store().__webErpCurrent = snap;
  return snap;
}

export function webErpMarkStamped(docRef: string) {
  const cur = store().__webErpCurrent;
  if (!cur || cur.docRef !== docRef) return null;
  const snap: WebErpSnapshot = { ...cur, status: "STAMPED", updatedAt: Date.now() };
  store().__webErpCurrent = snap;
  return snap;
}

export function webErpToLanJson(snap: WebErpSnapshot) {
  return {
    docRef: snap.docRef,
    status: snap.status,
    ijisho: snap.ijisho,
    tin: snap.tin,
    mrc: snap.mrc,
    merchantName: snap.merchantName,
    buyerTin: snap.buyerTin,
    buyerName: snap.buyerName,
    buyerPhone: snap.buyerPhone,
    amount: snap.amount,
    tva: snap.tva,
    gqPayload: snap.gqPayload,
    gqUrl: snap.gqUrl,
    railCode: snap.railCode,
    railTxnId: snap.railTxnId,
    railAmount: snap.railAmount,
    railSource: snap.railSource,
    printOption: snap.printOption,
    promoText: snap.promoText,
    updatedAt: snap.updatedAt,
    items: snap.items,
  };
}
