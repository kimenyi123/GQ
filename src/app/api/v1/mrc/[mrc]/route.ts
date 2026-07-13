import { getMrcRoute, patchMrcRoute } from "@/lib/api-v1";

export async function GET(
  _request: Request,
  { params }: { params: { mrc: string } },
) {
  return getMrcRoute(params.mrc);
}

export async function PATCH(
  request: Request,
  { params }: { params: { mrc: string } },
) {
  return patchMrcRoute(request, params.mrc);
}
