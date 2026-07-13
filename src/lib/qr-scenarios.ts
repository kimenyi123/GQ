/**
 * Canonical test scenarios for Global QR.
 * Organized by ENTRY DOCUMENT type × DEVICE — not by random seed rows.
 *
 * Doc types (what the customer is asking an invoice for):
 *   ORDER          — hotel / restaurant order
 *   PROFORMA       — insurance / quotation before payment
 *   DELIVERY_NOTE  — bar / goods delivered, invoice follows
 *
 * Devices (where the QR lives):
 *   TABLE    — printed sticker on a table
 *   DESKTOP  — counter / POS / desktop screen
 */

export const DOC_TYPES = ["ORDER", "PROFORMA", "DELIVERY_NOTE"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DEVICE_TYPES = ["TABLE", "DESKTOP"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export type QrScenario = {
  id: string;
  /** Human scenario title */
  title: string;
  /** Business context */
  business: string;
  sector: string;
  tin: string;
  mrc: string;
  docType: DocType;
  device: DeviceType;
  /** STATIC sticker vs DYNAMIC screen/receipt */
  qrKind: "GQ1" | "GQ2";
  docRef: string;
  amount: number;
  explanation: string;
};

/** Fixed demo matrix — every Doc × Device combination that makes sense */
export const QR_SCENARIOS: QrScenario[] = [
  // —— HOTEL → ORDER ——
  {
    id: "hotel-order-table",
    title: "Hotel order · Table QR",
    business: "Chez Kivu Hotel",
    sector: "hotel",
    tin: "100000001",
    mrc: "MRC-HOT-TBL",
    docType: "ORDER",
    device: "TABLE",
    qrKind: "GQ1",
    docRef: "ORD-HOTEL-TBL-01",
    amount: 45000,
    explanation: "Guest scans the QR on the dining table and asks for the EBM for their order.",
  },
  {
    id: "hotel-order-desktop",
    title: "Hotel order · Desktop / POS",
    business: "Chez Kivu Hotel",
    sector: "hotel",
    tin: "100000001",
    mrc: "MRC-HOT-DSK",
    docType: "ORDER",
    device: "DESKTOP",
    qrKind: "GQ2",
    docRef: "ORD-HOTEL-DSK-01",
    amount: 78000,
    explanation: "Reception / POS screen shows a dynamic QR for the open hotel order.",
  },

  // —— INSURANCE → PROFORMA ——
  {
    id: "insurance-proforma-desktop",
    title: "Insurance proforma · Desktop",
    business: "Radiant Insurance",
    sector: "insurance",
    tin: "100000010",
    mrc: "MRC-INS-DSK",
    docType: "PROFORMA",
    device: "DESKTOP",
    qrKind: "GQ2",
    docRef: "PRF-INS-DSK-01",
    amount: 250000,
    explanation: "Client scans the proforma QR on the agent desktop before paying the premium.",
  },
  {
    id: "insurance-proforma-table",
    title: "Insurance proforma · Table / desk card",
    business: "Radiant Insurance",
    sector: "insurance",
    tin: "100000010",
    mrc: "MRC-INS-TBL",
    docType: "PROFORMA",
    device: "TABLE",
    qrKind: "GQ1",
    docRef: "PRF-INS-TBL-01",
    amount: 180000,
    explanation: "Printed QR on the advisory desk for a quoted proforma.",
  },

  // —— BAR → DELIVERY NOTE ——
  {
    id: "bar-delivery-table",
    title: "Bar delivery note · Table QR",
    business: "Kigali Night Bar",
    sector: "bar",
    tin: "100000011",
    mrc: "MRC-BAR-TBL",
    docType: "DELIVERY_NOTE",
    device: "TABLE",
    qrKind: "GQ1",
    docRef: "DN-BAR-TBL-01",
    amount: 22000,
    explanation: "Customer scans table QR after drinks are delivered; asks for the EBM.",
  },
  {
    id: "bar-delivery-desktop",
    title: "Bar delivery note · Desktop / counter",
    business: "Kigali Night Bar",
    sector: "bar",
    tin: "100000011",
    mrc: "MRC-BAR-DSK",
    docType: "DELIVERY_NOTE",
    device: "DESKTOP",
    qrKind: "GQ2",
    docRef: "DN-BAR-DSK-01",
    amount: 35500,
    explanation: "Bartender counter screen shows dynamic QR linked to the delivery note.",
  },
];

export const DOC_TYPE_META: Record<
  DocType,
  { label: string; example: string; sectorHint: string }
> = {
  ORDER: {
    label: "Order",
    example: "Hotel / restaurant produces an order",
    sectorHint: "Hotel",
  },
  PROFORMA: {
    label: "Proforma",
    example: "Insurance produces a proforma",
    sectorHint: "Insurance",
  },
  DELIVERY_NOTE: {
    label: "Delivery note",
    example: "Bar produces a delivery note",
    sectorHint: "Bar",
  },
};

export const DEVICE_META: Record<DeviceType, { label: string; hint: string }> = {
  TABLE: { label: "Table", hint: "Printed sticker on a table / desk" },
  DESKTOP: { label: "Desktop", hint: "POS / counter / desktop screen" },
};
