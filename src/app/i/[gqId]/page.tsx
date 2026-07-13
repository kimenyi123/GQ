"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Card, StatusChip, apiJson, authHeaders } from "@/components/design";

type Invoice = {
  gqId: string;
  status: string;
  sdcNumber?: string;
  rraResponse?: string;
  invoicePdfUrl?: string;
  invoiceOriginal?: Record<string, unknown> | null;
  deliveredVia?: string;
  deliveredTs?: string;
  processingNote?: string | null;
  amount?: number | null;
  tinSeller?: string;
  tinBuyer?: string | null;
  docId?: string | null;
  mrc?: string | null;
};

export default function InvoicePage() {
  const params = useParams<{ gqId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [message, setMessage] = useState("Loading invoice...");

  async function pull() {
    setMessage("Pulling…");
    try {
      const data = await apiJson<Invoice>(`/api/v1/invoices/${params.gqId}`, {
        headers: authHeaders("gq_citizen_jwt"),
      });
      setInvoice(data);
      setMessage(data.status === "DONE" ? "" : data.processingNote || "Not available yet — seller still processing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pull failed");
    }
  }

  useEffect(() => {
    pull().catch(() => undefined);
  }, [params.gqId]);

  return (
    <AppShell>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">EBM invoice</p>
          <h1 className="mt-2 text-4xl font-black text-navy">{params.gqId}</h1>
        </div>
        <button
          type="button"
          onClick={pull}
          className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white"
        >
          Pull latest
        </button>
      </section>

      {invoice ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Rwanda Revenue Authority</p>
              <h2 className="mt-1 text-2xl font-black text-navy">
                {invoice.status === "DONE" ? "Invoice available" : "Waiting for seller / VSDC"}
              </h2>
            </div>
            <StatusChip status={invoice.status} />
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">SDC number</dt>
              <dd className="mt-1 font-mono">{invoice.sdcNumber ?? "Pending"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Seller TIN</dt>
              <dd className="mt-1 font-mono">{invoice.tinSeller ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Doc ID</dt>
              <dd className="mt-1 font-mono">{invoice.docId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Amount</dt>
              <dd className="mt-1 font-mono">RWF {invoice.amount ?? 0}</dd>
            </div>
          </dl>
          {invoice.status === "DONE" ? (
            <p className="mt-6 rounded-2xl bg-emerald/10 p-4 text-sm font-semibold text-emerald">
              Avail via {invoice.deliveredVia ?? "PULL"} — you can save / screenshot this EBM.
            </p>
          ) : (
            <p className="mt-6 rounded-2xl bg-gold/10 p-4 text-sm font-semibold text-gold">
              {message || "Under processing. Pull again after the seller avails the EBM."}
            </p>
          )}
          {invoice.invoiceOriginal ? (
            <pre className="mt-5 overflow-auto rounded-2xl bg-paper p-4 text-xs">
              {JSON.stringify(invoice.invoiceOriginal, null, 2)}
            </pre>
          ) : null}
        </Card>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p>
      )}
    </AppShell>
  );
}
