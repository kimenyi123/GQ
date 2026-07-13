"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AppShell,
  Button,
  Card,
  DEMO_PASSWORD,
  Metric,
  StatusChip,
  apiJson,
  authHeaders,
} from "@/components/design";

type RequestRow = {
  gqId: string;
  status: string;
  tin?: string;
  tinSeller?: string;
  mrc?: string;
  docId?: string;
  docRef?: string;
  amount?: number;
  declaredAmount?: number | null;
  decision?: string | null;
  processingNote?: string | null;
  sdcNumber?: string | null;
};

type MrcRow = {
  mrc: string;
  locationLabel?: string;
  deviceType: string;
  qrVersion: string;
  status: string;
};

type PilotSeller = {
  tin: string;
  name: string;
  phone: string;
  vendorId: string | null;
  sector: string;
};

type Login = { token: string; role: string; tin?: string; name?: string };

export default function SellerPage() {
  const [tab, setTab] = useState("requests");
  const [sellers, setSellers] = useState<PilotSeller[]>([]);
  const [activeTin, setActiveTin] = useState("");
  const [activeName, setActiveName] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [mrcs, setMrcs] = useState<MrcRow[]>([]);
  const [message, setMessage] = useState("Pick a company and login.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ sellers: PilotSeller[] }>("/api/v1/dev/pilot-sellers")
      .then((data) => setSellers(data.sellers))
      .catch(() => undefined);
  }, []);

  async function loginAs(seller: PilotSeller) {
    setBusy(true);
    setMessage(`Logging in as ${seller.name}…`);
    try {
      const login = await apiJson<Login>("/api/v1/auth/token", {
        method: "POST",
        body: JSON.stringify({
          grant_type: "password",
          phone: seller.phone,
          password: DEMO_PASSWORD,
        }),
      });
      sessionStorage.setItem("gq_seller_jwt", login.token);
      sessionStorage.setItem("gq_role", "seller");
      sessionStorage.setItem("gq_seller_tin", login.tin ?? seller.tin);
      setActiveTin(login.tin ?? seller.tin);
      setActiveName(seller.name);
      await refresh(login.tin ?? seller.tin);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(tin = activeTin) {
    if (!tin) return;
    setMessage("Loading…");
    try {
      const [nextRequests, nextMrcs] = await Promise.all([
        apiJson<RequestRow[]>(`/api/v1/sellers/${tin}/requests`, {
          headers: authHeaders("gq_seller_jwt"),
        }),
        apiJson<MrcRow[]>(`/api/v1/sellers/${tin}/mrc`, {
          headers: authHeaders("gq_seller_jwt"),
        }),
      ]);
      setRequests(nextRequests);
      setMrcs(nextMrcs);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load seller data");
    }
  }

  async function processOnVsdc(gqId: string) {
    setBusy(true);
    try {
      await apiJson(`/api/v1/requests/${gqId}/process`, {
        method: "POST",
        headers: authHeaders("gq_seller_jwt"),
        body: JSON.stringify({}),
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Process failed");
    } finally {
      setBusy(false);
    }
  }

  async function availToBuyer(gqId: string) {
    setBusy(true);
    try {
      await apiJson(`/api/v1/requests/${gqId}/avail`, {
        method: "POST",
        headers: authHeaders("gq_seller_jwt"),
        body: JSON.stringify({}),
      });
      await refresh();
      setMessage(`EBM available — buyer can pull ${gqId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Avail failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const tin = sessionStorage.getItem("gq_seller_tin");
    if (sessionStorage.getItem("gq_seller_jwt") && tin) {
      setActiveTin(tin);
      refresh(tin).catch(() => undefined);
    }
  }, []);

  return (
    <AppShell wide nav>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Seller</p>
          <h1 className="mt-2 text-4xl font-black text-navy">
            {activeName ? `${activeName} portal` : "Company seller portal"}
          </h1>
          <p className="mt-2 text-muted">
            {activeTin ? `TIN ${activeTin}` : "Login as Serena / Burrows / Cheaz Lando / Butique"}
          </p>
        </div>
        {activeTin ? (
          <Button onClick={() => refresh()} disabled={busy}>
            Refresh
          </Button>
        ) : null}
      </section>

      <Card className="mt-6">
        <h2 className="text-xl font-black text-navy">Login as company</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sellers.map((s) => (
            <button
              key={s.tin}
              type="button"
              disabled={busy}
              onClick={() => loginAs(s)}
              className={`rounded-2xl border p-4 text-left ${activeTin === s.tin ? "border-emerald bg-emerald/5" : "border-line bg-paper"}`}
            >
              <p className="font-black text-navy">{s.name}</p>
              <p className="mt-1 font-mono text-xs text-muted">{s.tin}</p>
              <p className="mt-1 text-xs text-muted">{s.phone}</p>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        {["requests", "qr", "stats"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item ? "bg-navy text-white" : "border border-line text-muted"}`}
          >
            {item === "qr" ? "QR & devices" : item}
          </button>
        ))}
      </div>

      {message ? <p className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p> : null}

      {tab === "requests" ? (
        <Card className="mt-6">
          <h2 className="text-2xl font-black text-navy">EBM requests</h2>
          <p className="mt-2 text-sm text-muted">
            Process on Ishyiga / vendor VSDC (under processing), then avail so the buyer can pull.
          </p>
          <div className="mt-5 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2">GQ</th>
                  <th>Status</th>
                  <th>MRC</th>
                  <th>Doc</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr key={row.gqId} className="border-t border-line align-top">
                    <td className="py-3 font-mono text-xs">
                      <Link className="font-bold text-navy" href={`/r/${row.gqId}`}>
                        {row.gqId}
                      </Link>
                      {row.processingNote ? (
                        <p className="mt-1 text-[11px] text-muted">{row.processingNote}</p>
                      ) : null}
                    </td>
                    <td>
                      <StatusChip status={row.status} />
                      {row.decision === "UNDER_PROCESSING" ? (
                        <p className="mt-1 text-[11px] font-bold text-gold">UNDER PROCESSING</p>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs">{row.mrc}</td>
                    <td className="font-mono text-xs">{row.docId ?? row.docRef}</td>
                    <td>
                      <p>RWF {row.amount ?? 0}</p>
                      {row.declaredAmount != null ? (
                        <p className="text-[11px] text-muted">Buyer: {row.declaredAmount}</p>
                      ) : null}
                    </td>
                    <td className="space-y-2 py-3">
                      {row.status !== "DONE" ? (
                        <>
                          <Button
                            className="w-full py-2 text-xs"
                            disabled={busy}
                            onClick={() => processOnVsdc(row.gqId)}
                          >
                            Process VSDC
                          </Button>
                          <Button
                            className="w-full py-2 text-xs"
                            variant="primary"
                            disabled={busy}
                            onClick={() => availToBuyer(row.gqId)}
                          >
                            Avail to buyer
                          </Button>
                        </>
                      ) : (
                        <Link className="text-xs font-bold text-emerald" href={`/i/${row.gqId}`}>
                          View EBM {row.sdcNumber}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!requests.length ? <p className="mt-4 text-sm text-muted">No requests yet for this TIN.</p> : null}
          </div>
        </Card>
      ) : null}

      {tab === "qr" ? (
        <Card className="mt-6">
          <h2 className="text-2xl font-black text-navy">QR & devices</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {mrcs.map((mrc) => (
              <div key={mrc.mrc} className="rounded-2xl border border-line bg-paper p-4">
                <p className="break-all font-mono font-bold text-navy">{mrc.mrc}</p>
                <p className="text-sm text-muted">
                  {mrc.locationLabel ?? "Location"} · {mrc.deviceType}
                </p>
                <p className="mt-2 text-sm font-bold text-emerald">
                  {mrc.qrVersion} · {mrc.status}
                </p>
              </div>
            ))}
          </div>
          <Link href="/demo-qr" className="mt-4 inline-block text-sm font-bold text-navy">
            Open all sample QRs →
          </Link>
        </Card>
      ) : null}

      {tab === "stats" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Open / processing" value={requests.filter((r) => r.status !== "DONE").length} />
          <Metric label="Done / available" value={requests.filter((r) => r.status === "DONE").length} />
          <Metric label="Registered MRCs" value={mrcs.length} />
        </div>
      ) : null}
    </AppShell>
  );
}
