"use client";

import type { SmartStickerConfig } from "@/lib/smart-sticker";

const NAVY = "#1B4F8A";
const NAVY_DARK = "#153E6D";

function IshyigaMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <polygon points="22,4 38,12 38,32 22,40 6,32 6,12" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      <polygon points="22,8 34,14 34,30 22,36 10,30 10,14" fill="#F5B800" />
      <polygon points="22,12 30,16 30,28 22,32 14,28 14,16" fill="#22C55E" />
      <polygon points="22,16 26,18 26,26 22,28 18,26 18,18" fill="#0057A8" />
    </svg>
  );
}

function RraMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="#ffffff" fillOpacity="0.15" />
      <path d="M18 6 L24 12 L22 18 L18 22 L14 18 L12 12 Z" fill="#F97316" />
      <path d="M18 8 L22 13 L20 17 L18 19 L16 17 L14 13 Z" fill="#22C55E" />
      <path d="M18 10 L20 14 L19 16 L18 17 L17 16 L16 14 Z" fill="#3B82F6" />
    </svg>
  );
}

function RowIcon({ kind }: { kind: "mrc" | "momo" | "izina" }) {
  const paths = {
    mrc: "M6 20h20v8H6zm2-6h16l2 6H4l2-6zm4-4h8v4h-8V10z",
    momo: "M14 4h8a2 2 0 012 2v16a2 2 0 01-2 2h-8a2 2 0 01-2-2V6a2 2 0 012-2zm0 14h8",
    izina: "M6 10h20v4H6zm0 6h14v4H6z",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        height: 36,
        width: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: NAVY_DARK,
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2">
        <path d={paths[kind]} />
      </svg>
    </span>
  );
}

export function GqSmartSticker({
  config,
  qrSrc,
  id = "gq-smart-sticker",
}: {
  config: SmartStickerConfig;
  qrSrc: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      style={{
        width: 380,
        maxWidth: "100%",
        margin: "0 auto",
        background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
        borderRadius: 20,
        padding: "18px 16px 14px",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        boxShadow: "0 12px 40px rgba(0,0,0,.25)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IshyigaMark />
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.5 }}>{config.brandTop}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#4ADE80" }}>{config.brandBottom}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, textAlign: "right" }}>
          <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2, maxWidth: 72 }}>{config.certifiedBy}</div>
          <RraMark />
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          textAlign: "center",
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 0.5,
          lineHeight: 1.15,
        }}
      >
        <span>{config.scanWord} </span>
        <span style={{ color: "#F5B800" }}>{config.payWord} </span>
        <span style={{ color: "#4ADE80" }}>{config.buildWord}</span>
      </div>

      {/* Accounts payable — top */}
      <div
        style={{
          marginTop: 14,
          border: "2px solid rgba(255,255,255,.35)",
          borderRadius: 14,
          padding: "12px 10px",
          background: "rgba(0,0,0,.12)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
          {config.payables.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {i > 0 ? (
                <div style={{ width: 1, height: 36, background: "rgba(255,255,255,.35)", marginRight: 8 }} />
              ) : null}
              <div style={{ textAlign: "center", minWidth: 88 }}>
                <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 4 }}>{p.provider}</div>
                <div
                  style={{
                    display: "inline-block",
                    minWidth: 64,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: p.pillBg,
                    color: p.pillText,
                    fontWeight: 900,
                    fontSize: 16,
                    letterSpacing: 0.5,
                  }}
                >
                  {p.code}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 10, textAlign: "center", fontSize: 12, fontWeight: 700 }}>
          Izina : <span style={{ color: "#F5B800" }}>{config.payablesFooter}</span>
        </p>
        {config.extraNote ? (
          <p style={{ marginTop: 6, textAlign: "center", fontSize: 11, opacity: 0.9 }}>{config.extraNote}</p>
        ) : null}
      </div>

      {/* MRC / MoMo / Izina */}
      <div
        style={{
          marginTop: 12,
          background: "#fff",
          color: NAVY_DARK,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {(
          [
            { kind: "mrc" as const, label: "MRC", value: config.mrc },
            { kind: "momo" as const, label: "MOMO KODE", value: config.momoCode },
            { kind: "izina" as const, label: "IZINA", value: config.izina },
          ] as const
        ).map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr auto 1fr",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderTop: idx ? "1px solid #e5e7eb" : undefined,
            }}
          >
            <RowIcon kind={row.kind} />
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>{row.label}</div>
            <div style={{ width: 1, height: 28, background: "#d1d5db" }} />
            <div style={{ fontSize: 14, fontWeight: 800, textAlign: "right", wordBreak: "break-all" }}>{row.value}</div>
          </div>
        ))}
      </div>

      {/* QR */}
      <div
        style={{
          marginTop: 14,
          border: "4px solid #991B1B",
          borderRadius: 14,
          padding: "14px 14px 10px",
          background: "#fff",
          textAlign: "center",
        }}
      >
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt="GQ scan QR" style={{ width: 220, height: 220, display: "block", margin: "0 auto" }} />
        ) : null}
        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#991B1B",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span aria-hidden>📷</span>
          {config.cameraHint}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 14,
          borderTop: "1px solid rgba(255,255,255,.25)",
          paddingTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#F5B800" }}>{config.sabaTitle}</div>
          <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2, opacity: 0.9 }}>{config.sabaSubtitle}</div>
        </div>
        <div style={{ width: 1, height: 36, background: "rgba(255,255,255,.3)" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#F5B800" }}>🛒 {config.ihuteUrl}</div>
          <div style={{ fontSize: 8, fontWeight: 600, marginTop: 2, opacity: 0.85 }}>{config.ihuteTagline}</div>
        </div>
      </div>
    </div>
  );
}
