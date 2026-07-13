"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [payload, setPayload] = useState(`GQ2|${DEMO_TIN}|${DEMO_MRC}|${new Date().toISOString()}|${DEMO_DOC}`);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [code, setCode] = useState(DEMO_DOC);
  const [resolved, setResolved] = useState<ResolvedCode | null>(null);
  const [phone, setPhone] = useState("+250788000001");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function reset() {
    setMode("landing");
    setShowManual(false);
    setParsed(null);
    setResolved(null);
    setVerified(false);
    setCreated(null);
    setMessage("");
    setOtp("");
  }

  function tryParse(value = payload) {
    try {
      setParsed(parsePayload(value));
      setResolved(null);
      setMode("otp");
      setMessage(t("qrConfirmed"));
    } catch {
      setParsed(null);
      setMessage(t("invalidQr"));
    }
  }

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
      if (!verified) await verifyOtp();
      const body = parsed
        ? { phone, payload, channel: "QR" }
        : { phone, code: resolved?.docRef ?? code, channel: "TYPED" };
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

      {mode === "landing" || mode === "scan" || mode === "code" ? (
        <div className="flex flex-col gap-3">
          <Button variant="navy" className="w-full" onClick={() => { setMode("scan"); setShowManual(false); }}>
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
        </div>
      ) : null}

      {mode === "scan" ? (
        <div className="mt-3.5 space-y-3">
          <p className="text-xs text-muted">{t("pastePayload")}</p>
          <textarea
            className={`${inputClass} min-h-24`}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
          <Button variant="gold" className="w-full py-3 text-[15px]" onClick={() => tryParse()} disabled={busy}>
            {t("parseQr")}
          </Button>
          {parsed ? (
            <div className="rounded-2xl border border-line bg-white p-4 text-sm">
              <p className="text-muted">{t("sellerTin")}</p>
              <p className="font-mono font-bold">{parsed.tin}</p>
              <p className="mt-2 font-mono text-muted">MRC {parsed.mrc}</p>
            </div>
          ) : null}
        </div>
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
          <p className="text-center text-sm text-muted">{t("phoneHint")}</p>
          <Field label={t("phoneLabel")}>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
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
