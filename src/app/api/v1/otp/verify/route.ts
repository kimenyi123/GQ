import { verifyOtpRoute } from "@/lib/api-v1";

export async function POST(request: Request) {
  return verifyOtpRoute(request);
}
