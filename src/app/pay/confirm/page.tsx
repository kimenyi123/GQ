"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, Button, CitizenShell, Field, inputClass } from "@/components/design";
import { DEMO_CITIZEN_PHONE, DEMO_OTP_CODE, isOpenLoginClientHint } from "@/lib/demo-auth";
import {
  buildMomoTelHref,
  clearMomoCheckout,
  loadMomoCheckout,
  parseMomoTransactionId,
  type MomoCheckout,
} from "@/lib/momo-payment";

type CreatedRequest = { gqId: string; status: string };
type OtpResponse = { debugCode?: string };

export default function PayConfirmPage() {
  const router = useRouter();
  const [checkout, setCheckout] = useState<MomoCheckout | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [paymentSms, setPaymentSms] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialedRef = useRef(false);

  async function issueOtp() {
    if (!phone.trim()) {
      setError("Andika nimero ya telefoni.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiJson<OtpResponse>("/api/v1/otp/issue", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setDebugOtp(data.debugCode ?? DEMO_OTP_CODE);
      setOtp(data.debugCode ?? DEMO_OTP_CODE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP yanze");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone() {
    if (!phone.trim()) {
      setError("Andika nimero ya telefoni.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/v1/otp/issue", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      const verify = await apiJson<{ token: string }>("/api/v1/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code: otp || debugOtp || DEMO_OTP_CODE }),
      });
      sessionStorage.setItem("gq_citizen_jwt", verify.token);
      setVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Emeza OTP yanze");
      setVerified(false);
    } finally {
      setBusy(false);
    }
  }

  const submitEbm = useCallback(async () => {
    if (!checkout) return;
    if (!phone.trim()) {
      setError("Andika nimero ya telefoni kugira ngo twakugehere fagitire.");
      return;
    }
    if (!verified) {
      setError("Emeza telefoni yawe mbere yo gusaba EBM.");
      return;
    }

    setBusy(true);
    setError("");

    const sms = paymentSms.trim();
    const txnId = sms ? parseMomoTransactionId(sms) : null;
    const token = sessionStorage.getItem("gq_citizen_jwt");

    try {
      const created = await apiJson<CreatedRequest>("/api/v1/requests", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          phone,
          payload: checkout.payload,
          channel: "MOMO",
          geo: checkout.geo ?? undefined,
          timezone: checkout.timezone,
          myAmount: checkout.totalRwf,
          declaredAmount: checkout.totalRwf,
          ...(sms ? { paymentSms: sms } : {}),
          bank: "MOMO",
          ...(txnId ? { bankTxnId: txnId } : {}),
          bankAmount: checkout.totalRwf,
          items: JSON.stringify([
            {
              name: checkout.itemName,
              qty: checkout.quantity,
              price: checkout.unitPrice,
              total: checkout.totalRwf,
            },
          ]),
        }),
      });

      clearMomoCheckout();
      router.replace(`/r/${created.gqId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saba EBM yanze");
    } finally {
      setBusy(false);
    }
  }, [checkout, paymentSms, phone, router, verified]);

  useEffect(() => {
    const draft = loadMomoCheckout();
    if (!draft) {
      setError("Nta gaciro y'ubwishyu. Subira inyuma usubiremo.");
      return;
    }
    setCheckout(draft);
    if (draft.phone?.trim()) {
      setPhone(draft.phone);
    }

    if (!dialedRef.current) {
      dialedRef.current = true;
      const tel = buildMomoTelHref(draft.ussd);
      if (tel) {
        window.setTimeout(() => {
          window.location.href = tel;
        }, 500);
      }
    }
  }, []);

  const parsedTxn = paymentSms.trim() ? parseMomoTransactionId(paymentSms) : null;

  return (
    <CitizenShell>
      <div className="space-y-4">
        <h1 className="text-center text-lg font-black text-navy">
          {checkout?.paymentProvider ? `Kwishyura · ${checkout.paymentProvider}` : "Kwishyura na MoMo"}
        </h1>

        {checkout ? (
          <div className="rounded-2xl border border-line bg-white p-4 text-sm">
            <p className="font-bold text-navy">{checkout.merchantName}</p>
            <p className="mt-1 text-muted">
              {checkout.itemName} · <span className="font-mono font-bold">{checkout.totalRwf.toLocaleString()} RWF</span>
            </p>
            {checkout.paymentProvider ? (
              <p className="mt-2 text-xs font-bold text-emerald">
                {checkout.paymentProvider} · {checkout.paymentCode}
              </p>
            ) : null}
            <p className="mt-2 break-all font-mono text-xs text-muted">{checkout.ussd}</p>
          </div>
        ) : null}

        <p className="text-center text-sm leading-relaxed text-muted">
          Emera kwishyura kuri MoMo. Ugarutse hano, andika telefoni yawe, emeza OTP, hanyuma usabe EBM.
        </p>

        <p className="text-center text-sm text-muted">Nimero yawe ikoreshwa gusa mu kohereza fagitire.</p>
        <Field label="Telefoni">
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setVerified(false);
            }}
            inputMode="tel"
            placeholder={DEMO_CITIZEN_PHONE}
            autoComplete="tel"
          />
        </Field>
        <Field label="Kode OTP">
          <input
            className={inputClass}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder={debugOtp || DEMO_OTP_CODE}
          />
        </Field>
        {isOpenLoginClientHint() ? (
          <p className="text-center text-xs font-bold text-emerald-700">
            Demo OTP: {debugOtp || DEMO_OTP_CODE}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" className="w-full py-3 text-sm" disabled={busy} onClick={() => void issueOtp()}>
            Ohereza kode
          </Button>
          <Button
            variant="secondary"
            className="w-full py-3 text-sm"
            disabled={busy || verified}
            onClick={() => void verifyPhone()}
          >
            {verified ? "Byemejwe ✓" : "Emeza"}
          </Button>
        </div>

        <Field label="Shyiraho SMS ya MoMo (optional)">
          <textarea
            className={`${inputClass} min-h-24`}
            value={paymentSms}
            onChange={(e) => setPaymentSms(e.target.value)}
            placeholder="Koporora ubutumwa bwemeza bwa MoMo hano…"
          />
        </Field>

        {parsedTxn ? (
          <p className="text-center text-xs font-mono text-emerald">Txn ID: {parsedTxn}</p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {checkout ? (
          <>
            <Button
              variant="primary"
              className="w-full"
              disabled={busy || !verified || !phone.trim()}
              onClick={() => void submitEbm()}
            >
              {busy ? "Turimo kohereza…" : `Saba EBM · ${checkout.totalRwf.toLocaleString()} RWF`}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => {
                const tel = buildMomoTelHref(checkout.ussd);
                if (tel) window.location.href = tel;
              }}
            >
              Ongera uhamagare MoMo
            </Button>
          </>
        ) : null}

        <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
          Subira inyuma
        </Button>
      </div>
    </CitizenShell>
  );
}
