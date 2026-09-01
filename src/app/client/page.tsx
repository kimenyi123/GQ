"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Field, apiJson, inputClass } from "@/components/design";
import { DEMO_CITIZEN_PHONE, DEMO_OTP_CODE, isOpenLoginClientHint } from "@/lib/demo-auth";
import { saveMomoCheckout } from "@/lib/momo-payment";
import { buildPaymentRails, buildRailUssd, dialRail, readPayablesFromLocation, type PaymentRail } from "@/lib/payment-gateway";
import { parseQrPayload } from "@/lib/qr";
import { defaultRwandaPayables } from "@/lib/rwanda-bank-payables";
import { SIM_PAYMENT_RAILS, simCartTotal, type SimCartLine } from "@/lib/simulator-helpers";

type DraftView = {
  docRef: string;
  status: string;
  tin: string;
  mrc: string;
  merchantName?: string | null;
  buyerTin?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  amount?: number | null;
  items?: SimCartLine[];
  gqPayload?: string | null;
  railCode?: string | null;
  railTxnId?: string | null;
};


function buildClientPayRails(extra: PaymentRail[]): PaymentRail[] {
  const momo = SIM_PAYMENT_RAILS.find((r) => r.code === "MTN_MOMO");
  const momoDigits = momo?.paidOn ?? "";
  const fromPay = buildPaymentRails(momoDigits, extra);
  const banks = defaultRwandaPayables().map((p) => ({
    id: p.id,
    provider: p.provider,
    code: p.code,
    pillBg: p.pillBg,
    pillText: p.pillText,
  }));

  const merged = new Map<string, PaymentRail>();
  for (const rail of [...fromPay, ...banks]) {
    merged.set(`${rail.provider}:${rail.code}`, rail);
  }

  const all = Array.from(merged.values());
  const bpr = all.find((r) => r.provider.toUpperCase().includes("BPR"));
  const rest = all.filter((r) => r !== bpr);
  return bpr ? [bpr, ...rest] : all;
}

function ClientInner() {
  const router = useRouter();
  const params = useSearchParams();
  const payloadParam = params.get("payload")?.trim() ?? "";

  const [phone, setPhone] = useState(DEMO_CITIZEN_PHONE);
  const [buyerTin, setBuyerTin] = useState("");
  const [isB2b, setIsB2b] = useState(false);
  const [paymentSms, setPaymentSms] = useState("");
  const [otp, setOtp] = useState(DEMO_OTP_CODE);
  const [debugOtp, setDebugOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [selectedRailId, setSelectedRailId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Africa/Kigali");

  const parsed = useMemo(() => {
    if (!payloadParam.startsWith("GQ2|")) return null;
    try {
      return parseQrPayload(payloadParam);
    } catch {
      return null;
    }
  }, [payloadParam]);

  const extraPayables = useMemo(
    () => (typeof window !== "undefined" ? readPayablesFromLocation(window.location.search) : []),
    [payloadParam],
  );

  const payRails = useMemo(() => buildClientPayRails(extraPayables), [extraPayables]);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Kigali");
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => setGeo(null),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    if (!parsed || parsed.version !== "GQ2") return;
    const docRef = parsed.docRef;
    apiJson<DraftView>(`/api/v1/drafts/${encodeURIComponent(docRef)}`)
      .then((d) => {
        setDraft(d);
        if (d.buyerTin) {
          setBuyerTin(d.buyerTin);
          setIsB2b(true);
        }
        if (d.buyerPhone) setPhone(d.buyerPhone);
      })
      .catch(() => setDraft(null));

    apiJson<DraftView>(`/api/v1/dev/web-erp/draft/${encodeURIComponent(docRef)}`)
      .then((rich) => {
        setDraft((prev) => ({ ...prev, ...rich, docRef: rich.docRef ?? docRef }));
        if (rich.buyerPhone) setPhone(rich.buyerPhone);
        if (rich.buyerTin) {
          setBuyerTin(rich.buyerTin);
          setIsB2b(true);
        }
      })
      .catch(() => {
        /* dev-only enrich */
      });
  }, [parsed]);

  useEffect(() => {
    const bpr = payRails.find((r) => r.provider.toUpperCase().includes("BPR"));
    if (bpr) setSelectedRailId(bpr.id);
  }, [payRails]);

  const items = draft?.items ?? [];
  const amount = draft?.amount ?? (items.length ? simCartTotal(items) : 0);
  const merchantName = draft?.merchantName?.trim() || "Merchant";
  const selectedRail = payRails.find((r) => r.id === selectedRailId) ?? payRails[0];
  const itemSummary =
    items.length > 0
      ? items.map((l) => `${l.qty}× ${l.name}`).join(", ")
      : `Order ${parsed?.docRef ?? ""}`;

  async function issueOtp() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiJson<{ debugCode?: string }>("/api/v1/otp/issue", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setDebugOtp(data.debugCode ?? DEMO_OTP_CODE);
      setOtp(data.debugCode ?? DEMO_OTP_CODE);
      setMessage("OTP sent");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "OTP failed");
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
      setMessage("Phone verified");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  function startPay() {
    if (!parsed || parsed.version !== "GQ2" || !selectedRail || amount < 1) return;
    if (!phone.trim()) {
      setMessage("Enter your phone number first");
      return;
    }
    const ussd = buildRailUssd(selectedRail, amount);
    saveMomoCheckout({
      payload: payloadParam,
      merchantName,
      momoCode: selectedRail.code,
      itemName: itemSummary,
      unitPrice: amount,
      quantity: 1,
      totalRwf: amount,
      ussd,
      tin: parsed.tin,
      mrc: parsed.mrc,
      phone,
      geo,
      timezone,
      paymentProvider: selectedRail.provider,
      paymentCode: selectedRail.code,
    });
    router.push("/pay/confirm");
  }

  async function requestEbm() {
    if (!parsed || parsed.version !== "GQ2") return;
    setBusy(true);
    setMessage("");
    try {
      if (!verified) {
        await apiJson("/api/v1/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code: otp || debugOtp || DEMO_OTP_CODE }),
        });
      }
      const token = sessionStorage.getItem("gq_citizen_jwt");
      const created = await apiJson<{ gqId: string; status: string }>("/api/v1/requests", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          phone,
          payload: payloadParam,
          buyerTin: isB2b && buyerTin ? buyerTin : undefined,
          channel: "QR",
          geo: geo ?? undefined,
          timezone,
          myAmount: amount,
          declaredAmount: amount,
          paymentSms: paymentSms || undefined,
          bank: selectedRail?.provider,
          bankTxnId: paymentSms ? undefined : undefined,
          bankAmount: amount,
          items: JSON.stringify(items),
        }),
      });
      setMessage(`Request ${created.gqId} — ${created.status}`);
      router.push(`/r/${created.gqId}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!parsed || parsed.version !== "GQ2") {
    return (
      <Card className="text-center text-sm text-muted">
        <p>Scan the QR on the till to open this client app.</p>
        <Link href="/" className="mt-2 inline-block font-bold text-navy underline">
          Full Saba EBM home
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Your order</p>
        <p className="text-base font-black text-navy">{merchantName}</p>
        <p className="text-sm text-muted">
          TIN {parsed.tin} · MRC {parsed.mrc}
        </p>
        <p className="text-xs text-muted">docRef {parsed.docRef}</p>
        {draft?.status ? (
          <p className="text-xs font-bold text-emerald">Status: {draft.status}</p>
        ) : null}
        <ul className="text-sm">
          {items.map((l) => (
            <li key={l.code} className="flex justify-between border-b border-line py-1 last:border-0">
              <span>
                {l.qty}× {l.name}
              </span>
              <span>{(l.qty * l.price).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {amount > 0 ? (
          <p className="border-t border-line pt-2 text-right text-lg font-black">{amount.toLocaleString()} RWF</p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Hitamo uburyo bwo kwishyura</p>
        <div className="space-y-2">
          {payRails.map((rail) => {
            const active = rail.id === selectedRailId;
            return (
              <button
                key={rail.id}
                type="button"
                onClick={() => setSelectedRailId(rail.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#00A651] bg-[#00A651]/10 ring-2 ring-[#00A651]/30"
                    : "border-line hover:border-navy/40"
                }`}
              >
                <span className="text-sm font-bold text-navy">
                  {active ? "✓ " : ""}
                  {rail.provider}
                </span>
                <span
                  className="rounded-lg px-3 py-1.5 font-mono text-sm font-black"
                  style={{ background: rail.pillBg, color: rail.pillText }}
                >
                  {rail.code}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          disabled={busy || amount < 1 || !selectedRail}
          onClick={startPay}
          className="w-full bg-[#00A651] hover:bg-[#008f45]"
        >
          {selectedRail?.provider.toUpperCase().includes("BPR")
            ? `Pay BPR · ${amount.toLocaleString()} RWF`
            : `Pay ${selectedRail?.provider ?? ""} · ${amount.toLocaleString()} RWF`}
        </Button>

        {selectedRail && amount > 0 ? (
          <button
            type="button"
            className="w-full text-center text-xs font-bold text-muted underline"
            onClick={() => dialRail(selectedRail, amount)}
          >
            Dial USSD only · {buildRailUssd(selectedRail, amount)}
          </button>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <p className="font-black text-navy">Saba EBM yawe</p>
        <Field label="Your phone">
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setVerified(false);
            }}
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-bold text-navy">
          <input type="checkbox" checked={isB2b} onChange={(e) => setIsB2b(e.target.checked)} />
          B2B — I have a buyer TIN
        </label>
        {isB2b ? (
          <Field label="Your TIN">
            <input className={inputClass} value={buyerTin} onChange={(e) => setBuyerTin(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Payment SMS (optional)">
          <textarea
            className={`${inputClass} min-h-20`}
            value={paymentSms}
            onChange={(e) => setPaymentSms(e.target.value)}
            placeholder="Paste MoMo / bank confirmation SMS"
          />
        </Field>
        <p className="text-center text-[11px] text-muted">
          {timezone}
          {geo ? ` · GPS ${geo}` : ""}
        </p>
        <Field label="OTP code">
          <input className={inputClass} value={otp} onChange={(e) => setOtp(e.target.value)} />
        </Field>
        {isOpenLoginClientHint() ? (
          <p className="text-center text-xs font-bold text-emerald-700">Demo OTP: {debugOtp || DEMO_OTP_CODE}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void issueOtp()}>
            Send OTP
          </Button>
          <Button type="button" variant="secondary" disabled={busy || verified} onClick={() => void verifyOtp()}>
            {verified ? "Verified ✓" : "Verify phone"}
          </Button>
        </div>
        <Button type="button" disabled={busy || !verified} onClick={() => void requestEbm()}>
          {busy ? "…" : `Request my EBM invoice · ${amount.toLocaleString()} RWF`}
        </Button>
        {message ? <p className="text-xs text-muted">{message}</p> : null}
      </Card>
    </div>
  );
}

export default function ClientAppPage() {
  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-black text-navy">Client app (buyer)</h1>
        <p className="text-xs text-muted">Scan till QR — pay then request EBM</p>
      </div>
      <Suspense fallback={<Card>Loading…</Card>}>
        <ClientInner />
      </Suspense>
    </AppShell>
  );
}
