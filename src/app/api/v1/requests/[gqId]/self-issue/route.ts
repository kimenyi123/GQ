import { selfIssueRoute } from "@/lib/api-v1";

export async function POST(
  request: Request,
  { params }: { params: { gqId: string } },
) {
  return selfIssueRoute(request, params.gqId);
}
