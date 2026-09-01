"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppShell,
  Button,
  Card,
  DEMO_MRC,
  DEMO_TIN,
  StatusChip,
  apiJson,
} from "@/components/design";
import {
  SIM_PRINT_OPTIONS,
  type SimCartLine,
  type SimPayment,
  type SimPrintOption,
  buildReceiptText,
  fakeVsdcStamp,
  simCartTotal,
} from "@/lib/simulator-helpers";

type LanDraft = {
  docRef: string;
  status: string;
  buyerTin?: string;
  buyerName?: string;
  amount?: number;
  gqPayload?: string;
  gqUrl?: string;
  railCode?: string;
  railTxnId?: string;
  items?: SimCartLine[];
};

type EbmResult = {
  gqId: string;
  status: string;
  sdcNumber: string;
  trackerUrl: string;
  invoiceUrl: string;
};

const CATALOG = [
  { code: "TEA", name: "African tea", price: 500, tvaBand: "B" },
  { code: "COF", name: "Coffee", price: 800, tvaBand: "B" },
  { code: "SNK", name: "Snack plate", price: 1200, tvaBand: "B" },
  { code: "WTR", name: "Water 1L", price: 300, tvaBand: "B" },
  { code: "BRD", name: "Bread loaf", price: 600, tvaBand: "B" },
];

export default function WebErpPage() {
  const [tin, setTin] = useState(DEMO_TIN);
  const [mrc, setMrc] = useState(DEMO_MRC);
  const [merchantName, setMerchantName] = useState("Chez Kivu — Web ERP");
  const [employe, setEmploye] = useState("WEB-CASHIER");
  const [buyerTin, setBuyerTin] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+250788000001");
  const [cart, setCart] = useState<SimCartLine[]>([]);
  const [draft, setDraft] = useState<LanDraft | null>(null);
  const [printOption, setPrintOption] = useState<SimPrintOption>("EPSON");
  const [promoText, setPromoText] = useState("Murakoze! 10% off next visit — code KIVU10");
  const [purchaseCode] = useState("000000");
  const [ebm, setEbm] = useState<EbmResult | null>(null);
  const [receipt, setReceipt] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [qty, setQty] = useState("1");
  const [lanBase, setLanBase] = useState("");

  const total = useMemo(() => simCartTotal(cart), [cart]);
  const paid = draft?.status === "PAID" || draft?.status === "STAMPED";
  const ready = draft?.status === "READY" || paid;

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 30));
  }, []);

  const sessionBody = useCallback(
    () => ({
      tin,
      mrc,
      employe,
      merchantName,
      buyerTin,
      buyerName,
      buyerPhone,
      items: cart,
      printOption,
      promoText,
      docRef: draft?.docRef,
      ijisho: "INVOICE",
    }),
    [tin, mrc, employe, merchantName, buyerTin, buyerName, buyerPhone, cart, printOption, promoText, draft?.docRef],
  );

  const syncSession = useCallback(async () => {
    if (cart.length === 0) return null;
    const data = await apiJson<LanDraft>("/api/v1/dev/web-erp/session", {
      method: "POST",
      body: JSON.stringify(sessionBody()),
    });
    setDraft(data);
    return data;
  }, [cart.length, sessionBody]);

  useEffect(() => {
    apiJson<{ lanUrl: string | null }>("/api/v1/dev/lan-url")
      .then((d) => setLanBase(d.lanUrl ?? window.location.origin))
      .catch(() => setLanBase(window.location.origin));
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    const t = setTimeout(() => {
      syncSession().catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cart, buyerTin, buyerName, syncSession]);

  useEffect(() => {
    if (!ready || paid) return;
    const poll = setInterval(async () => {
      try {
        const cur = await apiJson<LanDraft>("/api/v1/dev/web-erp/draft/current");
        if (cur.status === "PAID") {
          setDraft(cur);
          pushLog(`Till paid ${cur.railCode} ${cur.railTxnId}`);
        }
      } catch {
        /* no draft */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [ready, paid, pushLog]);

  function addProduct(p: (typeof CATALOG)[number]) {
    if (paid) return;
    const q = Math.max(1, Number(qty) || 1);
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.code === p.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + q };
        return next;
      }
      return [...prev, { ...p, qty: q }];
    });
    pushLog(`Added ${q}× ${p.name}`);
    setEbm(null);
    setReceipt("");
    if (ready) setDraft((d) => (d ? { ...d, status: "DRAFT" } : d));
  }

  function updateLineQty(code: string, nextQty: number) {
    if (paid) return;
    const q = Math.max(1, Math.floor(nextQty) || 1);
    setCart((prev) => prev.map((l) => (l.code === code ? { ...l, qty: q } : l)));
    pushLog(`Qty ${code} → ${q}`);
    setEbm(null);
    setReceipt("");
    if (ready) setDraft((d) => (d ? { ...d, status: "DRAFT" } : d));
  }

  function removeLine(code: string) {
    if (paid) return;
    setCart((prev) => prev.filter((l) => l.code !== code));
    pushLog(`Removed ${code}`);
    setEbm(null);
    setReceipt("");
    if (ready) setDraft((d) => (d ? { ...d, status: "DRAFT" } : d));
  }

  function clearCart() {
    if (paid) return;
    setCart([]);
    pushLog("Cart cleared");
    setEbm(null);
    setReceipt("");
    setDraft((d) => (d ? { ...d, status: "DRAFT" } : d));
  }

  function addByScan() {
    if (paid) return;
    const code = scanCode.trim().toUpperCase();
    if (!code) return;
    const found = CATALOG.find((p) => p.code === code);
    if (found) addProduct(found);
    else {
      const price = Number(prompt("Price RWF?", "1000") ?? "0");
      if (!price) return;
      const name = prompt("Product name?", code) ?? code;
      setCart((prev) => [...prev, { code, name, price, qty: Number(qty) || 1, tvaBand: "B" }]);
      pushLog(`Added scan ${code}`);
      if (ready) setDraft((d) => (d ? { ...d, status: "DRAFT" } : d));
    }
    setScanCode("");
  }

  async function pushToQr() {
    setBusy("push");
    try {
      await syncSession();
      const data = await apiJson<LanDraft>("/api/v1/dev/web-erp/push", {
        method: "POST",
        body: JSON.stringify({ appBaseUrl: lanBase || window.location.origin }),
      });
      setDraft(data);
      pushLog(`Push to QR — open Till on phone: /till`);
    } finally {
      setBusy("");
    }
  }

  async function finishEbm() {
    if (!draft || !paid) return;
    setBusy("ebm");
    try {
      const payment: SimPayment = {
        railCode: draft.railCode ?? "MTN_MOMO",
        railName: draft.railCode ?? "Payment",
        paidOn: mrc,
        paidFrom: buyerPhone,
        txnId: draft.railTxnId ?? "TX-LOCAL",
        amount: draft.amount ?? total,
      };
      const stamp = fakeVsdcStamp(draft.docRef);
      const text = buildReceiptText({
        merchantName,
        tin,
        mrc,
        docRef: draft.docRef,
        buyerTin,
        buyerName,
        lines: cart,
        payment,
        vsdcSignature: stamp.vsdcSignature,
        vsdcInternalData: stamp.vsdcInternalData,
        printOption,
        promoText,
      });
      setReceipt(text);
      const result = await apiJson<EbmResult>("/api/v1/dev/simulator/make-ebm", {
        method: "POST",
        body: JSON.stringify({
          docRef: draft.docRef,
          tin,
          mrc,
          buyerPhone,
          buyerTin,
          buyerName,
          amount: total,
          items: cart,
          gqPayload: draft.gqPayload,
          invoiceOriginal: text,
          printOption,
          promoText,
          railCode: payment.railCode,
          railTxnId: payment.txnId,
          paidFrom: buyerPhone,
          paidOn: mrc,
          vsdcSignature: stamp.vsdcSignature,
          vsdcInternalData: stamp.vsdcInternalData,
        }),
      });
      setEbm(result);
      setDraft((d) => (d ? { ...d, status: "STAMPED" } : d));
      pushLog(`EBM DONE ${result.gqId}`);
      if (printOption !== "NONE") window.print();
    } finally {
      setBusy("");
    }
  }

  async function newSale() {
    await apiJson("/api/v1/dev/web-erp/reset", { method: "POST" });
    setCart([]);
    setDraft(null);
    setEbm(null);
    setReceipt("");
    pushLog("New sale");
  }

  return (
    <AppShell wide>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy">Ishyiga Web ERP</h1>
          <p className="text-sm text-muted">
            Desk simulator — no Java ERP, no port 8744. Built-in adapter replaces LAN till link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={lanBase ? `${lanBase}/till` : "/till"}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white"
          >
            Open Till (phone)
          </a>
          {draft?.status ? <StatusChip status={draft.status} /> : null}
        </div>
      </div>

      {lanBase ? (
        <Card className="mb-4 border border-cyan/40 bg-cyan/5 p-3 text-sm">
          <p className="font-bold text-navy">Phone URLs (same Wi-Fi — not localhost on phone)</p>
          <p className="mt-1 break-all font-mono text-xs">
            ERP: {lanBase}/erp
          </p>
          <p className="break-all font-mono text-xs">
            Till: {lanBase}/till
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-4">
          <h2 className="font-black text-navy">Caisse — add to cart</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-bold text-muted">
              Seller TIN
              <input className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" value={tin} onChange={(e) => setTin(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-muted">
              MRC
              <input className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" value={mrc} onChange={(e) => setMrc(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-muted">
              Cashier
              <input className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" value={employe} onChange={(e) => setEmploye(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-muted sm:col-span-2">
              Buyer name (at cart)
              <input className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Jean Bosco" />
            </label>
            <label className="text-xs font-bold text-muted">
              Buyer TIN (at cart)
              <input className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" value={buyerTin} onChange={(e) => setBuyerTin(e.target.value)} placeholder="999000001" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATALOG.map((p) => (
              <button
                key={p.code}
                type="button"
                disabled={paid}
                onClick={() => addProduct(p)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-navy hover:border-navy disabled:opacity-50"
              >
                {p.name} · {p.price}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Scan / type code"
              value={scanCode}
              disabled={paid}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addByScan()}
            />
            <input
              className="w-16 rounded-xl border border-line px-2 py-2 text-sm disabled:opacity-50"
              value={qty}
              disabled={paid}
              onChange={(e) => setQty(e.target.value)}
            />
            <Button type="button" variant="ghost" disabled={paid} onClick={addByScan}>
              Add
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-xs font-bold uppercase text-muted">Cart</p>
              {cart.length > 0 && !paid ? (
                <button type="button" onClick={clearCart} className="text-xs font-bold text-red-600 hover:underline">
                  Clear all
                </button>
              ) : null}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="p-2">Item</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Price</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-muted">
                      Cart empty — tap products above
                    </td>
                  </tr>
                ) : (
                  cart.map((l) => (
                    <tr key={l.code} className="border-b border-line/60">
                      <td className="p-2">{l.name}</td>
                      <td className="p-2">
                        {paid ? (
                          l.qty
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Decrease ${l.name}`}
                              className="h-7 w-7 rounded-lg border border-line text-sm font-bold hover:bg-paper"
                              onClick={() => updateLineQty(l.code, l.qty - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="w-12 rounded-lg border border-line px-1 py-1 text-center text-sm"
                              value={l.qty}
                              onChange={(e) => updateLineQty(l.code, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${l.name}`}
                              className="h-7 w-7 rounded-lg border border-line text-sm font-bold hover:bg-paper"
                              onClick={() => updateLineQty(l.code, l.qty + 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2">{l.price.toLocaleString()}</td>
                      <td className="p-2 text-right font-bold">{(l.qty * l.price).toLocaleString()}</td>
                      <td className="p-2 text-right">
                        {!paid ? (
                          <button
                            type="button"
                            aria-label={`Remove ${l.name}`}
                            className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                            onClick={() => removeLine(l.code)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="border-t border-line p-3 text-right text-lg font-black text-navy">{total.toLocaleString()} RWF</p>
            {ready && !paid && cart.length > 0 ? (
              <p className="border-t border-line px-3 py-2 text-xs text-amber-700">
                Cart changed — push to QR again before payment.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3 border-2 border-gold/30 bg-gold/5">
          <h2 className="font-black text-navy">EndSale</h2>
          <p className="text-xs text-muted">INVOICE · CASH</p>

          <label className="block text-xs font-bold text-muted">
            Client TIN
            <input className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" value={buyerTin} onChange={(e) => setBuyerTin(e.target.value)} />
          </label>
          <label className="block text-xs font-bold text-muted">
            Purchase code
            <input className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" readOnly value={purchaseCode} />
          </label>

          <div className={`rounded-xl p-3 text-center ${paid ? "bg-emerald/20 text-emerald" : ready ? "bg-cyan/20 text-navy" : "bg-white"}`}>
            <p className="text-xs font-bold uppercase">{paid ? "PAID — ready to stamp" : ready ? "On till — waiting payment" : "Not on till yet"}</p>
            {draft?.railTxnId ? <p className="mt-1 text-xs">{draft.railCode} · {draft.railTxnId}</p> : null}
          </div>

          <Button type="button" disabled={!!busy || cart.length === 0 || paid} onClick={() => pushToQr().catch((e) => pushLog(e.message))}>
            {busy === "push" ? "…" : "Push to QR"}
          </Button>

          <label className="block text-xs font-bold text-muted">
            Print
            <select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" value={printOption} onChange={(e) => setPrintOption(e.target.value as SimPrintOption)}>
              {SIM_PRINT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-muted">
            Promotion (sent to till)
            <textarea className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" rows={2} value={promoText} onChange={(e) => setPromoText(e.target.value)} />
          </label>

          <Button type="button" variant="secondary" disabled={!!busy || !paid} onClick={() => finishEbm().catch((e) => pushLog(e.message))}>
            {busy === "ebm" ? "Stamping…" : "Save invoice · Make EBM"}
          </Button>

          {ebm ? (
            <div className="rounded-xl bg-emerald/10 p-3 text-xs">
              <p className="font-bold text-emerald">{ebm.gqId} · {ebm.sdcNumber}</p>
              <Link href={ebm.trackerUrl} className="font-bold text-navy underline">
                Citizen tracker
              </Link>
            </div>
          ) : null}

          <Button type="button" variant="ghost" onClick={() => newSale().catch(() => {})}>
            New sale
          </Button>
        </Card>
      </div>

      {receipt ? (
        <Card className="mt-4">
          <h3 className="mb-2 font-black text-navy">Receipt sent to till / ebm.rw</h3>
          <pre className="max-h-48 overflow-auto rounded-xl bg-ink p-4 text-xs text-white whitespace-pre-wrap">{receipt}</pre>
        </Card>
      ) : null}

      <Card className="mt-4">
        <h3 className="mb-2 font-black text-navy">Log</h3>
        <ul className="max-h-32 space-y-1 overflow-auto text-xs text-muted">
          {log.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
