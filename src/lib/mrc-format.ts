/**
 * MRC form: VVVCCCXXXXXX
 *   VVV = vendor — first 3 letters (A–Z)
 *   CCC = seller — first 3 letters (A–Z)
 *   XXXXXX = device count from 1, zero-padded to 6
 */
export function code3(label: string): string {
  const letters = label.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "XXX").padEnd(3, "X");
}

export function buildMrc(vendorLabel: string, sellerLabel: string, deviceIndex: number): string {
  if (deviceIndex < 1) throw new Error("device index starts at 1");
  return `${code3(vendorLabel)}${code3(sellerLabel)}${String(deviceIndex).padStart(6, "0")}`;
}

export function parseMrc(mrc: string): { vendorCode: string; sellerCode: string; deviceIndex: number } | null {
  if (!/^[A-Z]{6}\d{6}$/.test(mrc)) return null;
  return {
    vendorCode: mrc.slice(0, 3),
    sellerCode: mrc.slice(3, 6),
    deviceIndex: Number(mrc.slice(6)),
  };
}
