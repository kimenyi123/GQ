for (const n of ["rra-logo", "flag-rw", "flag-en", "flag-fr", "flag-sw"]) {
  const r = await fetch(`http://localhost:3000/brand/${n}.png`);
  console.log(n, r.status);
}
