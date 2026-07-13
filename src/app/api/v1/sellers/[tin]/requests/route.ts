import { sellerRequestsRoute } from "@/lib/api-v1";

export async function GET(
  request: Request,
  { params }: { params: { tin: string } },
) {
  return sellerRequestsRoute(request, params.tin);
}
