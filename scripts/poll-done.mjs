await new Promise((r) => setTimeout(r, 2000));
const status = await fetch("http://localhost:3000/api/v1/status").then((r) => r.json());
console.log("after wait", JSON.stringify(status.data.queues));

// login as citizen and get request - use public status is enough
// Try invoices endpoint needs auth - instead query via simulate path
const otp = await fetch("http://localhost:3000/api/v1/otp/issue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+250788000001" }),
}).then((r) => r.json());
const verify = await fetch("http://localhost:3000/api/v1/otp/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+250788000001", code: otp.data.debugCode }),
}).then((r) => r.json());
const inv = await fetch("http://localhost:3000/api/v1/invoices/GQ-000121", {
  headers: { Authorization: `Bearer ${verify.data.token}` },
}).then((r) => r.json());
console.log("invoice GQ-000121", JSON.stringify(inv));
const req = await fetch("http://localhost:3000/api/v1/requests/GQ-000121", {
  headers: { Authorization: `Bearer ${verify.data.token}` },
}).then((r) => r.json());
console.log("request GQ-000121", JSON.stringify(req));
