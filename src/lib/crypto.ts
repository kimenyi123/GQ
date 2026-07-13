import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const VERSION = "v1";

function getPhoneKey() {
  const raw = process.env.GQ_PHONE_KEY;

  if (!raw) {
    throw new Error("GQ_PHONE_KEY is required");
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptPhone(phone: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPhoneKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(phone, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptPhone(payload: string) {
  const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split(":");

  if (version !== VERSION || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted phone payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getPhoneKey(),
    Buffer.from(ivRaw, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
