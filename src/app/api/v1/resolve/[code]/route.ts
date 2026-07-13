import { resolveCodeRoute } from "@/lib/api-v1";

export async function GET(
  _request: Request,
  { params }: { params: { code: string } },
) {
  return resolveCodeRoute(params.code);
}
