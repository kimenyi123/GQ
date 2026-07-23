import type { PayableAccount } from "./smart-sticker";
import { buildMomoTelHref, buildMomoUssd } from "./momo-payment";

export type PaymentRail = {
  id: string;
  provider: string;
  code: string;
  pillBg: string;
  pillText: string;
};

const PAYABLES_PARAM = "pay";

/** Compact URL param: Access Bank~4555~#F5B800|Airtel~55512~#E4002B */
export function encodePayablesUrl(payables: PayableAccount[]): string {
  return payables
    .map((p) => `${encodeURIComponent(p.provider)}~${p.code}~${p.pillBg.replace("#", "")}`)
    .join("|");
}

export function decodePayablesUrl(raw: string | null): PaymentRail[] {
  if (!raw?.trim()) return [];
  return raw.split("|").flatMap((chunk, i) => {
    const [provider, code, color] = chunk.split("~");
    if (!provider || !code) return [];
    const pillBg = color ? `#${color.replace("#", "")}` : "#F5B800";
    return [
      {
        id: `pay-${i}`,
        provider: decodeURIComponent(provider),
        code,
        pillBg,
        pillText: pillBg.toLowerCase() === "#f5b800" ? "#1a1a1a" : "#ffffff",
      },
    ];
  });
}

export function buildPaymentRails(momoCode: string, payables: PaymentRail[]): PaymentRail[] {
  const digits = momoCode.replace(/\D/g, "");
  const rails: PaymentRail[] = [];
  if (digits.length >= 5) {
    rails.push({
      id: "momo",
      provider: "MTN MoMo",
      code: digits,
      pillBg: "#F5B800",
      pillText: "#1a1a1a",
    });
  }
  for (const p of payables) {
    if (!rails.some((r) => r.provider === p.provider && r.code === p.code)) {
      rails.push(p);
    }
  }
  return rails;
}

function dialForProvider(provider: string, code: string, amountRwf: number): string {
  const c = code.replace(/\D/g, "");
  const a = Math.max(0, Math.round(amountRwf));
  const key = provider.toLowerCase();

  if (key.includes("momo") || key.includes("mtn") || c.startsWith("07")) {
    return buildMomoUssd(c, a);
  }
  if (key.includes("airtel")) return `*500*${c}*${a}#`;
  if (key === "bk" || key.includes("kigali")) return `*334*${c}*${a}#`;
  if (key.includes("access")) return `*901*${c}*${a}#`;
  return `*${c}*${a}#`;
}

export function buildRailUssd(rail: PaymentRail, amountRwf: number) {
  return dialForProvider(rail.provider, rail.code, amountRwf);
}

export function dialRail(rail: PaymentRail, amountRwf: number) {
  const ussd = buildRailUssd(rail, amountRwf);
  const href = buildMomoTelHref(ussd);
  if (href) window.location.href = href;
  return ussd;
}

export function appendPayablesToScanUrl(scanUrl: string, payables: PayableAccount[]) {
  if (!payables.length) return scanUrl;
  const url = new URL(scanUrl);
  url.searchParams.set(PAYABLES_PARAM, encodePayablesUrl(payables));
  return url.toString();
}

export function readPayablesFromLocation(search: string): PaymentRail[] {
  const params = new URLSearchParams(search);
  return decodePayablesUrl(params.get(PAYABLES_PARAM));
}
