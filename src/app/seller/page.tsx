"use client";

import { useState } from "react";
import {
  AppShell,
  Button,
  Card,
  DEMO_PASSWORD,
  DEMO_TIN,
  Metric,
  StatusChip,
  apiJson,
  authHeaders,
} from "@/components/design";

type RequestRow = {
  gqId: string;
  status: string;
  tin: string;
  mrc?: string;
  docRef?: string;
  amount?: number;
};
type MrcRow = {
  mrc: string;
  locationLabel?: string;
  deviceType: string;
  qrVersion: string;
  status: string;
};
type Login = {
  token: string;
  role: string;
  tin?: string;
};

export default function SellerPage() {
  const [tab, setTab] = useState("requests");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [mrcs, setMrcs] = useState<MrcRow[]>([]);
  const [message, setMessage] = useState("Login as demo seller to load Chez Kivu data.");

  async function loginSeller() {
    const login = await apiJson<Login>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ grant_type: "password", phone: "+250788000010", password: DEMO_PASSWORD }),
    });
    sessionStorage.setItem("gq_seller_jwt", login.token);
    await refresh(login.tin ?? DEMO_TIN);
  }

  async function refresh(tin = DEMO_TIN) {
    setMessage("Loading seller portal...");
    try {
      const [nextRequests, nextMrcs] = await Promise.all([
        apiJson<RequestRow[]>(`/api/v1/sellers/${tin}/requests`, { headers: authHeaders("gq_seller_jwt") }),
        apiJson<MrcRow[]>(`/api/v1/sellers/${tin}/mrc`, { headers: authHeaders("gq_seller_jwt") }),
      ]);
      setRequests(nextRequests);
      setMrcs(nextMrcs);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load seller data");
    }
  }

  return (
    <AppShell wide nav>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Seller</p>
          <h1 className="mt-2 text-4xl font-black text-navy">Chez Kivu seller portal</h1>
          <p className="mt-2 text-muted">Demo TIN {DEMO_TIN}</p>
        </div>
        <Button onClick={loginSeller}>Demo login SELLER</Button>
      </section>

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
          <h2 className="text-2xl font-black text-navy">Requests queue</h2>
          <div className="mt-5 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2">GQ</th><th>Status</th><th>MRC</th><th>Doc</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr key={row.gqId} className="border-t border-line">
                    <td className="py-3 font-mono">{row.gqId}</td>
                    <td><StatusChip status={row.status} /></td>
                    <td>{row.mrc}</td>
                    <td>{row.docRef}</td>
                    <td>RWF {row.amount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "qr" ? (
        <Card className="mt-6">
          <h2 className="text-2xl font-black text-navy">QR & devices</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {mrcs.map((mrc) => (
              <div key={mrc.mrc} className="rounded-2xl border border-line bg-paper p-4">
                <p className="font-mono font-bold text-navy">{mrc.mrc}</p>
                <p className="text-sm text-muted">{mrc.locationLabel ?? "Location"} · {mrc.deviceType}</p>
                <p className="mt-2 text-sm font-bold text-emerald">{mrc.qrVersion} · {mrc.status}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "stats" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Open requests" value={requests.length} />
          <Metric label="Registered MRCs" value={mrcs.length} />
          <Metric label="Primary TIN" value={DEMO_TIN} />
        </div>
      ) : null}
    </AppShell>
  );
}
