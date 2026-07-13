for (const url of [
  "http://127.0.0.1:3000/api/v1/health",
  "https://127.0.0.1:3000/api/v1/health",
]) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    console.log(url, r.status);
  } catch (e) {
    console.log(url, "ERR", e instanceof Error ? e.message : e);
  }
}
