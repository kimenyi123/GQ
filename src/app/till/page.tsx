"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BprTillFlyer, BprTillIdle, BPR_MERCHANT_CODE } from "@/components/BprTillFlyer";
import { resolveBuyerScanUrl } from "@/components/GqQrCard";
import { apiJson } from "@/components/design";
import { buildGq2Payload, randomTxnId, simCartTotal, type SimCartLine } from "@/lib/simulator-helpers";

type LanDraft = {
  docRef: string;
  status: string;
  tin?: string;
  mrc?: string;
  merchantName?: string;
  buyerTin?: string;
  buyerName?: string;
  amount?: number;
  gqPayload?: string;
  gqUrl?: string;
  railTxnId?: string;
  promoText?: string;
  items?: SimCartLine[];
};

export default function TillPage() {
  const [draft, setDraft] = useState<LanDraft | null>(null);
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [paidFrom, setPaidFrom] = useState("+250788000001");
  const [txnId, setTxnId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const amount = draft?.amount ?? (draft?.items ? simCartTotal(draft.items) : 0);
  const buyerPayload =
    draft?.gqPayload ??
    (draft?.tin && draft?.mrc ? buildGq2Payload(draft.tin, draft.mrc, draft.docRef) : null);
  const qrScanUrl = buyerPayload ? resolveBuyerScanUrl(buyerPayload, draft?.gqUrl) : "";

  const poll = useCallback(async () => {
    try {
      await apiJson<{ ok: boolean }>("/api/v1/dev/web-erp/health");
      setOnline(true);
    } catch {
      setOnline(false);
      setDraft(null);
      setWaiting(false);
      return;
    }

    try {
      const cur = await apiJson<LanDraft>("/api/v1/dev/web-erp/draft/current");
      setDraft(cur);
      setWaiting(false);
      if (cur.status === "PAID" || cur.status === "STAMPED") setDone(true);
    } catch {
      setDraft(null);
      setWaiting(true);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  async function confirmPay() {
    if (!draft || draft.status !== "READY") return;
    setBusy(true);
    try {
      const id = txnId.trim() || randomTxnId("BPR");
      await apiJson(`/api/v1/dev/web-erp/draft/${encodeURIComponent(draft.docRef)}/paid`, {
        method: "POST",
        body: JSON.stringify({
          railCode: "BPR",
          txnId: id,
          amount,
          source: "bpr-till",
        }),
      });
      await apiJson("/api/v1/payments/notify", {
        method: "POST",
        body: JSON.stringify({
          txnId: id,
          provider: "BPR",
          payeeTin: draft.tin ?? "",
          payerRef: paidFrom,
          amount,
          ts: new Date().toISOString(),
        }),
      });
      setTxnId(id);
      setDone(true);
      await poll();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#002855] py-0">
      {/* Minimal merchant bar — hidden from customer view */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-[#002855]/95 px-3 py-2 text-white backdrop-blur">
        <span className="text-xs font-bold tracking-wide">BPR Till · Merchant</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMerchantOpen((v) => !v)}
            className="rounded-lg bg-[#B5E61D] px-3 py-1 text-xs font-black text-[#002855]"
          >
            {merchantOpen ? "Hide" : "Confirm pay"}
          </button>
          <Link href="/erp" className="rounded-lg border border-white/30 px-3 py-1 text-xs font-bold">
            ERP
          </Link>
        </div>
      </div>

      {!online ? (
        <div className="mx-auto max-w-md p-6 text-center text-sm text-white">
          <p className="font-bold">Cannot reach server</p>
          <p className="mt-2 opacity-80">Use http://192.168.1.72:3000/till on same Wi-Fi</p>
        </div>
      ) : waiting && !draft ? (
        <BprTillIdle />
      ) : draft ? (
        <>
          <BprTillFlyer
            tin={draft.tin ?? "—"}
            mrc={draft.mrc ?? "—"}
            merchantName={draft.merchantName ?? "Merchant"}
            bprMerchantCode={BPR_MERCHANT_CODE}
            amount={amount}
            buyerName={draft.buyerName ?? undefined}
            buyerTin={draft.buyerTin ?? undefined}
            qrScanUrl={qrScanUrl}
            status={draft.status}
            promoText={draft.promoText ?? undefined}
            items={draft.items}
          />

          {merchantOpen && draft.status === "READY" && !done ? (
            <div className="mx-auto max-w-[420px] border-t border-white/10 bg-[#002855] p-4 text-white">
              <p className="mb-3 text-xs font-bold text-[#B5E61D]">Merchant only — confirm BPR payment received</p>
              <label className="mb-2 block text-xs">
                Paid from (buyer phone)
                <input
                  className="mt-1 w-full rounded-lg border-0 px-3 py-2 text-sm text-[#002855]"
                  value={paidFrom}
                  onChange={(e) => setPaidFrom(e.target.value)}
                />
              </label>
              <label className="mb-3 block text-xs">
                BPR transaction ID
                <input
                  className="mt-1 w-full rounded-lg border-0 px-3 py-2 text-sm text-[#002855]"
                  placeholder="Auto-generated"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={confirmPay}
                className="w-full rounded-xl bg-[#B5E61D] py-3 text-sm font-black text-[#002855] disabled:opacity-60"
              >
                {busy ? "Confirming…" : "Confirm BPR payment (SMS matched)"}
              </button>
            </div>
          ) : null}

          {done ? (
            <p className="py-3 text-center text-xs font-bold text-[#B5E61D]">
              PAID · Tell cashier to Make EBM on ERP
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
