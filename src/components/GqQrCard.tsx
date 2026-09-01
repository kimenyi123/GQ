"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type Props = {
  payload?: string | null;
  scanUrl?: string | null;
  title?: string;
  subtitle?: string;
  size?: number;
};

/** Build buyer scan URL on this device (fixes localhost when till runs on phone LAN IP). */
export function resolveBuyerScanUrl(payload?: string | null, scanUrl?: string | null) {
  if (typeof window === "undefined") return scanUrl ?? "";
  const origin = window.location.origin;
  if (payload) {
    return `${origin}/client?payload=${encodeURIComponent(payload.trim())}`;
  }
  if (scanUrl) {
    if (scanUrl.includes("localhost") || scanUrl.includes("127.0.0.1")) {
      try {
        const u = new URL(scanUrl);
        const p = u.searchParams.get("payload");
        if (p) return `${origin}/client?payload=${encodeURIComponent(p)}`;
      } catch {
        /* fall through */
      }
    }
    return scanUrl.replace(/^https?:\/\/[^/]+/, origin);
  }
  return "";
}

export function GqQrCard({ payload, scanUrl, title, subtitle, size = 240 }: Props) {
  const [src, setSrc] = useState("");

  const url = useMemo(() => resolveBuyerScanUrl(payload, scanUrl), [payload, scanUrl]);

  useEffect(() => {
    if (!url) {
      setSrc("");
      return;
    }
    QRCode.toDataURL(url, { width: size, margin: 2, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url, size]);

  if (!url || !src) return null;

  return (
    <div className="rounded-2xl border-2 border-navy/20 bg-white p-4 text-center shadow-sm">
      {title ? <p className="text-sm font-black text-navy">{title}</p> : null}
      {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Scan for EBM" className="mx-auto mt-3 rounded-lg" width={size} height={size} />
      <p className="mt-3 break-all font-mono text-[10px] text-muted">{payload ?? url}</p>
      <a href={url} className="mt-2 inline-block text-xs font-bold text-emerald underline">
        Open client app
      </a>
    </div>
  );
}
