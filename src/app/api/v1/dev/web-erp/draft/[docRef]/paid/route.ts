import { webErpPaidRoute } from "@/lib/web-erp-api";

export async function POST(
  request: Request,
  { params }: { params: { docRef: string } },
) {
  return webErpPaidRoute(request, params.docRef);
}
