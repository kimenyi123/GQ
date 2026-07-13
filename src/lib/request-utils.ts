import { createHash } from "crypto";
import { verifyHmac } from "./hmac";

export async function readJson<T = Record<string, unknown>>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function readRawJson<T = Record<string, unknown>>(request: Request) {
  const raw = await request.text();

  try {
    return { raw, body: JSON.parse(raw) as T };
  } catch {
    return { raw, body: null };
  }
}

export function verifyOptionalHmac(request: Request, raw: string) {
  const signature = request.headers.get("x-gq-signature");

  if (!signature) {
    return true;
  }

  const secret = process.env.GQ_HMAC_SECRET;

  if (!secret) {
    return false;
  }

  return verifyHmac(raw, signature, secret);
}

export function phoneFingerprint(phone: string) {
  return createHash("sha256").update(phone.trim()).digest("hex");
}

export function maskPhone(phone: string) {
  return `***${phone.slice(-4)}`;
}

export function parseDateParam(value: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
