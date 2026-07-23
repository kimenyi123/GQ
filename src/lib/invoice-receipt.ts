export type ParsedInvoiceReceipt = {
  merchantName?: string;
  tin?: string;
  momoCode?: string;
  docRef?: string;
  totalRwf?: number;
  itemsSummary?: string;
  rawText: string;
};

function parseAmount(raw: string): number | undefined {
  const n = Number(raw.replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function isRealWord(word: string): boolean {
  return /^[a-zA-Z]{4,}$/.test(word) && /[aeiouAEIOU]/.test(word) && !/^[HhIi]+$/.test(word);
}

function looksLikeItemLine(line: string): boolean {
  if (line.length < 6) return false;
  if (/total|vat|sc\b|tip|amount|subtotal|chk|tbl|tin|momo|rwf|walk|server|terminal/i.test(line)) {
    return false;
  }

  const symbols = (line.match(/[^a-zA-Z0-9\s]/g) ?? []).length;
  if (symbols / line.length > 0.25) return false;

  const words = line.split(/\s+/).filter(Boolean);
  const realWords = words.filter(isRealWord);
  if (realWords.length < 1) return false;

  const qtyItem = /^\d+\s+[A-Za-z]{3,}/.test(line);
  const priceTail = /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/.test(line);
  return qtyItem || (priceTail && realWords.length >= 2);
}

function pickMerchantName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length < 5) continue;
    if (/restaurant|pharma|hotel|ltd|shop|store|boutique|convention|filini/i.test(clean)) {
      return clean.toUpperCase();
    }
  }
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, " ").replace(/\s+/g, " ").trim();
    if (
      clean.length >= 8 &&
      /^[A-Z][A-Z0-9\s&'.-]+$/.test(clean) &&
      !/TIN|MOMO|CHK|TBL|SEE|HHH/i.test(clean)
    ) {
      const realWords = clean.split(/\s+/).filter(isRealWord);
      if (realWords.length >= 2) return clean;
    }
  }
  return undefined;
}

function pickTotalRwf(text: string): number | undefined {
  const totalPatterns = [
    /TOTAL\s+AMOUNT[^\d]*([\d,]+\.?\d*)/i,
    /(?:^|\s)TOTAL[:\s]*([\d,]+\.?\d*)/im,
    /([\d,]+\.?\d{2})\s*RWF/i,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const v = parseAmount(m[1]);
      if (v && v >= 100) return v;
    }
  }
  const amounts = [...text.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/g)]
    .map((m) => parseAmount(m[1]))
    .filter((n): n is number => typeof n === "number" && n >= 1000);
  return amounts.length ? Math.max(...amounts) : undefined;
}

/** Heuristic parse of OCR text from Rwanda restaurant / shop receipts. */
export function parseInvoiceReceiptText(text: string, trusted = true): ParsedInvoiceReceipt {
  const rawText = text;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tin =
    text.match(/TIN\s*(?:NO\.?)?[:\s]*(\d{9,12})/i)?.[1] ??
    text.match(/(?:^|\n)\s*(\d{9})\s*(?:\n|$)/m)?.[1];

  const momoCode = text.match(/MOMO\s*CODE[:\s]*(\d{5,8})/i)?.[1];

  const chk = text.match(/CHK\s*(\d+)/i);
  const docRef = chk ? `CHK${chk[1]}` : text.match(/\b(ORD|INV|DN)-[A-Z0-9]+\b/i)?.[0];

  const totalRwf = pickTotalRwf(text);
  const merchantName = pickMerchantName(lines);

  const itemLines = trusted ? lines.filter(looksLikeItemLine) : [];
  const itemsSummary = itemLines.length ? itemLines.slice(0, 4).join(" · ") : undefined;

  return {
    merchantName,
    tin,
    momoCode,
    docRef,
    totalRwf,
    itemsSummary,
    rawText,
  };
}
