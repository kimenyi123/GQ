import { upsertDraftRoute } from "@/lib/api-v1";

export async function POST(request: Request) {
  return upsertDraftRoute(request);
}
