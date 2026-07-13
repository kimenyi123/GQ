import { healthRoute } from "@/lib/api-v1";

export async function GET() {
  return healthRoute();
}
