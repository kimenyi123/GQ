import { simulatorLanProxyRoute } from "@/lib/api-v1";

export async function GET(request: Request) {
  return simulatorLanProxyRoute(request);
}

export async function POST(request: Request) {
  return simulatorLanProxyRoute(request);
}
