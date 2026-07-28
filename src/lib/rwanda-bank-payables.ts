import { resolvePublicAppUrl } from "./app-url";
import { appendShopToScanUrl, sectorDefaultGroup } from "./ihute-shop";
import { appendPayablesToScanUrl } from "./payment-gateway";
import { buildGq3ScanUrl, buildMomoPayload } from "./qr";

export type BankPayableRow = {
  id: string;
  provider: string;
  code: string;
  pillBg: string;
  pillText: string;
};

/** Six bank/wallet rails on the sticker (MoMo is primary via GQ3 momoCode, not in this list). */
export const RWANDA_STICKER_BANKS: Omit<BankPayableRow, "id">[] = [
  { provider: "ACCESS", code: "4555", pillBg: "#F5B800", pillText: "#1a1a1a" },
  { provider: "GT BANK", code: "7812", pillBg: "#EE3124", pillText: "#ffffff" },
  { provider: "BPR BANK", code: "3321", pillBg: "#00A651", pillText: "#ffffff" },
  { provider: "BK", code: "55544", pillBg: "#0057A8", pillText: "#ffffff" },
  { provider: "AIRTEL", code: "55512", pillBg: "#E4002B", pillText: "#ffffff" },
  { provider: "EQUITY", code: "88012", pillBg: "#8B1A1A", pillText: "#ffffff" },
];

export function defaultRwandaPayables(): BankPayableRow[] {
  return RWANDA_STICKER_BANKS.map((row, i) => ({
    id: `bank-${i + 1}`,
    ...row,
  }));
}

export type GptStickerBriefInput = {
  tin: string;
  mrc: string;
  momoCode: string;
  izina: string;
  payables: BankPayableRow[];
  shopNickname: string;
  shopGroup: string;
  shopSector: string;
  appBaseUrl: string;
};

function buildScanUrlForBrief(config: GptStickerBriefInput) {
  const payload = buildMomoPayload({
    tin: config.tin.trim(),
    mrc: config.mrc.trim(),
    momoCode: config.momoCode.trim(),
    name: config.izina.trim(),
  });
  const scan = buildGq3ScanUrl(payload, resolvePublicAppUrl(config.appBaseUrl));
  const withPay = appendPayablesToScanUrl(scan, config.payables);
  const group = config.shopGroup || sectorDefaultGroup(config.shopSector);
  return appendShopToScanUrl(withPay, config.shopNickname, group);
}

/** Text to paste into ChatGPT to validate codes / regenerate scan URL. */
export function buildGptStickerBrief(config: GptStickerBriefInput) {
  const scanUrl = buildScanUrlForBrief(config);
  const momoDigits = config.momoCode.replace(/\D/g, "");

  const payLines = config.payables
    .map((p, i) => `${i + 1}. ${p.provider} — till/merchant code: ${p.code} (pill ${p.pillBg})`)
    .join("\n");

  return `GLOBAL_QR payment sticker — Rwanda EBM (Saba EBM yawe)

PRIMARY PAYMENT (MTN MoMo — in QR payload, NOT in pay= list):
- Izina: ${config.izina}
- TIN: ${config.tin}
- MRC: ${config.mrc}
- MoMo code: ${config.momoCode}
- GQ3 payload: GQ3|${config.tin}|${config.mrc}|${momoDigits}|${config.izina}

SECONDARY RAILS (6 banks on sticker — pay= URL param):
${payLines}

Ihute shop: ${config.shopNickname || "(none)"}
Product group (Ibyo ndagura default): ${config.shopGroup || config.shopSector || "(none)"}
QR base URL: ${resolvePublicAppUrl(config.appBaseUrl)}

SCAN URL FORMAT:
{base}/?payload=GQ3|TIN|MRC|MOMO|NAME&pay=ACCESS~code~F5B800|GT BANK~code~EE3124|...&shop=nickname&group=imiti

pay= encoding: Provider~merchantCode~pillColorHex (no #), joined with |

CURRENT SCAN URL (verify this is correct):
${scanUrl}

TASK:
1. Confirm each bank merchant/till code is valid for Rwanda (Access, GT Bank MPay, BPR, BK, Airtel Money, Equity Fasta).
2. Return the corrected pay= string and full https://ebm.rw scan URL.
3. MoMo stays primary; do not duplicate MoMo inside pay=.`;
}
