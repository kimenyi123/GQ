import { sellerMrcRoute } from "@/lib/api-v1";

export async function GET(
  request: Request,
  { params }: { params: { tin: string } },
) {
  return sellerMrcRoute(request, params.tin);
}
