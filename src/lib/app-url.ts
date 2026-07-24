/** Canonical citizen app URL — encoded inside MoMo / GQ3 sticker QRs. */
export const DEFAULT_PUBLIC_APP_URL = "https://ebm.rw";

export const APP_URL_PRESETS = [
  { id: "live", label: "Live ebm.rw", url: "https://ebm.rw" },
  { id: "test", label: "Test LAN", url: "http://192.168.1.64:3000" },
] as const;

const LAN_HOST_RE =
  /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

export function isLanAppUrl(url: string) {
  try {
    const host = new URL(url).host;
    return LAN_HOST_RE.test(host);
  } catch {
    return false;
  }
}

/** Never encode a laptop LAN IP in stickers when live URL is ebm.rw. */
export function coercePublicAppUrl(url: string) {
  const cleaned = url.replace(/\/$/, "");
  if (!isLanAppUrl(cleaned)) return cleaned;

  const envDefault = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL).replace(/\/$/, "");
  const forceLive =
    process.env.GQ_FORCE_EBM_URL === "1" ||
    process.env.NODE_ENV === "production" ||
    envDefault === DEFAULT_PUBLIC_APP_URL;

  if (forceLive && process.env.GQ_ALLOW_LAN_URL !== "1") {
    return DEFAULT_PUBLIC_APP_URL;
  }
  return cleaned;
}

export function resolvePublicAppUrl(override?: string) {
  const raw = override?.trim() || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL;
  return coercePublicAppUrl(raw.replace(/\/$/, ""));
}

export function matchAppUrlPreset(url: string) {
  const norm = resolvePublicAppUrl(url);
  return APP_URL_PRESETS.find((p) => resolvePublicAppUrl(p.url) === norm)?.id ?? null;
}
