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

/** Browser origin when dev server is on LAN — never localhost (phone cannot reach it). */
export function detectLanTestUrl(fallback = APP_URL_PRESETS[1].url) {
  if (typeof window === "undefined") return fallback;
  try {
    const { hostname, port, protocol } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return fallback;
    }
    const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`.replace(/\/$/, "");
    return isLanAppUrl(origin) ? origin : fallback;
  } catch {
    return fallback;
  }
}

export function isLocalhostUrl(url: string) {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function lanOverrideAllowed() {
  return process.env.GQ_ALLOW_LAN_URL === "1" || process.env.NODE_ENV !== "production";
}

/** Coerce env default away from LAN in production stickers — not explicit user overrides. */
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

/**
 * Resolve base URL for QR scan links.
 * When `override` is a LAN URL (sticker builder / test), honour it in dev.
 */
export function resolvePublicAppUrl(override?: string) {
  const explicit = override?.trim();
  const raw = (explicit || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL).replace(/\/$/, "");

  if (explicit && isLanAppUrl(raw) && lanOverrideAllowed()) {
    return raw;
  }

  if (!explicit) {
    return coercePublicAppUrl(raw);
  }

  return raw.replace(/\/$/, "");
}

export function matchAppUrlPreset(url: string, lanTestUrl?: string) {
  const norm = url.replace(/\/$/, "");
  const live = APP_URL_PRESETS[0].url;
  const test = (lanTestUrl ?? APP_URL_PRESETS[1].url).replace(/\/$/, "");

  if (norm === live || norm === DEFAULT_PUBLIC_APP_URL) return "live" as const;
  if (norm === test || isLanAppUrl(norm)) return "test" as const;
  return null;
}
