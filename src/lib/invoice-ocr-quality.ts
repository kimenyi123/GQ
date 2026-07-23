/** Score OCR output; reject letter-soup before auto-filling the form. */
export type OcrQuality = {
  score: number;
  trusted: boolean;
  confidence?: number;
  reasons: string[];
};

export function assessOcrQuality(text: string, confidence?: number): OcrQuality {
  const reasons: string[] = [];
  let score = 0;

  if (/TIN\s*(?:NO)?/i.test(text)) score += 22;
  if (/TOTAL|AMOUNT/i.test(text)) score += 18;
  if (/RWF/i.test(text)) score += 12;
  if (/CHK\s*\d/i.test(text)) score += 18;
  if (/MOMO/i.test(text)) score += 10;
  if (/\b\d{9}\b/.test(text)) score += 20;
  if (/\d{1,3}(?:,\d{3})+\.\d{2}/.test(text)) score += 15;

  const noiseRuns = (text.match(/[=|_\\/.]{3,}/g) ?? []).length;
  if (noiseRuns > 3) {
    score -= 35;
    reasons.push("noise_patterns");
  }

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const singleChars = words.filter((w) => w.length === 1).length;
  if (words.length > 10 && singleChars / words.length > 0.25) {
    score -= 30;
    reasons.push("fragmented_letters");
  }

  const hiSoup = (text.match(/\b[HhIi]\b/g) ?? []).length;
  if (hiSoup > 15) {
    score -= 25;
    reasons.push("letter_soup");
  }

  const realWords = words.filter(
    (w) => /^[a-zA-Z]{4,}$/.test(w) && /[aeiouAEIOU]/.test(w) && !/^[HhIi]+$/.test(w),
  );
  if (realWords.length < 2) {
    score -= 20;
    reasons.push("few_real_words");
  }

  if (typeof confidence === "number" && confidence < 35) {
    score -= 25;
    reasons.push("low_tesseract_confidence");
  }

  const hasAnchor =
    /TIN/i.test(text) ||
    /CHK\s*\d/i.test(text) ||
    /\d{1,3}(?:,\d{3})+\.\d{2}/.test(text) ||
    /RESTAURANT|PHARMA|HOTEL|LTD/i.test(text);

  const trusted = score >= 30 && hasAnchor;

  if (!hasAnchor) reasons.push("no_receipt_anchors");
  if (score < 30) reasons.push("score_below_threshold");

  return { score, trusted, confidence, reasons };
}
