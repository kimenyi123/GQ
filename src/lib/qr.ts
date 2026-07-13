import { z } from "zod";

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

export type StaticQrPayload = z.infer<typeof staticPayloadSchema>;
export type DynamicQrPayload = z.infer<typeof dynamicPayloadSchema>;
export type ParsedQrPayload = StaticQrPayload | DynamicQrPayload;

export function parseQrPayload(payload: string): ParsedQrPayload {
  const parts = payload.split("|");

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

  throw new Error("Unsupported Global QR payload");
}

export function buildStaticPayload(input: Omit<StaticQrPayload, "version">) {
  return ["GQ1", input.tin, input.mrc, input.issuedTs].join("|");
}

export function buildDynamicPayload(input: Omit<DynamicQrPayload, "version">) {
  return ["GQ2", input.tin, input.mrc, input.txTs, input.docRef].join("|");
}
