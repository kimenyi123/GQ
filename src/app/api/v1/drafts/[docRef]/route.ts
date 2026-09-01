import { getDraftRoute } from "@/lib/api-v1";

export async function GET(
  _request: Request,
  { params }: { params: { docRef: string } },
) {
  return getDraftRoute(decodeURIComponent(params.docRef));
}
