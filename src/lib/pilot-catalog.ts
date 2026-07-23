import { buildMrc, code3 } from "./mrc-format";

export type DeviceKind = "TABLE" | "DESKTOP" | "WINDOWS" | "MOMO";
export type DocType = "ORDER" | "PROFORMA" | "DELIVERY_NOTE";
export type QrKind = "GQ1" | "GQ2" | "GQ3";

export type PilotVendor = {
  vendorId: string;
  name: string;
  codeLabel: string;
  vsdcPath: string;
  oauthClientId: string;
};

export type PilotSeller = {
  tin: string;
  name: string;
  codeLabel: string;
  sector: string;
  vendorId: string | null;
  phone: string;
  email: string;
  defaultDocType: DocType;
  /** Merchant MoMoPay code (digits) — used for GQ3 stickers */
  momoCode?: string;
};

export type PilotDevice = {
  mrc: string;
  tin: string;
  vendorId: string | null;
  deviceType: DeviceKind;
  locationLabel: string;
  qrKind: QrKind;
  deviceIndex: number;
};

export type PilotDoc = {
  docId: string;
  moveId: string;
  tin: string;
  mrc: string;
  vendorId: string | null;
  docType: DocType;
  amount: number;
  vat: number;
  items: { name: string; qty: number; price: number }[];
};

export const PILOT_PASSWORD = "GqDemo#2026";

export const PILOT_VENDORS: PilotVendor[] = [
  {
    vendorId: "VND-ISHYIGA",
    name: "Ishyiga",
    codeLabel: "Ishyiga",
    vsdcPath: "ISHYIGA_API_VSDC",
    oauthClientId: "gq_ishyiga_demo",
  },
  {
    vendorId: "VND-MICROINVEST",
    name: "Microinvest",
    codeLabel: "Microinvest",
    vsdcPath: "RRA_API_VSDC",
    oauthClientId: "gq_microinvest_demo",
  },
  {
    vendorId: "VND-NOSOFTWARE",
    name: "NoSoftware",
    codeLabel: "NoSoftware",
    vsdcPath: "NONE",
    oauthClientId: "gq_nosoftware_demo",
  },
];

/**
 * Sample companies + device counts (TABLE / DESKTOP / WINDOWS).
 * MRC = VVV(vendor) + CCC(seller) + XXXXXX(device # from 1).
 */
export const PILOT_SELLERS: PilotSeller[] = [
  {
    tin: "100000101",
    name: "Serena",
    codeLabel: "Serena",
    sector: "hotel",
    vendorId: "VND-ISHYIGA",
    phone: "+250788000101",
    email: "seller@serena.demo",
    defaultDocType: "ORDER",
    momoCode: "0788101",
  },
  {
    tin: "100000102",
    name: "Burrows",
    codeLabel: "Burrows",
    sector: "restaurant",
    vendorId: "VND-MICROINVEST",
    phone: "+250788000102",
    email: "seller@burrows.demo",
    defaultDocType: "ORDER",
    momoCode: "0788102",
  },
  {
    tin: "100000103",
    name: "Cheaz Lando",
    codeLabel: "Cheaz",
    sector: "hospitality",
    vendorId: "VND-ISHYIGA",
    phone: "+250788000103",
    email: "seller@cheazlando.demo",
    defaultDocType: "ORDER",
    momoCode: "0788103",
  },
  {
    tin: "100000104",
    name: "Butique",
    codeLabel: "Butique",
    sector: "retail",
    vendorId: "VND-NOSOFTWARE",
    phone: "+250788000104",
    email: "seller@butique.demo",
    defaultDocType: "DELIVERY_NOTE",
    momoCode: "0788104",
  },
  {
    tin: "100000105",
    name: "IMPACT PHARMA LTD",
    codeLabel: "Impact",
    sector: "pharmacy",
    vendorId: "VND-ISHYIGA",
    phone: "+250788000105",
    email: "seller@impactpharma.demo",
    defaultDocType: "ORDER",
    momoCode: "077800",
  },
];

type DeviceSpec = { kind: DeviceKind; count: number };

const DEVICE_SPECS: Record<string, { vendorLabel: string; stack: string; devices: DeviceSpec[] }> = {
  "100000101": {
    vendorLabel: "Ishyiga",
    stack: "Opera via Ishyiga API VSDC",
    devices: [
      { kind: "TABLE", count: 2 },
      { kind: "DESKTOP", count: 3 },
    ],
  },
  "100000102": {
    vendorLabel: "Microinvest",
    stack: "Microinvest via RRA API VSDC",
    devices: [
      { kind: "TABLE", count: 5 },
      { kind: "DESKTOP", count: 2 },
    ],
  },
  "100000103": {
    vendorLabel: "Ishyiga",
    stack: "Ishyiga Hospitality",
    devices: [
      { kind: "TABLE", count: 4 },
      { kind: "DESKTOP", count: 4 },
    ],
  },
  "100000104": {
    vendorLabel: "NoSoftware",
    stack: "NoSoftware (table / Windows)",
    devices: [{ kind: "WINDOWS", count: 1 }],
  },
  "100000105": {
    vendorLabel: "Ishyiga",
    stack: "Pharmacy · MoMoPay sticker (real sample)",
    devices: [],
  },
};

function amountBase(tin: string, idx: number) {
  const seed = Number(tin.slice(-3));
  return 8000 + seed * 10 + idx * 1500;
}

export function buildPilotDevices(): PilotDevice[] {
  const out: PilotDevice[] = [];

  for (const seller of PILOT_SELLERS) {
    const spec = DEVICE_SPECS[seller.tin];
    if (!spec) continue;
    let deviceIndex = 1;
    for (const block of spec.devices) {
      for (let i = 0; i < block.count; i += 1) {
        const mrc = buildMrc(spec.vendorLabel, seller.codeLabel, deviceIndex);
        const isStatic = block.kind === "TABLE";
        out.push({
          mrc,
          tin: seller.tin,
          vendorId: seller.vendorId,
          deviceType: block.kind,
          locationLabel: `${block.kind} ${i + 1}`,
          qrKind: isStatic ? "GQ1" : "GQ2",
          deviceIndex,
        });
        deviceIndex += 1;
      }
    }
  }

  return out;
}

export function buildPilotDocs(devices: PilotDevice[]): PilotDoc[] {
  return devices.map((d) => {
    const seller = PILOT_SELLERS.find((s) => s.tin === d.tin)!;
    const amount = amountBase(d.tin, d.deviceIndex);
    const vat = Math.round(amount * 0.18);
    const docType = seller.defaultDocType;
    const prefix = docType === "ORDER" ? "ORD" : docType === "PROFORMA" ? "PRF" : "DN";
    const docId = `${prefix}-${code3(seller.name)}${String(d.deviceIndex).padStart(4, "0")}`;

    return {
      docId,
      moveId: `MOV-${d.mrc}`,
      tin: d.tin,
      mrc: d.mrc,
      vendorId: d.vendorId,
      docType,
      amount,
      vat,
      items: [{ name: `${seller.name} ${docType} line`, qty: 1, price: amount }],
    };
  });
}

export type QrCard = {
  id: string;
  business: string;
  tin: string;
  mrc: string;
  stack: string;
  vendorId: string | null;
  vendorName: string;
  device: DeviceKind;
  deviceIndex: number;
  locationLabel: string;
  qrKind: QrKind;
  docType: DocType;
  docId: string;
  amount: number;
  vat: number;
  momoCode?: string;
  merchantName?: string;
  explanation: string;
};

export function buildPilotMomoStickers() {
  const devices = buildPilotDevices();
  const maxIndexByTin = new Map<string, number>();
  for (const d of devices) {
    maxIndexByTin.set(d.tin, Math.max(maxIndexByTin.get(d.tin) ?? 0, d.deviceIndex));
  }

  const out: Array<{
    tin: string;
    business: string;
    merchantName: string;
    mrc: string;
    momoCode: string;
    vendorId: string | null;
    deviceIndex: number;
    stack: string;
  }> = [];

  for (const seller of PILOT_SELLERS) {
    const spec = DEVICE_SPECS[seller.tin];
    if (!spec || !seller.momoCode) continue;
    const deviceIndex = (maxIndexByTin.get(seller.tin) ?? 0) + 1;
    const mrc = buildMrc(spec.vendorLabel, seller.codeLabel, deviceIndex);
    out.push({
      tin: seller.tin,
      business: seller.name,
      merchantName: seller.name,
      mrc,
      momoCode: seller.momoCode,
      vendorId: seller.vendorId,
      deviceIndex,
      stack: spec.stack,
    });
  }

  return out;
}

export function buildQrCatalog(): QrCard[] {
  const devices = buildPilotDevices();
  const docs = buildPilotDocs(devices);
  const docByMrc = new Map(docs.map((d) => [d.mrc, d]));

  const deviceCards = devices.map((d) => {
    const seller = PILOT_SELLERS.find((s) => s.tin === d.tin)!;
    const vendor = PILOT_VENDORS.find((v) => v.vendorId === d.vendorId);
    const doc = docByMrc.get(d.mrc)!;
    const stack = DEVICE_SPECS[d.tin]?.stack ?? "";

    return {
      id: `${d.tin}-${d.mrc}`,
      business: seller.name,
      tin: d.tin,
      mrc: d.mrc,
      stack,
      vendorId: d.vendorId,
      vendorName: vendor?.name ?? "None",
      device: d.deviceType,
      deviceIndex: d.deviceIndex,
      locationLabel: d.locationLabel,
      qrKind: d.qrKind,
      docType: doc.docType,
      docId: doc.docId,
      amount: doc.amount,
      vat: doc.vat,
      explanation:
        d.qrKind === "GQ1"
          ? `Table sticker · TIN+MRC only · open ${doc.docType} resolved after scan`
          : `Screen QR · includes doc ${doc.docId} · ${doc.docType}`,
    };
  });

  const momoCards = buildPilotMomoStickers().map((m) => {
    const vendor = PILOT_VENDORS.find((v) => v.vendorId === m.vendorId);
    return {
      id: `momo-${m.tin}-${m.mrc}`,
      business: m.business,
      tin: m.tin,
      mrc: m.mrc,
      stack: m.stack,
      vendorId: m.vendorId,
      vendorName: vendor?.name ?? "None",
      device: "MOMO" as const,
      deviceIndex: m.deviceIndex,
      locationLabel: "MoMoPay sticker",
      qrKind: "GQ3" as const,
      docType: "ORDER" as const,
      docId: "—",
      amount: 0,
      vat: 0,
      momoCode: m.momoCode,
      merchantName: m.merchantName,
      explanation: `GQ3 · ${m.merchantName} · MoMo ${m.momoCode} · scan opens Ishyura on phone`,
    };
  });

  return [...deviceCards, ...momoCards];
}
