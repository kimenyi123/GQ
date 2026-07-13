"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AppShell, Button, Card, apiJson } from "@/components/design";

type Scenario = {
  id: string;
  business: string;
  tin: string;
  mrc: string;
  stack: string;
  vendorName: string;
  device: string;
  locationLabel: string;
  qrKind: string;
  docType: string;
  docId: string;
  amount: number;
  vat: number;
  payload: string;
  explanation: string;
};

type Company = {
  tin: string;
  name: string;
  phone: string;
  password: string;
  stack: string;
  tableCount: number;
  desktopCount: number;
  qrs: number;
};

type Catalog = {
  storage: string;
  mrcFormat: string;
  companies: Company[];
  scenarios: Scenario[];
  counts: { total: number; byBusiness: Record<string, number> };
};

function QrCard({ item }: { item: Scenario }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    QRCode.toDataURL(item.payload, { width: 220, margin: 1 }).then(setSrc).catch(() => setSrc(""));
  }, [item.payload]);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald">{item.device}</p>
          <h3 className="mt-1 text-lg font-black text-navy">{item.locationLabel}</h3>
          <p className="text-sm text-muted">{item.docType} · {item.docId}</p>
        </div>
        <span className="rounded-full bg-paper px-2 py-1 font-mono text-[10px] font-bold">{item.qrKind}</span>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item.mrc} className="mx-auto mt-4 h-[180px] w-[180px]" />
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">TIN</dt>
          <dd className="font-mono font-bold">{item.tin}</dd>
        </div>
        <div>
          <dt className="text-muted">MRC</dt>
          <dd className="break-all font-mono font-bold">{item.mrc}</dd>
        </div>
        <div>
          <dt className="text-muted">Amount</dt>
          <dd className="font-mono font-bold">RWF {item.amount.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted">VAT</dt>
          <dd className="font-mono font-bold">RWF {item.vat.toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">{item.explanation}</p>
      <p className="mt-2 break-all font-mono text-[10px] text-muted">{item.payload}</p>
      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-line py-2 text-xs font-bold"
        onClick={() => navigator.clipboard.writeText(item.payload)}
      >
        Copy payload
      </button>
    </div>
  );
}

export default function DemoQrPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [business, setBusiness] = useState("ALL");
  const [device, setDevice] = useState("ALL");
  const [message, setMessage] = useState("Loading pilot QRs…");

  useEffect(() => {
    apiJson<Catalog>("/api/v1/dev/test-qrs")
      .then((data) => {
        setCatalog(data);
        setMessage("");
      })
      .catch((e: Error) => setMessage(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    return catalog.scenarios.filter((s) => {
      if (business !== "ALL" && s.business !== business) return false;
      if (device !== "ALL" && s.device !== device) return false;
      return true;
    });
  }, [catalog, business, device]);

  return (
    <AppShell wide nav>
      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Pilot QRs</p>
        <h1 className="mt-2 text-4xl font-black text-navy">Sample devices & documents</h1>
        <p className="mt-2 max-w-3xl text-muted">
          MRC = <span className="font-mono font-bold">VVVCCCXXXXXX</span> (vendor · seller · device #). Storage:{" "}
          {catalog?.storage ?? "in-memory"}.
        </p>
      </section>

      {message ? <p className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm">{message}</p> : null}

      {catalog ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {catalog.companies.map((c) => (
              <Card key={c.tin} className="!p-4">
                <p className="text-xs font-black uppercase text-gold">{c.name}</p>
                <p className="mt-1 text-sm text-muted">{c.stack}</p>
                <p className="mt-2 font-mono text-xs">TIN {c.tin}</p>
                <p className="font-mono text-xs">
                  {c.tableCount} TABLE · {c.desktopCount} DESKTOP/WIN · {c.qrs} QRs
                </p>
                <p className="mt-2 text-xs text-muted">
                  Seller login {c.phone} / {c.password}
                </p>
                <Button className="mt-3 w-full py-2 text-xs" onClick={() => setBusiness(c.name)}>
                  Show QRs
                </Button>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBusiness("ALL")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${business === "ALL" ? "bg-navy text-white" : "border border-line"}`}
            >
              All businesses
            </button>
            {["TABLE", "DESKTOP", "WINDOWS"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(device === d ? "ALL" : d)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${device === d ? "bg-emerald text-white" : "border border-line"}`}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-muted">
            Showing {filtered.length} / {catalog.counts.total} QRs
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <QrCard key={item.id} item={item} />
            ))}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
