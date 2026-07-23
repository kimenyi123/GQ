import { z } from "zod";
import { resolvePublicAppUrl } from "./app-url";

const staticPayloadSchema = z.object({
  version: z.literal("GQ1"),
  tin: z.string().min(1),
  mrc: z.string().min(1),
  issuedTs: z.string().min(1),
});

const dynamicPayloadSchema = z.object({
  version: z.literal("GQ2"),
  tin: z.string().min(1),
  mrc: z.string().min(1),
  txTs: z.string().min(1),
  docRef: z.string().min(1),
});

const momoPayloadSchema = z.object({
  version: z.literal("GQ3"),
  tin: z.string().min(1),
  mrc: z.string().min(1),
  momoCode: z.string().min(1),
  name: z.string().min(1),
});

export type StaticQrPayload = z.infer<typeof staticPayloadSchema>;
export type DynamicQrPayload = z.infer<typeof dynamicPayloadSchema>;
export type MomoQrPayload = z.infer<typeof momoPayloadSchema>;
export type ParsedQrPayload = StaticQrPayload | DynamicQrPayload | MomoQrPayload;

export function parseQrPayload(payload: string): ParsedQrPayload {
  const parts = payload.trim().split("|");

  if (parts[0] === "GQ1" && parts.length === 4) {
    return staticPayloadSchema.parse({
      version: parts[0],
      tin: parts[1],
      mrc: parts[2],
      issuedTs: parts[3],
    });
  }

  if (parts[0] === "GQ2" && parts.length === 5) {
    return dynamicPayloadSchema.parse({
      version: parts[0],
      tin: parts[1],
      mrc: parts[2],
      txTs: parts[3],
      docRef: parts[4],
    });
  }

  if (parts[0] === "GQ3" && parts.length >= 5) {
    return momoPayloadSchema.parse({
      version: parts[0],
      tin: parts[1],
      mrc: parts[2],
      momoCode: parts[3],
      name: parts.slice(4).join("|"),
    });
  }

  throw new Error("Unsupported Global QR payload");
}

export function buildStaticPayload(input: Omit<StaticQrPayload, "version">) {
  return ["GQ1", input.tin, input.mrc, input.issuedTs].join("|");
}

export function buildDynamicPayload(input: Omit<DynamicQrPayload, "version">) {
  return ["GQ2", input.tin, input.mrc, input.txTs, input.docRef].join("|");
}

export function buildMomoPayload(input: Omit<MomoQrPayload, "version">) {
  return ["GQ3", input.tin, input.mrc, input.momoCode.replace(/\D/g, ""), input.name].join("|");
}

/** QR sticker encodes this URL so phone opens Ishyura with fields pre-filled. */
export function buildGq3ScanUrl(gq3Payload: string, appBaseUrl?: string) {
  const base = resolvePublicAppUrl(appBaseUrl);
  const url = new URL(`${base}/`);
  url.searchParams.set("payload", gq3Payload);
  return url.toString();
}

/** Accept raw GQ3 text or a scan URL with ?payload=GQ3|… */
export function extractGq3PayloadFromScan(text: string): string | null {
  const raw = text.trim();
  if (raw.startsWith("GQ3|")) return raw;
  try {
    const url = new URL(raw);
    const p = url.searchParams.get("payload")?.trim();
    if (p?.startsWith("GQ3|")) return p;
  } catch {
    /* not a URL */
  }
  return null;
}

export function isMomoPayload(parsed: ParsedQrPayload): parsed is MomoQrPayload {
  return parsed.version === "GQ3";
}
