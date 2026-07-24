const SHOP_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_IHUTE_SHOP_BASE) ||
  "https://ihute.rw/shop-with-me";

/** Short codes in GQ scan URLs (?group=imiti) — pre-fills Ibyo ndagura, not ihute link. */
export type ShopProductGroup = "imiti" | "ibiryo";

export type ShopSectorPreset = {
  id: string;
  label: string;
  group: ShopProductGroup;
};

/** Sector → default product group for QR scan URL. */
export const SHOP_SECTOR_PRESETS: ShopSectorPreset[] = [
  { id: "pharmacy", label: "Pharmacy", group: "imiti" },
  { id: "boutique", label: "Butike", group: "ibiryo" },
  { id: "supermarket", label: "Supermarket", group: "ibiryo" },
];

export const SHOP_PRODUCT_GROUPS: { id: ShopProductGroup; label: string; hint: string }[] = [
  { id: "imiti", label: "Imiti", hint: "Pharmacy · medicines" },
  { id: "ibiryo", label: "Ibiryo", hint: "Food · groceries" },
];

export function slugifyShopNickname(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeShopGroup(raw: string): ShopProductGroup | "" {
  const g = raw.trim().toLowerCase();
  if (g === "imiti" || g === "medicine" || g === "medicines" || g === "pharma" || g === "pharmacy") {
    return "imiti";
  }
  if (
    g === "ibiryo" ||
    g === "food" ||
    g === "groceries" ||
    g === "grocery" ||
    g === "supermarket" ||
    g === "boutique" ||
    g === "butike"
  ) {
    return "ibiryo";
  }
  return "";
}

export function shopGroupLabel(group: ShopProductGroup | "") {
  if (!group) return "";
  return SHOP_PRODUCT_GROUPS.find((g) => g.id === group)?.label ?? group;
}

export function sectorDefaultGroup(sectorId: string): ShopProductGroup | "" {
  const id = sectorId.trim().toLowerCase();
  return SHOP_SECTOR_PRESETS.find((s) => s.id === id)?.group ?? "";
}

/** Ihute shop link — no group param (group stays on GQ scan URL / Ibyo ndagura only). */
export function buildIhuteShopUrl(nickname: string) {
  const slug = slugifyShopNickname(nickname);
  if (!slug) return "";
  return `${SHOP_BASE.replace(/\/$/, "")}/${slug}`;
}

export function appendShopToScanUrl(scanUrl: string, nickname: string, group?: ShopProductGroup | "") {
  const slug = slugifyShopNickname(nickname);
  if (!slug) return scanUrl;
  const url = new URL(scanUrl);
  url.searchParams.set("shop", slug);
  const normalized = group ? normalizeShopGroup(group) : "";
  if (normalized) url.searchParams.set("group", normalized);
  else url.searchParams.delete("group");
  return url.toString();
}

export function readShopNicknameFromSearch(search: string) {
  const raw = new URLSearchParams(search).get("shop")?.trim() ?? "";
  return slugifyShopNickname(raw);
}

export function readShopGroupFromSearch(search: string): ShopProductGroup | "" {
  const raw = new URLSearchParams(search).get("group")?.trim() ?? "";
  return normalizeShopGroup(raw);
}
