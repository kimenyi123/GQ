export type GqTrackEvent = {
  ts: string;
  type: string;
  data?: Record<string, unknown>;
  message?: string;
};

const MAX_EVENTS = 80;
const SESSION_KEY = "gq:track:session";

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `gq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const buffer: GqTrackEvent[] = [];

export function gqTrack(type: string, data?: Record<string, unknown>, message?: string) {
  const event: GqTrackEvent = {
    ts: new Date().toISOString(),
    type,
    data,
    message,
  };
  buffer.unshift(event);
  if (buffer.length > MAX_EVENTS) buffer.length = MAX_EVENTS;
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.info("[GQ track]", type, data ?? "", message ?? "");
  }
}

export function gqTrackError(type: string, error: unknown, data?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  gqTrack(type, { ...data, error: message }, message);
}

export function gqExportDebugLog() {
  const payload = {
    app: "GLOBAL_QR",
    sessionId: sessionId(),
    exportedAt: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    events: [...buffer].reverse(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function gqShareDebugLog(): Promise<"copied" | "failed"> {
  const text = gqExportDebugLog();
  try {
    await navigator.clipboard.writeText(text);
    gqTrack("debug.shared", { bytes: text.length });
    return "copied";
  } catch {
    return "failed";
  }
}

export function gqEventCount() {
  return buffer.length;
}
