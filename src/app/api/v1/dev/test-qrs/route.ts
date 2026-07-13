import { listTestQrsRoute } from "@/lib/api-v1";

export async function GET() {
  return listTestQrsRoute();
}
