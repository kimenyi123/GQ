import { createHmac, timingSafeEqual } from "crypto";

export function signPayload(body: string | Buffer, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyHmac(
  body: string | Buffer,
  signature: string,
  secret: string,
) {
  const expected = signPayload(body, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
