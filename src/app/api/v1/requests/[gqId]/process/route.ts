import { processRequestRoute } from "@/lib/api-v1";

export async function POST(
  request: Request,
  { params }: { params: { gqId: string } },
) {
  return processRequestRoute(request, params.gqId);
}
