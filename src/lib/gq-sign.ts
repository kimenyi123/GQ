import { createHmac, timingSafeEqual } from "crypto";

const GQ_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type GqSignInput = {
  gqId: string;
  tin: string;
  mrc?: string | null;
  amount?: number | null;
  declaredAmount?: number | null;
  phoneHash: string;
  scanTs: Date;
  channel: string;
  payload?: string | null;
};

export function formatGqSignAmount(
  amount?: number | null,
  declaredAmount?: number | null,
): string {
  const value = declaredAmount ?? amount;
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

/** Canonical string: gqId | tin | mrc | amount | phoneHash | scanTs | channel | payload */
export function buildGqRequestCanonical(input: GqSignInput): string {
  return [
    input.gqId,
    input.tin,
    input.mrc ?? "",
    formatGqSignAmount(input.amount, input.declaredAmount),
    input.phoneHash,
    input.scanTs.toISOString(),
    input.channel,
    input.payload ?? "",
  ].join("|");
}

/**
 * Platform integrity code — anti-duplication / anti-tamper for ebm.rw only.
 * NOT an RRA or VSDC receipt signature.
 */
export function signGqRequest(input: GqSignInput, secret?: string): string {
  const key = secret ?? process.env.GQ_HMAC_SECRET ?? "dev-hmac-secret-change-me";
  const digest = createHmac("sha256", key).update(buildGqRequestCanonical(input)).digest();
  let code = "";
  for (let i = 0; i < 16; i++) {
    const byte =
      digest[i]! ^ digest[(i + 11) % digest.length]! ^ digest[(i * 5 + 3) % digest.length]!;
    code += GQ_CODE_ALPHABET[byte % 36]!;
  }
  return code;
}

export function verifyGqRequest(input: GqSignInput, signature: string, secret?: string): boolean {
  const normalized = signature.trim().toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(normalized)) return false;
  const expected = signGqRequest(input, secret);
  const a = Buffer.from(normalized, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
