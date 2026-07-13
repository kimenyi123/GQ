import { jsonOk } from "@/lib/api";
import { requireAnyRole } from "@/lib/api-auth";
import { rraBatchGetRoute } from "@/lib/api-v1";
import { runAdjustBatch } from "@/worker/index";

export async function GET(request: Request) {
  return rraBatchGetRoute(request);
}

export async function POST(request: Request) {
  const auth = await requireAnyRole(request, ["rra", "RRA_AGENT", "admin", "GQ_ADMIN"]);

  if (auth.response) {
    return auth.response;
  }

  return jsonOk(await runAdjustBatch());
}
