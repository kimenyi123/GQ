import { gqTrack, gqTrackError } from "./gq-tracker";
import { assessOcrQuality, type OcrQuality } from "./invoice-ocr-quality";
import { parseInvoiceReceiptText, type ParsedInvoiceReceipt } from "./invoice-receipt";

const MAX_OCR_EDGE = 2000;

async function preprocessReceiptImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_OCR_EDGE ? MAX_OCR_EDGE / longest : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.filter = "grayscale(1) contrast(1.35) brightness(1.05)";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare image"))),
      "image/jpeg",
      0.9,
    );
  });
}

export type InvoiceImageParseResult = {
  parsed: ParsedInvoiceReceipt;
  ocrQuality: OcrQuality;
  rawText: string;
};

export async function ocrImageFile(file: File): Promise<{ text: string; confidence: number }> {
  gqTrack("ocr.start", {
    name: file.name,
    size: file.size,
    type: file.type,
  });

  const prepared = await preprocessReceiptImage(file);
  gqTrack("ocr.preprocessed", {
    originalBytes: file.size,
    preparedBytes: prepared.size,
  });

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    const {
      data: { text, confidence },
    } = await worker.recognize(prepared);
    gqTrack("ocr.done", {
      chars: text.length,
      confidence: Math.round(confidence),
      preview: text.slice(0, 800),
      lineCount: text.split(/\r?\n/).filter(Boolean).length,
    });
    if (!text.trim()) {
      gqTrack("ocr.empty", { message: "OCR returned no text" });
    }
    return { text, confidence };
  } catch (error) {
    gqTrackError("ocr.failed", error);
    throw error;
  } finally {
    await worker.terminate();
  }
}

export async function parseInvoiceImageFile(file: File): Promise<InvoiceImageParseResult> {
  const { text, confidence } = await ocrImageFile(file);
  const ocrQuality = assessOcrQuality(text, confidence);
  const parsed = parseInvoiceReceiptText(text, ocrQuality.trusted);

  gqTrack("invoice.parsed", {
    source: "photo",
    ocrQuality,
    merchantName: parsed.merchantName,
    tin: parsed.tin,
    momoCode: parsed.momoCode,
    docRef: parsed.docRef,
    totalRwf: parsed.totalRwf,
    itemsSummary: parsed.itemsSummary,
  });

  return { parsed, ocrQuality, rawText: text };
}
