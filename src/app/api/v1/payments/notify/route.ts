import { paymentNotifyRoute } from "@/lib/api-v1";

export async function POST(request: Request) {
  return paymentNotifyRoute(request);
}
