"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AppShell,
  Button,
  Card,
  DEMO_GQ,
  DEMO_TIN,
  Field,
  Metric,
  StatusChip,
  apiJson,
  authHeaders,
  inputClass,
} from "@/components/design";

type StatusData = { queues: Record<string, number> };

export default function AdminPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [tin, setTin] = useState(DEMO_TIN);
  const [mrc, setMrc] = useState(`MRC-DEMO-${Date.now()}`);
  const [vendorId, setVendorId] = useState("VND-ISHYIGA");
  const [gqId, setGqId] = useState(DEMO_GQ);
  const [vendorName, setVendorName] = useState("New demo vendor");
  const [message, setMessage] = useState("Open the menu (☰) → Login as Admin, or tap below.");

  async function loginAdmin() {
    const login = await apiJson<{ token: string }>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ role: "admin" }),
    });
    sessionStorage.setItem("gq_admin_jwt", login.token);
    sessionStorage.setItem("gq_role", "admin");
    await loadStatus();
  }

  async function loadStatus() {
    const data = await apiJson<StatusData>("/api/v1/status");
    setStatus(data);
    setMessage("Ops board refreshed.");
  }

  useEffect(() => {
    if (sessionStorage.getItem("gq_admin_jwt")) {
      loadStatus().catch(() => undefined);
    }
  }, []);

  async function createMrc(event: FormEvent) {
    event.preventDefault();
    const data = await apiJson<{ mrc: string }>("/api/v1/mrc", {
      method: "POST",
      headers: authHeaders("gq_admin_jwt"),
      body: JSON.stringify({ tin, mrc, vendorId, locationLabel: "Admin desk", deviceType: "COUNTER", qrVersion: "GQ1" }),
    });
    setMessage(`MRC registered: ${data.mrc}`);
  }

  async function adjust(decision: "REFUND" | "FINAL_PUSH") {
    const data = await apiJson<{ gqId: string; status: string }>(`/api/v1/requests/${gqId}/adjust`, {
      method: "POST",
      headers: authHeaders("gq_admin_jwt"),
      body: JSON.stringify({ decision, reason: "Admin desk demo action" }),
    });
    setMessage(`${data.gqId} moved to ${data.status}`);
  }

  async function createVendor(event: FormEvent) {
    event.preventDefault();
    const data = await apiJson<{ vendorId: string; oauthClientId: string; oauthClientSecret: string }>("/api/v1/vendors", {
      method: "POST",
      body: JSON.stringify({ name: vendorName, vsdcRef: "VSDC-DEMO", webhookUrl: "https://vendor.example.com/gq" }),
    });
    setMessage(`Vendor ${data.vendorId}: ${data.oauthClientId} / ${data.oauthClientSecret}`);
  }

  return (
    <AppShell wide nav>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-navy">Global QR admin console</h1>
        </div>
        <Button onClick={loginAdmin}>Demo login GQ_ADMIN</Button>
      </section>
      <p className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p>

      {status ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Object.entries(status.queues).slice(0, 4).map(([key, value]) => (
            <Metric key={key} label={<StatusChip status={key} />} value={value} />
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-navy">MRC registry</h2>
          <form className="mt-5 grid gap-4" onSubmit={createMrc}>
            <Field label="Seller TIN"><input className={inputClass} value={tin} onChange={(event) => setTin(event.target.value)} /></Field>
            <Field label="MRC"><input className={inputClass} value={mrc} onChange={(event) => setMrc(event.target.value)} /></Field>
            <Field label="Vendor ID"><input className={inputClass} value={vendorId} onChange={(event) => setVendorId(event.target.value)} /></Field>
            <Button type="submit">Register MRC</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-navy">Adjust desk</h2>
          <Field label="GQ ID"><input className={inputClass} value={gqId} onChange={(event) => setGqId(event.target.value)} /></Field>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => adjust("FINAL_PUSH")}>Final push</Button>
            <Button variant="secondary" onClick={() => adjust("REFUND")}>Refund</Button>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-navy">Ops board</h2>
          <p className="mt-2 text-sm text-muted">Fetches public queue depth from `/api/v1/status`.</p>
          <Button className="mt-5" variant="ghost" onClick={loadStatus}>Refresh status</Button>
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-navy">Vendor list management stub</h2>
          <form className="mt-5 grid gap-4" onSubmit={createVendor}>
            <Field label="Vendor name"><input className={inputClass} value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></Field>
            <Button type="submit">Create vendor</Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
