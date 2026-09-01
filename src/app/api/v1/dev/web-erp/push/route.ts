import { webErpPushRoute } from "@/lib/web-erp-api";

export async function POST(request: Request) {
  return webErpPushRoute(request);
}
