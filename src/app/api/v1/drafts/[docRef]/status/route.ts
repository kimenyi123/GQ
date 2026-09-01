import { patchDraftStatusRoute } from "@/lib/api-v1";

export async function PATCH(
  request: Request,
  { params }: { params: { docRef: string } },
) {
  return patchDraftStatusRoute(request, decodeURIComponent(params.docRef));
}
