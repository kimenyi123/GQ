"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, Button, CitizenShell, Field, inputClass } from "@/components/design";
import { DEMO_OTP_CODE } from "@/lib/demo-auth";
import {
  buildMomoTelHref,
  clearMomoCheckout,
  loadMomoCheckout,
  parseMomoTransactionId,
  type MomoCheckout,
} from "@/lib/momo-payment";

type CreatedRequest = { gqId: string; status: string };

export default function PayConfirmPage() {
  const router = useRouter();
  const [checkout, setCheckout] = useState<MomoCheckout | null>(null);
  const [paymentSms, setPaymentSms] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialedRef = useRef(false);

  const submitEbm = useCallback(async () => {
    if (!checkout) return;
    setBusy(true);
    setError("");

    const sms = paymentSms.trim();
    const txnId = sms ? parseMomoTransactionId(sms) : null;

    try {
      await apiJson("/api/v1/otp/issue", {
        method: "POST",
        body: JSON.stringify({ phone: checkout.phone }),
      });
      const verify = await apiJson<{ token: string }>("/api/v1/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: checkout.phone, code: DEMO_OTP_CODE }),
      });
      sessionStorage.setItem("gq_citizen_jwt", verify.token);

      const created = await apiJson<CreatedRequest>("/api/v1/requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${verify.token}` },
        body: JSON.stringify({
          phone: checkout.phone,
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
  }, [checkout, paymentSms, router]);

  useEffect(() => {
    const draft = loadMomoCheckout();
    if (!draft) {
      setError("Nta gaciro y'ubwishyu. Subira inyuma usubiremo.");
      return;
    }
    setCheckout(draft);

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
        <h1 className="text-center text-lg font-black text-navy">Kwishyura na MoMo</h1>

        {checkout ? (
          <div className="rounded-2xl border border-line bg-white p-4 text-sm">
            <p className="font-bold text-navy">{checkout.merchantName}</p>
            <p className="mt-1 text-muted">
              {checkout.itemName} · <span className="font-mono font-bold">{checkout.totalRwf.toLocaleString()} RWF</span>
            </p>
            <p className="mt-2 break-all font-mono text-xs text-muted">{checkout.ussd}</p>
          </div>
        ) : null}

        <p className="text-center text-sm leading-relaxed text-muted">
          Emera kwishyura kuri MoMo. Ugarutse hano, ushobora gushyiraho SMS yemeza (si ngombwa) hanyuma ukande Saba EBM.
        </p>

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
            <Button variant="primary" className="w-full" disabled={busy} onClick={() => void submitEbm()}>
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

        <p className="text-center text-[11px] leading-relaxed text-muted">
          MTN API (background confirm) — bizaza nyuma. Ubu: kwishyura + SMS optional.
        </p>
      </div>
    </CitizenShell>
  );
}
