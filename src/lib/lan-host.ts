import os from "os";

const PRIVATE_V4 =
  /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

function scoreNic(address: string) {
  if (address.startsWith("192.168.")) return 3;
  if (address.startsWith("10.")) return 2;
  return 1;
}

/** Pick Wi-Fi / LAN IPv4 from this machine (ipconfig), not localhost. */
export function getMachineLanUrl(port = 3000) {
  const fromEnv = process.env.GQ_DEV_LAN_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const candidates: string[] = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const nic of entries ?? []) {
      if (nic.family !== "IPv4" || nic.internal) continue;
      if (!PRIVATE_V4.test(nic.address)) continue;
      candidates.push(nic.address);
    }
  }

  candidates.sort((a, b) => scoreNic(b) - scoreNic(a));
  const ip = candidates[0];
  if (!ip) return null;

  return `http://${ip}:${port}`;
}
