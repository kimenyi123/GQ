export const MOMO_CHECKOUT_KEY = "gq:momo:checkout";

const USSD_PREFIX =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MOMO_USSD_PREFIX) || "*182*8*1*";

export type MomoCheckout = {
  payload: string;
  merchantName: string;
  momoCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  totalRwf: number;
  ussd: string;
  tin: string;
  mrc: string;
  phone: string;
  geo?: string | null;
  timezone: string;
};

export function buildMomoUssd(momoDigits: string, amountRwf: number) {
  const d = momoDigits.replace(/\D/g, "");
  const t = Math.max(0, Math.round(amountRwf));
  if (!d || t < 1) return "";
  return `${USSD_PREFIX}${d}*${t}#`;
}

export function buildMomoTelHref(ussd: string) {
  if (!ussd) return "";
  return `tel:${ussd.replace(/#/g, "%23")}`;
}

export function saveMomoCheckout(checkout: MomoCheckout) {
  sessionStorage.setItem(MOMO_CHECKOUT_KEY, JSON.stringify(checkout));
}

export function loadMomoCheckout(): MomoCheckout | null {
  try {
    const raw = sessionStorage.getItem(MOMO_CHECKOUT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MomoCheckout;
  } catch {
    return null;
  }
}

export function clearMomoCheckout() {
  sessionStorage.removeItem(MOMO_CHECKOUT_KEY);
}

/** Extract MTN MoMo transaction id from confirmation SMS text (optional paste). */
export function parseMomoTransactionId(sms: string): string | null {
  const text = sms.trim();
  if (!text) return null;

  const patterns = [
    /transaction\s*(?:id|number|no\.?)\s*[:#]?\s*(\d{6,})/i,
    /txn\s*(?:id|number|no\.?)\s*[:#]?\s*(\d{6,})/i,
    /(?:financial\s*)?transaction\s+(\d{10,})/i,
    /(?:ref(?:erence)?|id)\s*[:#]?\s*(\d{8,})/i,
    /\b(\d{11})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}
