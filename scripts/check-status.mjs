const base = "http://localhost:3000/api/v1";
const r = await fetch(`${base}/status`).then((x) => x.json());
console.log(JSON.stringify(r, null, 2));
const home = await fetch("http://localhost:3000/").then((x) => x.status);
console.log("home", home);
