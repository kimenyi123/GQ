import { statusRoute } from "@/lib/api-v1";

export async function GET() {
  return statusRoute();
}
