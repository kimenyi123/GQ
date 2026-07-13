import { claimVendorMrcRoute } from "@/lib/api-v1";

export async function POST(
  request: Request,
  { params }: { params: { vendorId: string } },
) {
  return claimVendorMrcRoute(request, params.vendorId);
}
