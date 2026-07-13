import { vendorHealthRoute } from "@/lib/api-v1";

export async function GET(
  _request: Request,
  { params }: { params: { vendorId: string } },
) {
  return vendorHealthRoute(params.vendorId);
}
