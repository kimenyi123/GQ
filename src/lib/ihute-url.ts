/** Deep-link into Ishyiga Ihute Umuriro (grandma quick shop) with MoMo sticker fields. */

export function buildIhuteUmuriroUrl(input: {

  name: string;

  momoCode: string;

  tin?: string;

  mrc?: string;

  payload?: string;

}) {

  const base = process.env.NEXT_PUBLIC_IHUTE_UMURIRO_URL ?? "https://shop.ihute.rw/register/umuriro";

  const url = new URL(base);

  url.searchParams.set("name", input.name);

  url.searchParams.set("momo", input.momoCode.replace(/\D/g, ""));

  if (input.tin) url.searchParams.set("tin", input.tin);

  if (input.mrc) url.searchParams.set("mrc", input.mrc);

  if (input.payload) url.searchParams.set("payload", input.payload);

  return url.toString();

}



export { buildMomoUssd } from "@/lib/momo-payment";

