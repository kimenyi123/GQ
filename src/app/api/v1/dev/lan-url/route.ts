import { jsonOk } from "@/lib/api";
import { getMachineLanUrl } from "@/lib/lan-host";

export async function GET() {
  const port = Number(process.env.PORT || 3000);
  const lanUrl = getMachineLanUrl(port);
  return jsonOk({
    lanUrl,
    port,
    hint: lanUrl
      ? "Use this URL in sticker QR so your phone on Wi-Fi can reach this PC."
      : "No private IPv4 found — set GQ_DEV_LAN_URL in .env",
  });
}
