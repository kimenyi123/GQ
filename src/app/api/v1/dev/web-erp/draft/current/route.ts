import { webErpCurrentRoute } from "@/lib/web-erp-api";

export async function GET() {
  return webErpCurrentRoute();
}
