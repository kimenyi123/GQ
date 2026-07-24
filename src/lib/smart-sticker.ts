import { appendShopToScanUrl, normalizeShopGroup, sectorDefaultGroup, type ShopProductGroup } from "./ihute-shop";
import { resolvePublicAppUrl } from "./app-url";
import { buildGq3ScanUrl, buildMomoPayload } from "./qr";
import { appendPayablesToScanUrl } from "./payment-gateway";

export type PayableAccount = {
  id: string;
  provider: string;
  code: string;
  pillBg: string;
  pillText: string;
};

export type SmartStickerConfig = {
  brandTop: string;
  brandBottom: string;
  certifiedBy: string;
  scanWord: string;
  payWord: string;
  buildWord: string;
  tin: string;
  mrc: string;
  momoCode: string;
  izina: string;
  payables: PayableAccount[];
  payablesFooter: string;
  cameraHint: string;
  sabaTitle: string;
  sabaSubtitle: string;
  ihuteUrl: string;
  ihuteTagline: string;
  extraNote: string;
  /** Base URL inside the QR (production: https://ebm.rw) */
  appBaseUrl: string;
  /** ihute.rw/shop-with-me/{nickname} */
  shopNickname: string;
  /** pharmacy | boutique | supermarket — picks default ?group= */
  shopSector: string;
  /** imiti | ibiryo — product group deep link */
  shopGroup: ShopProductGroup | "";
};

export function defaultStickerConfig(): SmartStickerConfig {
  return {
    brandTop: "ISHYIGA",
    brandBottom: "SOFTWARE",
    certifiedBy: "Certified by RRA",
    scanWord: "SCAN.",
    payWord: "PAY.",
    buildWord: "BUILD RWANDA",
    tin: "100000101",
    mrc: "ISHSER000006",
    momoCode: "0788101",
    izina: "Algorithm Inc.",
    payables: [
      { id: "1", provider: "Access Bank", code: "4555", pillBg: "#F5B800", pillText: "#1a1a1a" },
      { id: "2", provider: "Airtel", code: "55512", pillBg: "#E4002B", pillText: "#ffffff" },
      { id: "3", provider: "BK", code: "55544", pillBg: "#0057A8", pillText: "#ffffff" },
    ],
    payablesFooter: "Algorithm Inc.",
    cameraHint: "Fotora na camera yawe",
    sabaTitle: "SABA EBM YAWE",
    sabaSubtitle: "Ni uburenganzira bwawe",
    ihuteUrl: "ihute.rw",
    ihuteTagline: "Smart Shop · Smart Business",
    extraNote: "",
    appBaseUrl: resolvePublicAppUrl(),
    shopNickname: "tetaremera",
    shopSector: "pharmacy",
    shopGroup: "imiti",
  };
}

export function stickerFromQuery(params: URLSearchParams): Partial<SmartStickerConfig> {
  const partial: Partial<SmartStickerConfig> = {};
  if (params.get("tin")) partial.tin = params.get("tin")!;
  if (params.get("mrc")) partial.mrc = params.get("mrc")!;
  if (params.get("momo")) partial.momoCode = params.get("momo")!;
  if (params.get("name")) {
    partial.izina = params.get("name")!;
    partial.payablesFooter = params.get("name")!;
  }
  if (params.get("shop")) partial.shopNickname = params.get("shop")!;
  if (params.get("group")) partial.shopGroup = normalizeShopGroup(params.get("group")!);
  if (params.get("sector")) {
    partial.shopSector = params.get("sector")!;
    if (!params.get("group")) partial.shopGroup = sectorDefaultGroup(params.get("sector")!);
  }
  return partial;
}

export function buildStickerQrPayload(config: SmartStickerConfig) {
  return buildMomoPayload({
    tin: config.tin.trim(),
    mrc: config.mrc.trim(),
    momoCode: config.momoCode.trim(),
    name: config.izina.trim(),
  });
}

export function buildStickerScanUrl(config: SmartStickerConfig) {
  const scan = buildGq3ScanUrl(buildStickerQrPayload(config), config.appBaseUrl);
  const withPay = appendPayablesToScanUrl(scan, config.payables);
  const group = config.shopGroup || sectorDefaultGroup(config.shopSector);
  return appendShopToScanUrl(withPay, config.shopNickname, group);
}

export function newPayableRow(): PayableAccount {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    provider: "Provider",
    code: "0000",
    pillBg: "#F5B800",
    pillText: "#1a1a1a",
  };
}
