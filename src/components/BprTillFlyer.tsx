"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { SimCartLine } from "@/lib/simulator-helpers";

/** BPR Bank Rwanda brand (flyer standard — replaces MoMo yellow). */
export const BPR_LIME = "#B5E61D";
export const BPR_LIME_DARK = "#9BCB00";
export const BPR_NAVY = "#002855";
export const BPR_GREEN = "#00A651";
export const BPR_MERCHANT_CODE = "3321";

function RraLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const heights = { sm: 44, md: 64 };
  const h = heights[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/rra-mark.png?v=2"
      alt="Rwanda Revenue Authority"
      style={{ height: h, width: "auto", maxWidth: 140, objectFit: "contain", display: "block" }}
    />
  );
}

function BprLogo() {
  return (
    <div
      style={{
        display: "inline-flex",
        overflow: "hidden",
        borderRadius: 4,
        fontWeight: 900,
        fontSize: 22,
        letterSpacing: 0.5,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          background: BPR_LIME,
          color: "#fff",
          padding: "8px 12px 8px 14px",
          clipPath: "polygon(0 0, 100% 0, 88% 100%, 0 100%)",
        }}
      >
        bpr
      </span>
      <span
        style={{
          background: BPR_NAVY,
          color: "#fff",
          padding: "8px 14px 8px 20px",
          marginLeft: -8,
        }}
      >
        BANK
      </span>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto 1fr",
        alignItems: "center",
        gap: 8,
        padding: "11px 14px",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span
        style={{
          display: "flex",
          height: 36,
          width: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          background: BPR_NAVY,
          color: "#fff",
          fontSize: 16,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color: BPR_NAVY, letterSpacing: 0.4 }}>{label}</span>
      <span style={{ width: 1, height: 24, background: "#d1d5db" }} />
      <span
        style={{
          fontSize: highlight ? 18 : 14,
          fontWeight: 900,
          color: highlight ? BPR_GREEN : BPR_NAVY,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export type BprTillFlyerProps = {
  tin: string;
  mrc: string;
  merchantName: string;
  bprMerchantCode?: string;
  amount: number;
  buyerName?: string;
  buyerTin?: string;
  qrScanUrl: string;
  status?: string;
  promoText?: string;
  items?: SimCartLine[];
};

export function BprTillFlyer({
  tin: _tin,
  mrc: _mrc,
  merchantName,
  bprMerchantCode = BPR_MERCHANT_CODE,
  amount,
  buyerName,
  buyerTin: _buyerTin,
  qrScanUrl,
  status,
  promoText: _promoText,
  items,
}: BprTillFlyerProps) {
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    if (!qrScanUrl) {
      setQrSrc("");
      return;
    }
    QRCode.toDataURL(qrScanUrl, { width: 240, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrSrc)
      .catch(() => setQrSrc(""));
  }, [qrScanUrl]);

  const paid = status === "PAID" || status === "STAMPED";

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        background: `linear-gradient(180deg, ${BPR_LIME} 0%, ${BPR_LIME_DARK} 100%)`,
        borderRadius: 0,
        padding: "16px 14px 18px",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        boxShadow: "0 8px 32px rgba(0,40,85,.15)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <BprLogo />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BPR_NAVY, lineHeight: 1.2 }}>In partnership with RRA</div>
          <RraLogo size="md" />
        </div>
      </div>

      {/* Headline — same rhythm as MoMo flyer */}
      <div style={{ marginTop: 16, textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: BPR_NAVY, letterSpacing: 0.3 }}>
          <span>SCAN. </span>
          <span style={{ color: BPR_GREEN }}>PAY. </span>
          <span>BUILD RWANDA</span>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 28,
            fontWeight: 900,
            color: BPR_NAVY,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Pay by BPR
        </div>
        {paid ? (
          <div
            style={{
              marginTop: 8,
              display: "inline-block",
              background: BPR_GREEN,
              color: "#fff",
              padding: "4px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            PAID ✓
          </div>
        ) : null}
      </div>

      {/* Merchant details — BPR code, name, amount (MRC/TIN hidden on customer flyer) */}
      <div
        style={{
          marginTop: 16,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,40,85,.08)",
        }}
      >
        <InfoRow icon="📱" label="BPR CODE" value={bprMerchantCode} />
        <InfoRow icon="👤" label="IZINA" value={merchantName || "Merchant"} />
        <InfoRow icon="💰" label="AMOUNT" value={`${amount.toLocaleString()} RWF`} highlight />
        {buyerName ? <InfoRow icon="🛒" label="BUYER" value={buyerName} /> : null}
      </div>

      {/* Order lines — compact */}
      {items && items.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            background: "rgba(255,255,255,.85)",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 12,
            color: BPR_NAVY,
          }}
        >
          {items.map((l) => (
            <div key={l.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>
                {l.qty}× {l.name}
              </span>
              <span style={{ fontWeight: 700 }}>{(l.qty * l.price).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* QR — customer scans for EBM + pay rail */}
      <div
        style={{
          marginTop: 14,
          border: `4px solid ${BPR_NAVY}`,
          borderRadius: 14,
          padding: 14,
          background: "#fff",
          textAlign: "center",
        }}
      >
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt="Scan to pay and request EBM" style={{ width: 240, height: 240, margin: "0 auto" }} />
        ) : (
          <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
            QR loading…
          </div>
        )}
      </div>
    </div>
  );
}

export function BprTillIdle() {
  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        background: `linear-gradient(180deg, ${BPR_LIME} 0%, ${BPR_LIME_DARK} 100%)`,
        padding: 24,
        textAlign: "center",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <BprLogo />
      <div style={{ marginTop: 12 }}>
        <RraLogo size="sm" />
      </div>
      <p style={{ marginTop: 20, fontSize: 22, fontWeight: 900, color: BPR_NAVY }}>Pay by BPR</p>
      <p style={{ marginTop: 8, fontSize: 14, color: BPR_NAVY, opacity: 0.85 }}>
        Waiting for cashier to send amount…
      </p>
      <p style={{ marginTop: 16, fontSize: 12, color: BPR_NAVY }}>Open ERP desk → Push to QR</p>
    </div>
  );
}
