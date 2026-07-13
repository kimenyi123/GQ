"use client";

import { useEffect, useState } from "react";
import { AppShell, Button, Card, DEMO_GQ, Field, Metric, StatusChip, apiJson, authHeaders, inputClass } from "@/components/design";

type Conversion = {
  kpis: { requests: number; invoices: number; conversion: number };
  bySector: { sector: string; requests: number; invoices: number; conversion: number }[];
  heatTable: { tin: string; hour: number; requests: number; invoices: number; conversion: number }[];
};
type Batch = { id: string; pushed: number; refunded: number; failed: number; date: string };
type Evasion = { reportId: string; sellerTin: string; gqId?: string; note?: string; status: string };
type RecordView = { gqId: string; status: string; tin: string; mrc?: string; docRef?: string; phone: string; amount?: number };

export default function RraPage() {
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [reports, setReports] = useState<Evasion[]>([]);
  const [recordId, setRecordId] = useState(DEMO_GQ);
  const [record, setRecord] = useState<RecordView | null>(null);
  const [message, setMessage] = useState("Open the menu (☰) → Login as RRA, or tap below.");

  async function login(role: "rra" | "RRA_AGENT" = "rra") {
    const login = await apiJson<{ token: string }>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    sessionStorage.setItem("gq_rra_jwt", login.token);
    sessionStorage.setItem("gq_role", "rra");
    await loadDashboard();
  }

  async function loadDashboard() {
    setMessage("Loading RRA dashboard...");
    try {
      const [nextConversion, nextBatches, nextReports] = await Promise.all([
        apiJson<Conversion>("/api/v1/rra/conversion", { headers: authHeaders("gq_rra_jwt") }),
        apiJson<Batch[]>("/api/v1/rra/batch", { headers: authHeaders("gq_rra_jwt") }),
        apiJson<Evasion[]>("/api/v1/rra/reports/evasion", { headers: authHeaders("gq_rra_jwt") }),
      ]);
      setConversion(nextConversion);
      setBatches(nextBatches);
      setReports(nextReports);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load RRA dashboard");
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem("gq_rra_jwt")) {
      loadDashboard().catch(() => undefined);
    }
  }, []);

  async function inspect(decrypt = false) {
    const data = await apiJson<RecordView>(`/api/v1/rra/records/${recordId}${decrypt ? "?decrypt=1" : ""}`, {
      headers: authHeaders("gq_rra_jwt"),
    });
    setRecord(data);
  }

  return (
    <AppShell wide nav>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">RRA</p>
          <h1 className="mt-2 text-4xl font-black text-navy">Conversion operations</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => login("rra")}>Demo RRA_ANALYST</Button>
          <Button variant="secondary" onClick={() => login("RRA_AGENT")}>Demo RRA_AGENT</Button>
        </div>
      </section>
      {message ? <p className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p> : null}

      {conversion ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric label="Requests" value={conversion.kpis.requests} />
            <Metric label="Invoices" value={conversion.kpis.invoices} />
            <Metric label="Conversion" value={`${Math.round(conversion.kpis.conversion * 100)}%`} />
          </div>

          <Card className="mt-6">
            <h2 className="text-2xl font-black text-navy">Filters</h2>
            <p className="mt-2 text-sm text-muted">API supports date, TIN, sector, MRC, and hour filters. This prototype loads the seeded default window.</p>
          </Card>

          <Card className="mt-6">
            <h2 className="text-2xl font-black text-navy">Heat table</h2>
            <div className="mt-5 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">TIN</th><th>Hour</th><th>Requests</th><th>Invoices</th><th>Conversion</th></tr></thead>
                <tbody>
                  {conversion.heatTable.slice(0, 16).map((row) => (
                    <tr key={`${row.tin}-${row.hour}`} className="border-t border-line">
                      <td className="py-3 font-mono">{row.tin}</td><td>{row.hour}:00</td><td>{row.requests}</td><td>{row.invoices}</td><td>{Math.round(row.conversion * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-navy">Record inspector</h2>
          <div className="mt-5 flex gap-3">
            <Field label="GQ ID"><input className={inputClass} value={recordId} onChange={(event) => setRecordId(event.target.value)} /></Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => inspect(false)}>Inspect</Button>
            <Button variant="secondary" onClick={() => inspect(true)}>Decrypt as agent</Button>
          </div>
          {record ? (
            <div className="mt-5 rounded-2xl bg-paper p-4 text-sm">
              <p className="font-mono font-bold">{record.gqId}</p>
              <p>TIN {record.tin} · phone {record.phone}</p>
              <p>{record.docRef} · RWF {record.amount ?? 0}</p>
              <div className="mt-2"><StatusChip status={record.status} /></div>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-navy">Batch list</h2>
          <div className="mt-4 space-y-3">
            {batches.map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-line bg-paper p-4 text-sm">
                <p className="font-mono font-bold">{batch.id}</p>
                <p>pushed {batch.pushed} · refunded {batch.refunded} · failed {batch.failed}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-2xl font-black text-navy">Evasion feed</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reports.map((report) => (
            <div key={report.reportId} className="rounded-2xl border border-line bg-paper p-4 text-sm">
              <p className="font-mono font-bold">{report.reportId}</p>
              <p>TIN {report.sellerTin} · {report.gqId ?? "no GQ"}</p>
              <p className="text-muted">{report.note}</p>
              <StatusChip status={report.status} />
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
