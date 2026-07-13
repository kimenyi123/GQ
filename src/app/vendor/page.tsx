"use client";

import { FormEvent, useState } from "react";
import {
  AppShell,
  Button,
  Card,
  DEMO_MRC,
  DEMO_TIN,
  DEMO_VENDOR_ID,
  Field,
  Metric,
  apiJson,
  authHeaders,
  inputClass,
} from "@/components/design";

type Login = {
  token: string;
  role: string;
  vendorId?: string;
};

export default function VendorPage() {
  const [moveId, setMoveId] = useState(`MOV-DEMO-${Date.now()}`);
  const [docRef, setDocRef] = useState(`DOC-DEMO-${Date.now()}`);
  const [gqId, setGqId] = useState("GQ-000001");
  const [sdcNumber, setSdcNumber] = useState("SDC-DEMO-20260713");
  const [message, setMessage] = useState("Login as Ishyiga vendor to use sandbox forms.");
  const [lastMove, setLastMove] = useState("");
  const [lastCallback, setLastCallback] = useState("");

  async function loginVendor() {
    const login = await apiJson<Login>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ grant_type: "client_credentials", client_id: "gq_ishyiga_demo", client_secret: "demo-oauth-secret" }),
    });
    sessionStorage.setItem("gq_vendor_jwt", login.token);
    setMessage(`Logged in as ${login.vendorId ?? DEMO_VENDOR_ID}`);
  }

  async function postMove(event: FormEvent) {
    event.preventDefault();
    const data = await apiJson<{ moveId: string }>("/api/v1/moves", {
      method: "POST",
      headers: authHeaders("gq_vendor_jwt"),
      body: JSON.stringify({
        moveId,
        vendorId: DEMO_VENDOR_ID,
        tin: DEMO_TIN,
        mrc: DEMO_MRC,
        moveType: "ORDER",
        docRef,
        items: [{ name: "Coffee", qty: 2, price: 2500 }],
        amount: 5000,
        currency: "RWF",
        ts: new Date().toISOString(),
      }),
    });
    setLastMove(data.moveId);
    setMessage("Move accepted by sandbox API.");
  }

  async function postCallback(event: FormEvent) {
    event.preventDefault();
    const data = await apiJson<{ gqId: string; status: string }>("/api/v1/invoices/callback", {
      method: "POST",
      headers: authHeaders("gq_vendor_jwt"),
      body: JSON.stringify({
        gqId,
        sdcNumber,
        rraResponse: { accepted: true, sandbox: true },
        invoicePdfUrl: `/demo/invoices/${gqId}.pdf`,
      }),
    });
    setLastCallback(`${data.gqId} · ${data.status}`);
    setMessage("Invoice callback posted.");
  }

  return (
    <AppShell wide nav>
      <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Vendor</p>
          <h1 className="mt-2 text-4xl font-black text-navy">Ishyiga vendor portal</h1>
          <p className="mt-2 text-muted">Moves monitor, issue jobs stub, and callback sandbox.</p>
        </div>
        <Button onClick={loginVendor}>Demo login VENDOR</Button>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Vendor ID" value={DEMO_VENDOR_ID} />
        <Metric label="Last move" value={lastMove || "none"} />
        <Metric label="Last callback" value={lastCallback || "none"} />
      </div>
      <p className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">{message}</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black text-navy">Sandbox move POST</h2>
          <form className="mt-5 grid gap-4" onSubmit={postMove}>
            <Field label="Move ID"><input className={inputClass} value={moveId} onChange={(event) => setMoveId(event.target.value)} /></Field>
            <Field label="Document reference"><input className={inputClass} value={docRef} onChange={(event) => setDocRef(event.target.value)} /></Field>
            <Button type="submit">POST move</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-navy">Invoice callback</h2>
          <form className="mt-5 grid gap-4" onSubmit={postCallback}>
            <Field label="GQ ID"><input className={inputClass} value={gqId} onChange={(event) => setGqId(event.target.value)} /></Field>
            <Field label="SDC number"><input className={inputClass} value={sdcNumber} onChange={(event) => setSdcNumber(event.target.value)} /></Field>
            <Button type="submit">POST callback</Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-2xl font-black text-navy">Credentials</h2>
        <div className="mt-4 grid gap-3 font-mono text-sm">
          <p>client_id: gq_ishyiga_demo</p>
          <p>client_secret: demo-oauth-secret</p>
          <p>webhook: https://ishyiga.example.com/gq/webhook</p>
        </div>
      </Card>
    </AppShell>
  );
}
