"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  CitizenShell,
  DEMO_DOC,
  DEMO_MRC,
  DEMO_TIN,
  Field,
  apiJson,
  inputClass,
  useI18n,
} from "@/components/design";
import { QrCameraScanner, decodeQrFromFile } from "@/components/QrCameraScanner";
import { PaymentGatewaySheet } from "@/components/PaymentGatewaySheet";
import { buildIhuteShopUrl, SHOP_PRODUCT_GROUPS, SHOP_SECTOR_PRESETS, shopGroupLabel } from "@/lib/ihute-shop";
import { saveMomoCheckout } from "@/lib/momo-payment";
import {
  buildPaymentRails,
  buildRailUssd,
  type PaymentRail,
} from "@/lib/payment-gateway";
import { readScanContext } from "@/lib/scan-context";
import { DEMO_CITIZEN_PHONE, DEMO_OTP_CODE } from "@/lib/demo-auth";
import { gqTrack, gqTrackError } from "@/lib/gq-tracker";
import { parseInvoiceImageFile } from "@/lib/invoice-ocr";
import { parseInvoiceReceiptText, type ParsedInvoiceReceipt } from "@/lib/invoice-receipt";
import { parseQrPayload, extractGq3PayloadFromScan } from "@/lib/qr";

type Mode = "landing" | "scan" | "code" | "invoice" | "momo" | "otp";
type EntryChannel = "QR" | "TYPED" | "INVOICE" | "MOMO";
type ParsedPayload = { version: string; tin: string; mrc: string; docRef?: string; momoCode?: string; name?: string };
type ResolvedCode = { sellerName?: string; tin: string; amount?: number; docRef: string; mrc?: string };
type CreatedRequest = { gqId: string; status: string; eta: string };
type OtpResponse = { expiresIn: number; debugCode?: string };

function parsePayload(value: string): ParsedPayload {
  const parsed = parseQrPayload(value);
  if (parsed.version === "GQ3") {
    return {
      version: "GQ3",
      tin: parsed.tin,
      mrc: parsed.mrc,
      momoCode: parsed.momoCode,
      name: parsed.name,
    };
  }
  if (parsed.version === "GQ1") {
    return { version: "GQ1", tin: parsed.tin, mrc: parsed.mrc };
  }
  return { version: "GQ2", tin: parsed.tin, mrc: parsed.mrc, docRef: parsed.docRef };
}

function IconQr() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconKeyboard() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M8 3h8l2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5l2-2z" />
      <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function IconMomo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10 18h4" strokeLinecap="round" />
      <path d="M9 6h6M9 9h4" strokeLinecap="round" />
      <circle cx="17" cy="7" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EntryGrid({
  items,
}: {
  items: { id: string; label: string; icon: ReactNode; onClick: () => void }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex min-h-[108px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-4 text-center shadow-sm transition hover:border-emerald/40 hover:bg-emerald/[0.03] active:scale-[0.98]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-navy">{item.icon}</span>
          <span className="text-[13px] font-bold leading-tight text-navy">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function HomeInner() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("landing");
  const [entryChannel, setEntryChannel] = useState<EntryChannel>("QR");
  const [showManual, setShowManual] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [payload, setPayload] = useState(`GQ2|${DEMO_TIN}|${DEMO_MRC}|${new Date().toISOString()}|${DEMO_DOC}`);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [code, setCode] = useState(DEMO_DOC);
  const [resolved, setResolved] = useState<ResolvedCode | null>(null);
  const [phone, setPhone] = useState(DEMO_CITIZEN_PHONE);
  const [isB2b, setIsB2b] = useState(false);
  const [buyerTin, setBuyerTin] = useState("");
  const [myAmount, setMyAmount] = useState("");
  const [paymentSms, setPaymentSms] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [momoCode, setMomoCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [invoiceTin, setInvoiceTin] = useState("");
  const [invoiceDocRef, setInvoiceDocRef] = useState("");
  const [otp, setOtp] = useState(DEMO_OTP_CODE);
  const [debugOtp, setDebugOtp] = useState(DEMO_OTP_CODE);
  const [verified, setVerified] = useState(false);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [geo, setGeo] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Africa/Kigali");
  const [scanPayables, setScanPayables] = useState<PaymentRail[]>([]);
  const [shopNickname, setShopNickname] = useState("");
  const [shopGroup, setShopGroup] = useState<"" | "imiti" | "ibiryo">("");
  const [showPaySheet, setShowPaySheet] = useState(false);

  useEffect(() => {
    gqTrack("app.session", {
      path: window.location.pathname,
      search: window.location.search,
    });
  }, []);

  useEffect(() => {
    gqTrack("mode.change", { mode, entryChannel });
  }, [mode, entryChannel]);

  useEffect(() => {
    const ctx = readScanContext(window.location.search);
    const raw = ctx.payload ?? new URLSearchParams(window.location.search).get("payload")?.trim();
    if (!raw || !raw.startsWith("GQ3|")) return;
    try {
      const next = parsePayload(raw);
      setPayload(raw);
      setParsed(next);
      setMerchantName(next.name ?? "");
      setMomoCode(next.momoCode ?? "");
      setScanPayables(ctx.payables);
      setShopNickname(ctx.shopNickname);
      setShopGroup(ctx.shopGroup);
      if (ctx.shopGroup) setItemName(shopGroupLabel(ctx.shopGroup));
      setEntryChannel("MOMO");
      setMode("momo");
      setMessage(t("qrConfirmed"));
    } catch {
      /* ignore bad deep link */
    }
  }, [t]);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Kigali");
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => setGeo(null),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  function reset() {
    setMode("landing");
    setEntryChannel("QR");
    setShowManual(false);
    setShowPasteFallback(false);
    setPhotoBusy(false);
    setParsed(null);
    setResolved(null);
    setVerified(false);
    setCreated(null);
    setMessage("");
    setOtp("");
    setMerchantName("");
    setMomoCode("");
    setItemName("");
    setUnitPrice("");
    setQuantity("1");
    setInvoiceTin("");
    setInvoiceDocRef("");
  }

  const momoDigits = momoCode.replace(/\D/g, "");
  const lineTotal = useMemo(() => {
    const p = Number(unitPrice.replace(",", "."));
    const q = Number(quantity.replace(",", "."));
    if (!Number.isFinite(p) || !Number.isFinite(q) || p < 0 || q < 1) return 0;
    return Math.round(p * q);
  }, [unitPrice, quantity]);
  const payAmount = lineTotal > 0 ? lineTotal : Number(myAmount) || 0;

  const payRails = useMemo(
    () => buildPaymentRails(momoDigits, scanPayables),
    [momoDigits, scanPayables],
  );

  function completeMomoPay(rail: PaymentRail) {
    const gq3: ParsedPayload = {
      version: "GQ3",
      tin: parsed?.tin ?? DEMO_TIN,
      mrc: parsed?.mrc ?? DEMO_MRC,
      momoCode: momoDigits,
      name: merchantName.trim(),
    };
    const gq3Payload =
      parsed?.version === "GQ3"
        ? payload
        : `GQ3|${gq3.tin}|${gq3.mrc}|${momoDigits}|${merchantName.trim()}`;

    if (parsed?.version !== "GQ3") {
      setParsed(gq3);
      setPayload(gq3Payload);
    }

    const ussd = buildRailUssd(rail, lineTotal);
    saveMomoCheckout({
      payload: gq3Payload,
      merchantName: merchantName.trim(),
      momoCode: momoDigits,
      itemName: itemName.trim(),
      unitPrice: Number(unitPrice.replace(",", ".")) || lineTotal,
      quantity: Number(quantity.replace(",", ".")) || 1,
      totalRwf: lineTotal,
      ussd,
      tin: gq3.tin,
      mrc: gq3.mrc,
      phone,
      geo,
      timezone,
      paymentProvider: rail.provider,
      paymentCode: rail.code,
    });

    setShowPaySheet(false);
    setEntryChannel("MOMO");
    router.push("/pay/confirm");
  }

  function startMomoPay() {
    if (lineTotal < 1 || !itemName.trim() || !merchantName.trim() || momoDigits.length < 6) return;
    if (payRails.length > 1) {
      setShowPaySheet(true);
      return;
    }
    const rail =
      payRails[0] ??
      ({
        id: "momo",
        provider: "MTN MoMo",
        code: momoDigits,
        pillBg: "#F5B800",
        pillText: "#1a1a1a",
      } satisfies PaymentRail);
    completeMomoPay(rail);
  }

  function applyInvoiceFields(parsed: ParsedInvoiceReceipt, source: "photo" | "paste" | "demo") {
    const applied: Record<string, unknown> = { source };
    if (parsed.merchantName) {
      setMerchantName(parsed.merchantName);
      applied.merchantName = parsed.merchantName;
    }
    if (parsed.tin) {
      setInvoiceTin(parsed.tin);
      applied.tin = parsed.tin;
    }
    if (parsed.momoCode) {
      setMomoCode(parsed.momoCode);
      applied.momoCode = parsed.momoCode;
    }
    if (parsed.docRef) {
      setInvoiceDocRef(parsed.docRef);
      setCode(parsed.docRef);
      applied.docRef = parsed.docRef;
    }
    if (parsed.itemsSummary) {
      setItemName(parsed.itemsSummary);
      applied.itemsSummary = parsed.itemsSummary;
    }
    if (parsed.totalRwf) {
      setUnitPrice(String(parsed.totalRwf));
      setQuantity("1");
      setMyAmount(String(parsed.totalRwf));
      applied.totalRwf = parsed.totalRwf;
    }
    gqTrack("invoice.apply", {
      source,
      applied,
      missing: {
        tin: !parsed.tin,
        total: !parsed.totalRwf,
        items: !parsed.itemsSummary,
      },
    });
    setEntryChannel("INVOICE");
  }

  async function decodeInvoicePhoto(file: File) {
    setPhotoBusy(true);
    setMessage("Turimo gusoma fagitire…");
    gqTrack("invoice.photo_selected", { name: file.name, size: file.size });
    try {
      const { parsed, ocrQuality } = await parseInvoiceImageFile(file);
      if (!ocrQuality.trusted) {
        gqTrack("invoice.rejected_low_quality", ocrQuality);
        setMessage(
          "Ifoto ntiyasome neza — gerageza urumuri runini, fata ifoto yegeranye, cyangwa wandike ubutumwa hepfo.",
        );
        return;
      }
      applyInvoiceFields(parsed, "photo");
      setMessage("Fagitire yasomwe — reba ibisobanuro hepfo.");
    } catch (error) {
      gqTrackError("invoice.photo_failed", error);
      setMessage("Ntitwasoboye gusoma ifoto — shyira ubutumwa hepfo cyangwa ukande demo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function pasteInvoiceText(text: string, source: "paste" | "demo" = "paste") {
    const parsed = parseInvoiceReceiptText(text);
    gqTrack("invoice.parsed", {
      source,
      merchantName: parsed.merchantName,
      tin: parsed.tin,
      momoCode: parsed.momoCode,
      docRef: parsed.docRef,
      totalRwf: parsed.totalRwf,
      itemsSummary: parsed.itemsSummary,
      textPreview: text.slice(0, 400),
    });
    applyInvoiceFields(parsed, source);
    setMessage("Fagitire yasomwe — reba ibisobanuro hepfo.");
  }

  async function submitInvoiceEbm() {
    const total = lineTotal > 0 ? lineTotal : Number(myAmount) || 0;
    if (!merchantName.trim() || total < 1) return;
    setBusy(true);
    setMessage("");
    try {
      if (!verified) {
        await apiJson("/api/v1/otp/issue", { method: "POST", body: JSON.stringify({ phone }) });
        const data = await apiJson<{ token: string }>("/api/v1/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code: otp || debugOtp || DEMO_OTP_CODE }),
        });
        sessionStorage.setItem("gq_citizen_jwt", data.token);
        setVerified(true);
      }
      const body = invoiceDocRef.trim()
        ? {
            phone,
            code: invoiceDocRef.trim(),
            channel: "INVOICE" as const,
            geo: geo ?? undefined,
            timezone,
            myAmount: total,
            declaredAmount: total,
            items: JSON.stringify([{ name: itemName.trim() || "Invoice line", qty: 1, total }]),
          }
        : {
            phone,
            payload: `GQ1|${invoiceTin || DEMO_TIN}|${DEMO_MRC}|${new Date().toISOString()}`,
            channel: "INVOICE" as const,
            geo: geo ?? undefined,
            timezone,
            myAmount: total,
            declaredAmount: total,
            items: JSON.stringify([{ name: itemName.trim() || merchantName.trim(), qty: 1, total }]),
          };
      const created = await apiJson<CreatedRequest>("/api/v1/requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("gq_citizen_jwt") ?? ""}` },
        body: JSON.stringify(body),
      });
      setCreated(created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function decodePhoto(file: File, onQr: (text: string) => void) {
    setPhotoBusy(true);
    setMessage(t("scanDetecting"));
    try {
      const text = await decodeQrFromFile(file);
      onQr(text);
    } catch {
      setMessage(t("scanNotFound"));
    } finally {
      setPhotoBusy(false);
    }
  }

  function goLanding() {
    setMode("landing");
    setShowManual(false);
    setMessage("");
  }

  const tryParse = useCallback(
    (value = payload) => {
      try {
        const ctx = readScanContext(value);
        const gq3 = extractGq3PayloadFromScan(value);
        const normalized = gq3 ?? value.trim();
        const next = parsePayload(normalized);
        setPayload(normalized);
        setParsed(next);
        setResolved(null);
        setShowPasteFallback(false);
        if (next.version === "GQ3") {
          setMerchantName(next.name ?? "");
          setMomoCode(next.momoCode ?? "");
          setScanPayables(ctx.payables);
          setShopNickname(ctx.shopNickname);
          setShopGroup(ctx.shopGroup);
          if (ctx.shopGroup) setItemName(shopGroupLabel(ctx.shopGroup));
          setEntryChannel("MOMO");
          setMode("momo");
        } else {
          setMode("otp");
        }
        setMessage(t("qrConfirmed"));
      } catch {
        setParsed(null);
        setMessage(t("invalidQr"));
      }
    },
    [payload, t],
  );

  const onCameraScan = useCallback(
    (text: string) => {
      tryParse(text.trim());
    },
    [tryParse],
  );

  async function resolveCode() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiJson<ResolvedCode>(`/api/v1/resolve/${encodeURIComponent(code)}`);
      setResolved(data);
      setParsed(null);
      setMode("otp");
      setMessage(t("codeFound"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("codeNotFound"));
    } finally {
      setBusy(false);
    }
  }

  async function issueOtp() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiJson<OtpResponse>("/api/v1/otp/issue", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setDebugOtp(data.debugCode ?? DEMO_OTP_CODE);
      setMessage(t("otpSent"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiJson<{ token: string }>("/api/v1/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code: otp || debugOtp || DEMO_OTP_CODE }),
      });
      sessionStorage.setItem("gq_citizen_jwt", data.token);
      setVerified(true);
      setMessage(t("phoneVerified"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    setBusy(true);
    setMessage("");
    try {
      if (!verified) {
        const data = await apiJson<{ token: string }>("/api/v1/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code: otp || debugOtp || DEMO_OTP_CODE }),
        });
        sessionStorage.setItem("gq_citizen_jwt", data.token);
        setVerified(true);
      }
      const channel = entryChannel;
      const body = parsed
        ? {
            phone,
            payload,
            channel,
            geo: geo ?? undefined,
            timezone,
            buyerTin: isB2b && buyerTin ? buyerTin : undefined,
            myAmount: payAmount > 0 ? payAmount : myAmount ? Number(myAmount) : undefined,
            paymentSms: paymentSms || undefined,
          }
        : {
            phone,
            code: resolved?.docRef ?? code,
            channel,
            geo: geo ?? undefined,
            timezone,
            buyerTin: isB2b && buyerTin ? buyerTin : undefined,
            myAmount: payAmount > 0 ? payAmount : myAmount ? Number(myAmount) : undefined,
            paymentSms: paymentSms || undefined,
          };
      const data = await apiJson<CreatedRequest>("/api/v1/requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("gq_citizen_jwt") ?? ""}` },
        body: JSON.stringify(body),
      });
      setCreated(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const order = resolved?.docRef ?? parsed?.docRef ?? code;
    return (
      <div className="animate-[fade_0.3s_ease]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2 bg-emerald px-[18px] py-3.5 text-[13px] font-bold text-white">
            <span>✓</span>
            <span>{t("received")}</span>
          </div>
          <div className="p-[18px]">
            <div className="flex justify-between border-b border-line py-2.5 text-sm first:border-0">
              <span className="text-muted">{t("gqNumber")}</span>
              <span className="font-mono font-bold">{created.gqId}</span>
            </div>
            <div className="flex justify-between border-b border-line py-2.5 text-sm">
              <span className="text-muted">{t("orderRef")}</span>
              <span className="font-mono font-bold">{order}</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted">{t("statusLabel")}</span>
              <span className="font-mono font-bold text-gold">{t("pending")}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t("pendingMsg")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Link href={`/r/${created.gqId}`} className="text-center text-sm font-bold text-navy">
            {t("trackStatus")}
          </Link>
          <Link href={`/i/${created.gqId}`} className="text-center text-sm font-bold text-navy">
            {t("viewInvoice")}
          </Link>
          <Link href="/report" className="text-center text-sm font-bold text-muted">
            {t("reportProblem")}
          </Link>
          <button type="button" onClick={reset} className="w-full py-2.5 text-sm font-bold text-navy">
            {t("askAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-7 text-center text-sm font-extrabold uppercase tracking-[1.5px] text-gold">
        {t("askTitle")}
      </p>

      {mode === "landing" ? (
        <>
          <EntryGrid
            items={[
              {
                id: "scan",
                label: t("scanQr"),
                icon: <IconQr />,
                onClick: () => {
                  setEntryChannel("QR");
                  setMode("scan");
                  setShowManual(false);
                  setShowPasteFallback(false);
                  setMessage("");
                },
              },
              {
                id: "code",
                label: t("typeCode"),
                icon: <IconKeyboard />,
                onClick: () => {
                  setEntryChannel("TYPED");
                  setMode("code");
                  setShowManual(true);
                  setMessage("");
                },
              },
              {
                id: "invoice",
                label: t("photoInvoice"),
                icon: <IconReceipt />,
                onClick: () => {
                  setEntryChannel("INVOICE");
                  setMode("invoice");
                  setShowManual(true);
                  setMessage("");
                },
              },
              {
                id: "momo",
                label: t("photoMomo"),
                icon: <IconMomo />,
                onClick: () => {
                  setEntryChannel("MOMO");
                  setMode("momo");
                  setShowManual(false);
                  setMessage("");
                },
              },
            ]}
          />
        </>
      ) : null}

      {mode !== "landing" && mode !== "otp" ? (
        <button type="button" onClick={goLanding} className="mb-3 mt-1 text-sm font-bold text-muted">
          ← {t("entryBack")}
        </button>
      ) : null}
      {mode === "invoice" ? (
        <div className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={photoBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void decodeInvoicePhoto(file);
                e.target.value = "";
              }}
            />
            <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] bg-navy py-4 text-[15px] font-bold text-white">
              <IconReceipt />
              {photoBusy ? "Turimo gusoma…" : t("scanTakePhoto")}
            </span>
          </label>
          <Field label="Cyangwa wandike ubutumwa bwa fagitire">
            <textarea
              className={`${inputClass} min-h-20`}
              placeholder="Koporora ibisobanuro bya fagitire hano…"
              onBlur={(e) => {
                if (e.target.value.trim().length > 20) pasteInvoiceText(e.target.value);
              }}
            />
          </Field>
          <button
            type="button"
            className="w-full rounded-xl border border-line py-2 text-xs font-bold text-muted"
            onClick={() =>
              pasteInvoiceText(
                "FILINI RESTAURANT\nTIN NO: 106609344\nMOMO CODE: 024291\nCHK 43881\nTOTAL AMOUNT\n156,000.00 RWF",
                "demo",
              )
            }
          >
            Demo: Filini receipt
          </button>
          <Field label="Ndagura kuri">
            <input
              className={inputClass}
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="FILINI RESTAURANT"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TIN">
              <input
                className={inputClass}
                value={invoiceTin}
                onChange={(e) => setInvoiceTin(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Doc / CHK">
              <input
                className={inputClass}
                value={invoiceDocRef}
                onChange={(e) => setInvoiceDocRef(e.target.value)}
                placeholder="CHK43881"
              />
            </Field>
          </div>
          <Field label="Kode ya MoMo (optional)">
            <input
              className={inputClass}
              value={momoCode}
              onChange={(e) => setMomoCode(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Ibyo ndagura">
            <input
              className={inputClass}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Igiciro (RWF)">
              <input
                className={inputClass}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Ingano">
              <input
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={busy || !merchantName.trim() || lineTotal < 1}
            onClick={() => void submitInvoiceEbm()}
          >
            {lineTotal > 0 ? `Saba EBM · ${lineTotal.toLocaleString()} RWF` : "Saba EBM"}
          </Button>
        </div>
      ) : null}

      {mode === "momo" ? (
        <div className="space-y-3">
          <Field label="Ndagura kuri">
            <input
              className={inputClass}
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              readOnly={parsed?.version === "GQ3"}
              placeholder="IMPACT PHARMA LTD"
            />
          </Field>
          <Field label="Kode ya MoMo">
            <input
              className={inputClass}
              value={momoCode}
              onChange={(e) => setMomoCode(e.target.value)}
              readOnly={parsed?.version === "GQ3"}
              inputMode="numeric"
              placeholder="077800"
            />
          </Field>
          {parsed ? (
            <div className="rounded-2xl border border-line bg-white p-4 text-sm">
              <p className="text-muted">TIN · MRC</p>
              <p className="font-mono font-bold text-navy">
                {parsed.tin} · {parsed.mrc}
              </p>
            </div>
          ) : null}
          {shopNickname ? (
            <a
              href={buildIhuteShopUrl(shopNickname)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border-2 border-gold bg-gold/15 px-4 py-4 text-center shadow-sm transition active:scale-[0.99]"
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Shop to</span>
              <span className="mt-1 block text-base font-black leading-tight text-navy">
                ihute.rw/shop-with-me/{shopNickname}
              </span>
            </a>
          ) : null}
          <Field label="Ibyo ndagura">
            <input
              className={inputClass}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Paracetamol, umuceri, …"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Igiciro (RWF)">
              <input
                className={inputClass}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Ingano">
              <input
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={busy || !merchantName.trim() || momoDigits.length < 6 || lineTotal < 1 || !itemName.trim()}
            onClick={startMomoPay}
          >
            {lineTotal > 0 ? `PAY ${lineTotal.toLocaleString()} RWF` : "PAY — RWF"}
          </Button>
        </div>
      ) : null}

      {mode === "scan" ? (
        <>
          <QrCameraScanner
            onScan={onCameraScan}
            onCancel={() => {
              setMode("landing");
              setMessage("");
            }}
            labels={{
              aiming: t("scanAim"),
              cancel: t("scanCancel"),
              cameraError: t("scanCameraError"),
              fallback: t("scanFallback"),
              insecureHint: t("scanInsecureHint"),
              takePhoto: t("scanTakePhoto"),
              useLive: t("scanUseLive"),
              detecting: t("scanDetecting"),
              notFound: t("scanNotFound"),
            }}
          />
          <button
            type="button"
            className="mt-2 w-full rounded-[15px] border-[1.5px] border-emerald bg-emerald/10 py-3 text-sm font-bold text-emerald"
            onClick={() => tryParse(payload)}
          >
            {t("useDemoQr")}
          </button>
          <Link href="/demo-qr" className="mt-2 block text-center text-sm font-bold text-muted">
            {t("openDemoQr")}
          </Link>
          <button
            type="button"
            className="mt-2 w-full text-center text-sm font-bold text-muted"
            onClick={() => setShowPasteFallback((v) => !v)}
          >
            {t("pastePayload")}
          </button>
          {showPasteFallback ? (
            <div className="mt-3 space-y-3">
              <textarea
                className={`${inputClass} min-h-24`}
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
              />
              <Button variant="gold" className="w-full py-3 text-[15px]" onClick={() => tryParse()} disabled={busy}>
                {t("parseQr")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "code" || mode === "invoice" ? (
        <div className="mt-3.5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            {t("codeLabel")}
          </label>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LIV-901"
              onKeyDown={(e) => {
                if (e.key === "Enter") resolveCode();
              }}
            />
            <button
              type="button"
              className="rounded-[13px] bg-gold px-5 font-bold text-white"
              onClick={resolveCode}
              disabled={busy}
            >
              {t("go")}
            </button>
          </div>
          {resolved ? (
            <div className="mt-3 rounded-2xl border border-line bg-white p-4 text-sm">
              <p className="font-bold text-navy">{resolved.sellerName ?? resolved.tin}</p>
              <p className="font-mono text-muted">
                {resolved.docRef} · RWF {resolved.amount ?? 0}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {(parsed || resolved) && mode === "otp" ? (
        <div className="mt-5 space-y-3">
          {parsed ? (
            <div className="rounded-2xl border border-line bg-white p-4 text-sm">
              {parsed.version === "GQ3" ? (
                <>
                  <p className="font-bold text-navy">{parsed.name ?? merchantName}</p>
                  <p className="mt-1 font-mono text-muted">
                    MoMo {parsed.momoCode ?? momoCode} · TIN {parsed.tin} · MRC {parsed.mrc}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-muted">{t("sellerTin")}</p>
                  <p className="font-mono font-bold">{parsed.tin}</p>
                  <p className="mt-2 font-mono text-muted">MRC {parsed.mrc}</p>
                </>
              )}
            </div>
          ) : null}
          <p className="text-center text-sm text-muted">{t("phoneHint")}</p>
          <Field label={t("phoneLabel")}>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold text-navy">
            <input type="checkbox" checked={isB2b} onChange={(e) => setIsB2b(e.target.checked)} />
            B2B — I have a buyer TIN
          </label>
          {isB2b ? (
            <Field label="Buyer TIN">
              <input
                className={inputClass}
                value={buyerTin}
                onChange={(e) => setBuyerTin(e.target.value)}
                placeholder="Company TIN"
              />
            </Field>
          ) : null}
          <Field label="My amount (optional — fast treatment)">
            <input
              className={inputClass}
              value={myAmount}
              onChange={(e) => setMyAmount(e.target.value)}
              placeholder="What I paid / expect"
              inputMode="decimal"
            />
          </Field>
          <Field label="MoMo / Bank pay SMS (optional)">
            <textarea
              className={`${inputClass} min-h-20`}
              value={paymentSms}
              onChange={(e) => setPaymentSms(e.target.value)}
              placeholder="Paste payment SMS"
            />
          </Field>
          <p className="text-center text-[11px] text-muted">
            Scan meta: {timezone}
            {geo ? ` · GPS ${geo}` : " · GPS pending/denied"}
          </p>
          <Field label={t("otpLabel")}>
            <input
              className={inputClass}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder={debugOtp || DEMO_OTP_CODE}
            />
          </Field>
          {debugOtp ? (
            <p className="text-center text-sm text-muted">
              Demo OTP: <span className="font-mono font-bold">{debugOtp}</span>
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="w-full py-3 text-[15px]" onClick={issueOtp} disabled={busy}>
              {t("otpSend")}
            </Button>
            <Button variant="ghost" className="w-full py-3 text-[15px]" onClick={verifyOtp} disabled={busy}>
              {t("otpVerify")}
            </Button>
            <Button variant="primary" className="w-full" onClick={submitRequest} disabled={busy}>
              {t("submit")}
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-5 text-center text-sm leading-relaxed text-muted">{message}</p> : null}

      <PaymentGatewaySheet
        open={showPaySheet}
        amountRwf={lineTotal}
        merchantName={merchantName}
        rails={payRails}
        onPick={completeMomoPay}
        onClose={() => setShowPaySheet(false)}
      />
    </>
  );
}

export default function Home() {
  return (
    <CitizenShell>
      <HomeInner />
    </CitizenShell>
  );
}
