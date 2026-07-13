import { authTokenRoute } from "@/lib/api-v1";

export async function POST(request: Request) {
  return authTokenRoute(request);
}
