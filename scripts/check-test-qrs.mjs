const r = await fetch("http://localhost:3000/api/v1/dev/test-qrs").then((x) => x.json());
if (!r.ok) {
  console.log(r);
  process.exit(1);
}
console.log("counts", r.data.counts);
console.log(
  "scenarios",
  r.data.scenarios.map((s) => `${s.docType} × ${s.device} → ${s.title}`),
);
