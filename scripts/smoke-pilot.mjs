const base = "http://localhost:3000";

async function j(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  const body = await res.json();
  if (!body.ok) throw new Error(JSON.stringify(body));
  return body.data;
}

const catalog = await j("/api/v1/dev/test-qrs");
console.log("QRs", catalog.counts.total, catalog.companies.map((c) => `${c.name}:${c.qrs}`).join(", "));

const serena = catalog.scenarios.find((s) => s.business === "Serena" && s.device === "TABLE");
console.log("sample MRC", serena.mrc, serena.payload);

const otp = await j("/api/v1/otp/issue", { method: "POST", body: JSON.stringify({ phone: "+250788000001" }) });
const tok = await j("/api/v1/otp/verify", {
  method: "POST",
  body: JSON.stringify({ phone: "+250788000001", code: otp.debugCode }),
});

const req = await j("/api/v1/requests", {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.token}` },
  body: JSON.stringify({
    phone: "+250788000001",
    payload: serena.payload,
    channel: "QR",
    geo: "-1.95,30.06",
    timezone: "Africa/Kigali",
    myAmount: 50000,
    paymentSms: "MoMo: paid 50000 to Serena",
  }),
});
console.log("created", req);

const login = await j("/api/v1/auth/token", {
  method: "POST",
  body: JSON.stringify({ grant_type: "password", phone: "+250788000101", password: "GqDemo#2026" }),
});

const processed = await j(`/api/v1/requests/${req.gqId}/process`, {
  method: "POST",
  headers: { Authorization: `Bearer ${login.token}` },
  body: "{}",
});
console.log("processing", processed.status, processed.decision);

const avail = await j(`/api/v1/requests/${req.gqId}/avail`, {
  method: "POST",
  headers: { Authorization: `Bearer ${login.token}` },
  body: "{}",
});
console.log("avail", avail.status, avail.sdcNumber);

const invoice = await j(`/api/v1/invoices/${req.gqId}`, {
  headers: { Authorization: `Bearer ${tok.token}` },
});
console.log("buyer pull", invoice.status, invoice.sdcNumber, Boolean(invoice.invoiceOriginal));
