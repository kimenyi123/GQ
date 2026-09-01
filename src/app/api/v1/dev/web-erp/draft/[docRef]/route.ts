import { webErpGetDraftRoute } from "@/lib/web-erp-api";

export async function GET(
  _request: Request,
  { params }: { params: { docRef: string } },
) {
  return webErpGetDraftRoute(params.docRef);
}
