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
  deliveredVia?: string;
  deliveredTs?: string;
};

export default function InvoicePage() {
  const params = useParams<{ gqId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [message, setMessage] = useState("Loading invoice...");

  useEffect(() => {
    apiJson<Invoice>(`/api/v1/invoices/${params.gqId}`, {
      headers: authHeaders("gq_citizen_jwt"),
    })
      .then((data) => {
        setInvoice(data);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.gqId]);

  return (
    <AppShell>
      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">EBM invoice</p>
        <h1 className="mt-2 text-4xl font-black text-navy">{params.gqId}</h1>
      </section>

      {invoice ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Rwanda Revenue Authority</p>
              <h2 className="mt-1 text-2xl font-black text-navy">Invoice view</h2>
            </div>
            <StatusChip status={invoice.status} />
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">SDC number</dt>
              <dd className="mt-1 font-mono">{invoice.sdcNumber ?? "Pending"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Delivered via</dt>
              <dd className="mt-1">{invoice.deliveredVia ?? "Not delivered yet"}</dd>
            </div>
          </dl>
          {invoice.invoicePdfUrl ? (
            <a className="mt-6 inline-flex rounded-full bg-emerald px-5 py-3 text-sm font-bold text-white" href={invoice.invoicePdfUrl}>
              Download invoice
            </a>
          ) : (
            <p className="mt-6 rounded-2xl bg-gold/10 p-4 text-sm font-semibold text-gold">
              Invoice pending. Return to the tracker for live status.
            </p>
          )}
          {invoice.rraResponse ? <pre className="mt-5 overflow-auto rounded-2xl bg-paper p-4 text-xs">{invoice.rraResponse}</pre> : null}
        </Card>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p>
      )}
    </AppShell>
  );
}
