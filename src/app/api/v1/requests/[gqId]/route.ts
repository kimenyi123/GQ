import { getRequestRoute } from "@/lib/api-v1";

export async function GET(
  request: Request,
  { params }: { params: { gqId: string } },
) {
  return getRequestRoute(request, params.gqId);
}
