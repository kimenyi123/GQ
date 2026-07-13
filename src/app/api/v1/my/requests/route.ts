import { listMyRequestsRoute } from "@/lib/api-v1";

export async function GET(request: Request) {
  return listMyRequestsRoute(request);
}
