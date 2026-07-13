import { rraConversionRoute } from "@/lib/api-v1";

export async function GET(request: Request) {
  return rraConversionRoute(request);
}
