import { rraRecordRoute } from "@/lib/api-v1";

export async function GET(
  request: Request,
  { params }: { params: { gqId: string } },
) {
  return rraRecordRoute(request, params.gqId);
}
