import { getInvoiceRoute } from "@/lib/api-v1";

export async function GET(
  request: Request,
  { params }: { params: { gqId: string } },
) {
  return getInvoiceRoute(request, params.gqId);
}
