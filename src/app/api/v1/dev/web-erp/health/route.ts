import { webErpHealthRoute } from "@/lib/web-erp-api";

export async function GET() {
  return webErpHealthRoute();
}
