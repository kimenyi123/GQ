"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Card, StatusChip, apiJson, authHeaders } from "@/components/design";

type RequestStatus = {
  gqId: string;
  status: string;
  tin: string;
  mrc?: string;
  docRef?: string;
  amount?: number;
  channel?: string;
  deliveredVia?: string;
  deliveredTs?: string;
  timeline: { action: string; role: string; ts: string }[];
};

const steps = ["QUEUEING", "GENERATING", "STANDBY", "ADJUST", "DONE"];

export default function RequestTrackerPage() {
  const params = useParams<{ gqId: string }>();
  const [record, setRecord] = useState<RequestStatus | null>(null);
  const [message, setMessage] = useState("Loading status...");

  useEffect(() => {
    apiJson<RequestStatus>(`/api/v1/requests/${params.gqId}`, {
      headers: authHeaders("gq_citizen_jwt"),
    })
      .then((data) => {
        setRecord(data);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.gqId]);

  return (
    <AppShell>
      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Tracker</p>
        <h1 className="mt-2 text-4xl font-black text-navy">Status ya {params.gqId}</h1>
      </section>

      {record ? (
        <div className="mt-6 grid gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">TIN {record.tin} · MRC {record.mrc ?? "n/a"}</p>
                <p className="mt-1 font-mono text-sm">{record.docRef ?? record.gqId}</p>
              </div>
              <StatusChip status={record.status} />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-black text-navy">Timeline</h2>
            <div className="mt-5 space-y-4">
              {steps.map((step) => {
                const active = step === record.status || record.timeline.some((event) => event.action.includes(step));
                return (
                  <div key={step} className="flex gap-3">
                    <div className={`mt-1 h-4 w-4 rounded-full ${active ? "bg-emerald" : "bg-line"}`} />
                    <div>
                      <p className="font-bold text-ink">{step}</p>
                      <p className="text-sm text-muted">
                        {step === record.status ? "Current stage" : active ? "Completed or touched" : "Pending"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Link className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white" href={`/i/${record.gqId}`}>
              View invoice
            </Link>
            <Link className="rounded-full border border-line px-5 py-3 text-sm font-bold text-ink" href="/report">
              Report issue
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p>
      )}
    </AppShell>
  );
}
