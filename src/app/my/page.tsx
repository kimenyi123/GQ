"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Button,
  CitizenShell,
  Field,
  StatusChip,
  apiJson,
  inputClass,
  useI18n,
} from "@/components/design";

type Row = {
  gqId: string;
  status: string;
  tin: string;
  mrc?: string | null;
  docRef?: string | null;
  amount?: number | null;
  scanTs: string;
  deliveredVia?: string | null;
};

type OtpResponse = { debugCode?: string };
type TokenResponse = { token: string };

function MyRequestsInner() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("+250788000001");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  async function loadRequests(token?: string) {
    const jwt = token ?? sessionStorage.getItem("gq_citizen_jwt");
    if (!jwt) {
      setAuthed(false);
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<Row[]>("/api/v1/my/requests", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setRows(data);
      setAuthed(true);
      setMessage(data.length ? "" : t("my.empty"));
    } catch (error) {
      setAuthed(false);
      setMessage(error instanceof Error ? error.message : t("menu.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadRequests().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setMessage(error instanceof Error ? error.message : t("menu.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndLoad() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiJson<TokenResponse>("/api/v1/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code: otp || debugOtp || "123456" }),
      });
      sessionStorage.setItem("gq_citizen_jwt", data.token);
      sessionStorage.setItem("gq_role", "citizen");
      await loadRequests(data.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("menu.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-[1.5px] text-gold">
        {t("askTitle")}
      </p>
      <h1 className="text-center text-3xl font-extrabold text-navy">{t("my.title")}</h1>
      <p className="mt-3 text-center text-sm text-muted">{t("my.subtitle")}</p>

      {!authed ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">{t("phoneHint")}</p>
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
          <Button variant="ghost" className="w-full py-3 text-[15px]" onClick={issueOtp} disabled={busy}>
            {t("otpSend")}
          </Button>
          <Button variant="primary" className="w-full" onClick={verifyAndLoad} disabled={busy}>
            {t("my.viewRequests")}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-navy">
              {rows.length} {t("my.count")}
            </p>
            <button type="button" className="text-sm font-bold text-muted" onClick={() => loadRequests()}>
              {t("my.refresh")}
            </button>
          </div>
          {rows.map((row) => (
            <div key={row.gqId} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold text-navy">{row.gqId}</p>
                  <p className="mt-1 text-sm text-muted">
                    {row.docRef ?? "—"} · {row.mrc ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">{new Date(row.scanTs).toLocaleString()}</p>
                </div>
                <StatusChip status={row.status} />
              </div>
              {row.amount != null ? (
                <p className="mt-2 font-mono text-sm font-bold text-ink">RWF {row.amount}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                <Link href={`/r/${row.gqId}`} className="text-navy">
                  {t("trackStatus")}
                </Link>
                <Link href={`/i/${row.gqId}`} className="text-emerald">
                  {t("viewInvoice")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {message ? <p className="mt-5 text-center text-sm text-muted">{message}</p> : null}

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm font-bold text-navy">
          ← {t("askTitle")}
        </Link>
      </div>
    </>
  );
}

export default function MyRequestsPage() {
  return (
    <CitizenShell>
      <MyRequestsInner />
    </CitizenShell>
  );
}
