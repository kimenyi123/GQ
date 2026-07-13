const base = "http://localhost:3000/api/v1";

async function main() {
  const issue = await fetch(`${base}/otp/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+250788000001" }),
  }).then((r) => r.json());
  console.log("OTP issue:", JSON.stringify(issue));

  const code = issue.data?.debugCode || "123456";
  const verify = await fetch(`${base}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+250788000001", code }),
  }).then((r) => r.json());
  console.log("OTP verify:", JSON.stringify(verify));

  const token = verify.data?.token;
  const req = await fetch(`${base}/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: "+250788000001",
      payload: "GQ2|100000001|MRC-CKT001|2026-07-13T03:00:00.000Z|DOC-000001",
      channel: "QR",
    }),
  }).then((r) => r.json());
  console.log("Request:", JSON.stringify(req));

  const status = await fetch(`${base}/status`).then((r) => r.json());
  console.log("Status:", JSON.stringify(status));

  const sim = await fetch(`${base}/dev/simulate-scan`, { method: "POST" }).then((r) => r.json());
  console.log("Simulate:", JSON.stringify(sim));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
