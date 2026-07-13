const issue = await fetch("http://localhost:3000/api/v1/otp/issue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+250788000001" }),
}).then((r) => r.json());
const verify = await fetch("http://localhost:3000/api/v1/otp/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "+250788000001", code: issue.data.debugCode }),
}).then((r) => r.json());
const mine = await fetch("http://localhost:3000/api/v1/my/requests", {
  headers: { Authorization: `Bearer ${verify.data.token}` },
}).then((r) => r.json());
console.log("count", mine.data?.length, "first", mine.data?.[0]);
