import { buildMrc, code3 } from "./mrc-format";

export type DeviceKind = "TABLE" | "DESKTOP" | "WINDOWS";
export type DocType = "ORDER" | "PROFORMA" | "DELIVERY_NOTE";
export type QrKind = "GQ1" | "GQ2";

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
  explanation: string;
};

export function buildQrCatalog(): QrCard[] {
  const devices = buildPilotDevices();
  const docs = buildPilotDocs(devices);
  const docByMrc = new Map(docs.map((d) => [d.mrc, d]));

  return devices.map((d) => {
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
}
