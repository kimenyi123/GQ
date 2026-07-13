"use client";

import { useEffect, useState } from "react";
import { AppShell, Card, Metric, StatusChip, apiJson } from "@/components/design";

type StatusData = {
  queues: Record<string, number>;
};

export default function PublicStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [message, setMessage] = useState("Loading queue depths...");

  useEffect(() => {
    apiJson<StatusData>("/api/v1/status")
      .then((next) => {
        setData(next);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <AppShell wide nav>
      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Public status</p>
        <h1 className="mt-2 text-4xl font-black text-navy">Global QR queue depths</h1>
        <p className="mt-3 max-w-2xl text-muted">Public institutional view of request queues. No authentication required.</p>
      </section>

      {data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.queues).map(([status, count]) => (
            <Metric key={status} label={<StatusChip status={status} />} value={count} />
          ))}
        </div>
      ) : (
        <Card className="mt-6">{message}</Card>
      )}
    </AppShell>
  );
}
