/** Canonical citizen app URL — encoded inside MoMo / GQ3 sticker QRs. */
export const DEFAULT_PUBLIC_APP_URL = "https://ebm.rw";

export function resolvePublicAppUrl(override?: string) {
  const raw = override?.trim() || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL;
  return raw.replace(/\/$/, "");
}
