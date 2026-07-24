import { readShopGroupFromSearch, readShopNicknameFromSearch, type ShopProductGroup } from "./ihute-shop";
import { decodePayablesUrl, type PaymentRail } from "./payment-gateway";

export type ScanContext = {
  payload?: string;
  payables: PaymentRail[];
  shopNickname: string;
  shopGroup: ShopProductGroup | "";
};

/** Read payload, pay rails, shop nickname, and product group from a scan URL or current search string. */
export function readScanContext(input: string): ScanContext {
  const raw = input.trim();
  if (!raw) {
    return { payables: [], shopNickname: "", shopGroup: "" };
  }

  try {
    const url = new URL(raw.includes("://") ? raw : `http://local?${raw.replace(/^\?/, "")}`);
    const search = url.search || (raw.startsWith("?") ? raw : `?${raw}`);
    const payload = new URLSearchParams(search).get("payload")?.trim() ?? undefined;
    return {
      payload,
      payables: decodePayablesUrl(new URLSearchParams(search).get("pay")),
      shopNickname: readShopNicknameFromSearch(search),
      shopGroup: readShopGroupFromSearch(search),
    };
  } catch {
    return { payables: [], shopNickname: "", shopGroup: "" };
  }
}
