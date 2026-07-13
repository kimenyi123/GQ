"use client";

import { FormEvent, useState } from "react";
import { AppShell, Button, Card, DEMO_TIN, Field, apiJson, inputClass } from "@/components/design";

type ReportResult = {
  reportId: string;
  status: string;
};

export default function ReportPage() {
  const [sellerTin, setSellerTin] = useState(DEMO_TIN);
  const [phone, setPhone] = useState("+250788000001");
  const [gqId, setGqId] = useState("");
  const [note, setNote] = useState("Seller declined to provide EBM invoice.");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const data = await apiJson<ReportResult>("/api/v1/reports/evasion", {
        method: "POST",
        body: JSON.stringify({ sellerTin, phone, gqId: gqId || undefined, note, evidenceUrl: evidenceUrl || undefined }),
      });
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report failed");
    }
  }

  return (
    <AppShell>
      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Report</p>
        <h1 className="mt-2 text-4xl font-black text-navy">Menyesha EBM itatanzwe</h1>
        <p className="mt-3 text-muted">Share the seller TIN, your phone, and what happened.</p>
      </section>

      <Card className="mt-6">
        {result ? (
          <div className="rounded-2xl bg-emerald/10 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald">Report received</p>
            <h2 className="mt-2 text-3xl font-black text-navy">{result.reportId}</h2>
            <p className="mt-2 text-muted">Status: {result.status}</p>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Seller TIN">
              <input className={inputClass} value={sellerTin} onChange={(event) => setSellerTin(event.target.value)} />
            </Field>
            <Field label="Your phone">
              <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="GQ number (optional)">
              <input className={inputClass} value={gqId} onChange={(event) => setGqId(event.target.value)} placeholder="GQ-000001" />
            </Field>
            <Field label="Evidence URL (optional)">
              <input className={inputClass} value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} />
            </Field>
            <Field label="What happened?">
              <textarea className={`${inputClass} min-h-28`} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Button type="submit">Submit report</Button>
          </form>
        )}
        {message ? <p className="mt-4 text-sm text-gold">{message}</p> : null}
      </Card>
    </AppShell>
  );
}
