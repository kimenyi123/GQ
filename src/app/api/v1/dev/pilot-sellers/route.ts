import { listPilotSellersRoute } from "@/lib/api-v1";

export async function GET() {
  return listPilotSellersRoute();
}
