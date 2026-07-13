import { getPaymentRoute } from "@/lib/api-v1";

export async function GET(
  _request: Request,
  { params }: { params: { txnId: string } },
) {
  return getPaymentRoute(params.txnId);
}
