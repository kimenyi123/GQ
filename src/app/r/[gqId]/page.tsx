"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Card, StatusChip, apiJson, authHeaders } from "@/components/design";
import { citizenTimelineState, hasVsdcStamp } from "@/lib/gq-status";

type RequestStatus = {
  gqId: string;
  status: string;
  tin: string;
  mrc?: string;
  docRef?: string;
  processingNote?: string;
  gqRequestSignature?: string | null;
  vsdcSignature?: string | null;
  vsdcInternalData?: string | null;
};

function formatGqCode(value?: string | null) {
  if (!value) return null;
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact.slice(0, 16) || null;
}

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

  const gqCode = formatGqCode(record?.gqRequestSignature);
  const stamped = record ? hasVsdcStamp(record) : false;
  const timeline = record ? citizenTimelineState(record.vsdcSignature, record.vsdcInternalData) : [];

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
            {record.processingNote ? (
              <p className="mt-3 text-sm text-muted">{record.processingNote}</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-xl font-black text-navy">GQ integrity code</h2>
            <p className="mt-1 text-sm text-muted">
              Platform seal at Saba — stops duplication and tampering. Not RRA or VSDC signing.
            </p>
            {gqCode ? (
              <p className="mt-4 text-center font-mono text-[22px] font-black tracking-widest text-navy">
                {gqCode}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">No integrity code on this record.</p>
            )}
          </Card>

          {stamped ? (
            <Card>
              <h2 className="text-xl font-black text-navy">RRA / VSDC stamp</h2>
              <p className="mt-1 text-sm text-muted">From Ishyiga VSDC when the EBM invoice is stamped.</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Internal data</p>
                  <p className="mt-1 break-all font-mono text-sm text-ink">{record.vsdcInternalData}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Receipt signature</p>
                  <p className="mt-1 break-all font-mono text-sm text-ink">{record.vsdcSignature}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <h2 className="text-xl font-black text-navy">RRA / VSDC stamp</h2>
              <p className="mt-2 text-sm text-muted">
                Not yet — seller must stamp on Ishyiga VSDC. Status stays{" "}
                <span className="font-bold text-gold">GENERATING</span> until then.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="text-xl font-black text-navy">Timeline</h2>
            <div className="mt-5 space-y-4">
              {timeline.map((step) => (
                <div key={step.id} className="flex gap-3">
                  <div
                    className={`mt-1 h-4 w-4 rounded-full ${
                      step.current ? "bg-gold" : step.done ? "bg-emerald" : "bg-line"
                    }`}
                  />
                  <div>
                    <p className="font-bold text-ink">{step.title}</p>
                    <p className="text-sm text-muted">
                      {step.current ? "Current stage" : step.done ? "Completed" : "Waiting"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            {stamped && record.status === "DONE" ? (
              <Link className="rounded-full bg-navy px-5 py-3 text-sm font-bold text-white" href={`/i/${record.gqId}`}>
                View invoice
              </Link>
            ) : (
              <span className="rounded-full border border-line px-5 py-3 text-sm font-bold text-muted">
                Invoice after VSDC stamp
              </span>
            )}
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
