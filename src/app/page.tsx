"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { QrCameraScanner } from "@/components/QrCameraScanner";

type Mode = "landing" | "scan" | "code" | "otp";
type ParsedPayload = { version: string; tin: string; mrc: string; docRef?: string };
type ResolvedCode = { sellerName?: string; tin: string; amount?: number; docRef: string; mrc?: string };
type CreatedRequest = { gqId: string; status: string; eta: string };
type OtpResponse = { expiresIn: number; debugCode?: string };

function parsePayload(value: string): ParsedPayload {
  const parts = value.trim().split("|");
  if (parts[0] === "GQ1" && parts.length === 4) {
    return { version: "GQ1", tin: parts[1], mrc: parts[2] };
  }
  if (parts[0] === "GQ2" && parts.length === 5) {
    return { version: "GQ2", tin: parts[1], mrc: parts[2], docRef: parts[4] };
  }
  throw new Error("invalid");
}

function HomeInner() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("landing");
  const [showManual, setShowManual] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [payload, setPayload] = useState(`GQ2|${DEMO_TIN}|${DEMO_MRC}|${new Date().toISOString()}|${DEMO_DOC}`);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [code, setCode] = useState(DEMO_DOC);
  const [resolved, setResolved] = useState<ResolvedCode | null>(null);
  const [phone, setPhone] = useState("+250788000001");
  const [isB2b, setIsB2b] = useState(false);
  const [buyerTin, setBuyerTin] = useState("");
  const [myAmount, setMyAmount] = useState("");
  const [paymentSms, setPaymentSms] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [geo, setGeo] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Africa/Kigali");

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
    setShowManual(false);
    setShowPasteFallback(false);
    setParsed(null);
    setResolved(null);
    setVerified(false);
    setCreated(null);
    setMessage("");
    setOtp("");
  }

  const tryParse = useCallback(
    (value = payload) => {
      try {
        const next = parsePayload(value);
        setPayload(value);
        setParsed(next);
        setResolved(null);
        setMode("otp");
        setShowPasteFallback(false);
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
      setDebugOtp(data.debugCode ?? "123456");
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
        body: JSON.stringify({ phone, code: otp || debugOtp || "123456" }),
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
          body: JSON.stringify({ phone, code: otp || debugOtp || "123456" }),
        });
        sessionStorage.setItem("gq_citizen_jwt", data.token);
        setVerified(true);
      }
      const body = parsed
        ? {
            phone,
            payload,
            channel: "QR",
            geo: geo ?? undefined,
            timezone,
            buyerTin: isB2b && buyerTin ? buyerTin : undefined,
            myAmount: myAmount ? Number(myAmount) : undefined,
            paymentSms: paymentSms || undefined,
          }
        : {
            phone,
            code: resolved?.docRef ?? code,
            channel: "TYPED",
            geo: geo ?? undefined,
            timezone,
            buyerTin: isB2b && buyerTin ? buyerTin : undefined,
            myAmount: myAmount ? Number(myAmount) : undefined,
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
      <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-[1.5px] text-gold">
        {t("askTitle")}
      </p>
      <h1 className="text-center text-[40px] font-extrabold leading-[1.04] tracking-[-1px] text-navy">
        {t("askSubtitle")}
      </h1>
      <p className="mb-7 mt-3 text-center text-[15px] text-muted">{t("scanHint")}</p>

      {mode === "landing" || mode === "code" ? (
        <div className="flex flex-col gap-3">
          <Button
            variant="navy"
            className="w-full"
            onClick={() => {
              setMode("scan");
              setShowManual(false);
              setShowPasteFallback(false);
              setMessage("");
            }}
          >
            {t("scanQr")}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMode("code");
              setShowManual(true);
            }}
          >
            {t("typeCode")}
          </Button>
          <Link href="/demo-qr" className="text-center text-sm font-bold text-muted underline-offset-2 hover:underline">
            {t("openDemoQr")}
          </Link>
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

      {showManual || mode === "code" ? (
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
              <p className="text-muted">{t("sellerTin")}</p>
              <p className="font-mono font-bold">{parsed.tin}</p>
              <p className="mt-2 font-mono text-muted">MRC {parsed.mrc}</p>
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
              placeholder={debugOtp || "123456"}
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
