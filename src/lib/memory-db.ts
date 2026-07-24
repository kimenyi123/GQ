import bcrypt from "bcryptjs";
import {
  PILOT_PASSWORD,
  PILOT_SELLERS,
  PILOT_VENDORS,
  buildPilotDevices,
  buildPilotDocs,
  buildPilotMomoStickers,
  buildQrCatalog,
  type QrCard,
} from "./pilot-catalog";
import { encryptPhone, hashPhone } from "./crypto";
import { DEMO_OTP_CODE, isDemoOtpCode, isOpenLoginEnabled, normalizeRwandaPhone } from "./demo-auth";
import { hashOtp } from "./auth";
import { generateAuditId, generateOtpSessionId } from "./ids";

export type MemVendor = {
  vendorId: string;
  name: string;
  vsdcRef: string;
  webhookUrl: string | null;
  oauthClientId: string;
  oauthClientSecretHash: string;
  status: string;
};

export type MemSeller = {
  tin: string;
  name: string;
  sector: string;
  contacts: string;
  vendorId: string | null;
  status: string;
  phone: string;
};

export type MemMrc = {
  mrc: string;
  tin: string;
  vendorId: string | null;
  locationLabel: string;
  deviceType: string;
  qrVersion: string;
  status: string;
  issuedAt: Date;
};

export type MemMove = {
  moveId: string;
  vendorId: string | null;
  tin: string;
  mrc: string;
  moveType: string;
  docId: string;
  items: string;
  amount: number;
  vat: number;
  currency: string;
  ts: Date;
};

/** Master table (architecture) — in-memory pilot row */
export type MemGlobalQr = {
  payloadId: string;
  gqId: string;
  type: string;
  tinSeller: string;
  tinBuyer: string | null;
  phoneEnc: string;
  phoneHash: string;
  amount: number | null;
  declaredAmount: number | null;
  items: string | null;
  bank: string | null;
  bankTxnId: string | null;
  bankAmount: number | null;
  paymentSms: string | null;
  time: Date;
  gps: string | null;
  timezone: string | null;
  status: string;
  decision: string | null;
  decisionBy: string | null;
  decisionTs: Date | null;
  vendorId: string | null;
  mrc: string | null;
  docId: string | null;
  moveId: string | null;
  channel: string;
  rraResponse: string | null;
  invoiceOriginal: string | null;
  regenerate: string | null;
  sdcNumber: string | null;
  invoicePdfUrl: string | null;
  deliveredVia: string | null;
  deliveredTs: Date | null;
  processingNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MemUser = {
  id: string;
  phone: string | null;
  email: string | null;
  passwordHash: string;
  role: string;
  tin: string | null;
  vendorId: string | null;
  name: string | null;
};

export type MemOtp = {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  verified: boolean;
};

export type MemAudit = {
  id: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string;
  after?: string;
  ts: Date;
};

type MemoryDb = {
  vendors: Map<string, MemVendor>;
  sellers: Map<string, MemSeller>;
  mrcs: Map<string, MemMrc>;
  moves: Map<string, MemMove>;
  requests: Map<string, MemGlobalQr>;
  users: Map<string, MemUser>;
  otps: MemOtp[];
  audits: MemAudit[];
  gqSeq: number;
  catalog: QrCard[];
  ready: boolean;
};

const globalStore = globalThis as unknown as { __gqMemoryDb?: MemoryDb };

function emptyDb(): MemoryDb {
  return {
    vendors: new Map(),
    sellers: new Map(),
    mrcs: new Map(),
    moves: new Map(),
    requests: new Map(),
    users: new Map(),
    otps: [],
    audits: [],
    gqSeq: 1,
    catalog: [],
    ready: false,
  };
}

export function getMemoryDb(): MemoryDb {
  if (!globalStore.__gqMemoryDb) {
    globalStore.__gqMemoryDb = emptyDb();
  }
  return globalStore.__gqMemoryDb;
}

export async function ensureMemorySeed() {
  process.env.GQ_PHONE_KEY ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.GQ_OTP_PEPPER ??= "dev-otp-pepper";

  const db = getMemoryDb();
  if (db.ready) return db;

  const passwordHash = await bcrypt.hash(PILOT_PASSWORD, 8);
  const oauthHash = await bcrypt.hash("demo-oauth-secret", 8);

  for (const v of PILOT_VENDORS) {
    db.vendors.set(v.vendorId, {
      vendorId: v.vendorId,
      name: v.name,
      vsdcRef: v.vsdcPath,
      webhookUrl: v.vsdcPath === "NONE" ? null : `mock://${v.vendorId}`,
      oauthClientId: v.oauthClientId,
      oauthClientSecretHash: oauthHash,
      status: v.vsdcPath === "NONE" ? "PENDING" : "LIVE",
    });
  }

  for (const s of PILOT_SELLERS) {
    db.sellers.set(s.tin, {
      tin: s.tin,
      name: s.name,
      sector: s.sector,
      contacts: `${s.phone},${s.email}`,
      vendorId: s.vendorId,
      status: "ACTIVE",
      phone: s.phone,
    });

    const uid = `USR-SELLER-${s.tin}`;
    db.users.set(uid, {
      id: uid,
      phone: s.phone,
      email: s.email,
      passwordHash,
      role: "seller",
      tin: s.tin,
      vendorId: s.vendorId,
      name: `${s.name} seller`,
    });
  }

  // Keep classic Chez Kivu demo seller for burger menu
  db.sellers.set("100000001", {
    tin: "100000001",
    name: "Chez Kivu",
    sector: "hospitality",
    contacts: "+250788000010,manager@chezkivu.rw",
    vendorId: "VND-ISHYIGA",
    status: "ACTIVE",
    phone: "+250788000010",
  });
  db.users.set("USR-SELLER-CK", {
    id: "USR-SELLER-CK",
    phone: "+250788000010",
    email: "manager@chezkivu.rw",
    passwordHash,
    role: "seller",
    tin: "100000001",
    vendorId: "VND-ISHYIGA",
    name: "Chez Kivu seller",
  });

  db.users.set("USR-ADMIN", {
    id: "USR-ADMIN",
    phone: "+250788000099",
    email: "admin@gq.demo",
    passwordHash,
    role: "admin",
    tin: null,
    vendorId: null,
    name: "GQ Admin",
  });
  db.users.set("USR-RRA", {
    id: "USR-RRA",
    phone: "+250788000098",
    email: "rra@gq.demo",
    passwordHash,
    role: "rra",
    tin: null,
    vendorId: null,
    name: "RRA Agent",
  });

  const devices = buildPilotDevices();
  const docs = buildPilotDocs(devices);

  for (const d of devices) {
    db.mrcs.set(d.mrc, {
      mrc: d.mrc,
      tin: d.tin,
      vendorId: d.vendorId,
      locationLabel: d.locationLabel,
      deviceType: d.deviceType,
      qrVersion: d.qrKind,
      status: "ACTIVE",
      issuedAt: new Date(),
    });
  }

  for (const m of buildPilotMomoStickers()) {
    db.mrcs.set(m.mrc, {
      mrc: m.mrc,
      tin: m.tin,
      vendorId: m.vendorId,
      locationLabel: "MoMoPay sticker",
      deviceType: "MOMO",
      qrVersion: "GQ3",
      status: "ACTIVE",
      issuedAt: new Date(),
    });
  }

  for (const doc of docs) {
    db.moves.set(doc.moveId, {
      moveId: doc.moveId,
      vendorId: doc.vendorId,
      tin: doc.tin,
      mrc: doc.mrc,
      moveType: doc.docType,
      docId: doc.docId,
      items: JSON.stringify(doc.items),
      amount: doc.amount,
      vat: doc.vat,
      currency: "RWF",
      ts: new Date(),
    });
  }

  db.catalog = buildQrCatalog();
  db.ready = true;
  return db;
}

export async function nextMemGqId() {
  const db = await ensureMemorySeed();
  const id = `GQ-${String(db.gqSeq).padStart(6, "0")}`;
  db.gqSeq += 1;
  return id;
}

export function writeMemAudit(input: Omit<MemAudit, "id" | "ts"> & { id?: string; ts?: Date }) {
  const db = getMemoryDb();
  db.audits.push({
    id: input.id ?? generateAuditId(),
    actor: input.actor,
    role: input.role,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ts: input.ts ?? new Date(),
  });
}

export async function memIssueOtp(phone: string) {
  await ensureMemorySeed();
  const db = getMemoryDb();
  const normalized = normalizeRwandaPhone(phone);
  const code = isOpenLoginEnabled() ? DEMO_OTP_CODE : String(Math.floor(100000 + Math.random() * 900000));
  const row: MemOtp = {
    id: generateOtpSessionId(),
    phone: normalized,
    codeHash: await hashOtp(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    verified: false,
  };
  db.otps.unshift(row);
  return { code, expiresIn: 600 };
}

export async function memVerifyOtp(phone: string, code: string) {
  await ensureMemorySeed();
  const db = getMemoryDb();
  const normalized = normalizeRwandaPhone(phone);
  const { verifyOtp } = await import("./auth");

  if (isDemoOtpCode(code)) {
    const session = db.otps.find((o) => o.phone === normalized && o.expiresAt > new Date());
    if (session) session.verified = true;
    return true;
  }

  const session = db.otps.find((o) => o.phone === normalized && o.expiresAt > new Date());
  if (!session || !(await verifyOtp(code, session.codeHash))) {
    return false;
  }
  session.verified = true;
  return true;
}

export async function memHasRecentVerifiedOtp(phone: string) {
  await ensureMemorySeed();
  const db = getMemoryDb();
  const normalized = normalizeRwandaPhone(phone);
  const latest = db.otps.find((o) => o.phone === normalized && o.verified);
  return Boolean(latest);
}

export function memFindUserByPhone(phone: string) {
  const db = getMemoryDb();
  return Array.from(db.users.values()).find((u) => u.phone === phone) ?? null;
}

export function memFindUserByRole(role: string) {
  const db = getMemoryDb();
  return Array.from(db.users.values()).find((u) => u.role === role) ?? null;
}

export function memFindVendorByClientId(clientId: string) {
  const db = getMemoryDb();
  return Array.from(db.vendors.values()).find((v) => v.oauthClientId === clientId) ?? null;
}

export function memResolveFromPayload(parsed: {
  version: string;
  tin: string;
  mrc: string;
  docRef?: string;
  docId?: string;
  momoCode?: string;
  name?: string;
}) {
  const db = getMemoryDb();

  if (parsed.version === "GQ3") {
    const mrc = db.mrcs.get(parsed.mrc);
    return {
      tin: parsed.tin,
      mrc: parsed.mrc,
      docId: undefined,
      amount: null,
      vat: null,
      items: null,
      moveId: undefined,
      vendorId: mrc?.vendorId ?? null,
      type: "MOMO",
      momoCode: parsed.momoCode,
      merchantName: parsed.name,
    };
  }

  const docKey = parsed.docId ?? parsed.docRef;
  let move =
    parsed.version === "GQ2" && docKey
      ? Array.from(db.moves.values()).find((m) => m.docId === docKey)
      : undefined;

  if (!move) {
    move = Array.from(db.moves.values())
      .filter((m) => m.tin === parsed.tin && m.mrc === parsed.mrc)
      .sort((a, b) => b.ts.getTime() - a.ts.getTime())[0];
  }

  const mrc = db.mrcs.get(parsed.mrc);
  return {
    tin: parsed.tin,
    mrc: parsed.mrc,
    docId: move?.docId ?? docKey,
    amount: move?.amount ?? null,
    vat: move?.vat ?? null,
    items: move?.items ?? null,
    moveId: move?.moveId,
    vendorId: move?.vendorId ?? mrc?.vendorId ?? null,
    type: move?.moveType ?? "ORDER",
  };
}

export function memResolveFromDocId(docId: string) {
  const db = getMemoryDb();
  const move = Array.from(db.moves.values()).find((m) => m.docId === docId);
  if (!move) return null;
  const seller = db.sellers.get(move.tin);
  return {
    sellerName: seller?.name,
    tin: move.tin,
    amount: move.amount,
    vat: move.vat,
    docId: move.docId,
    docRef: move.docId,
    mrc: move.mrc,
    moveId: move.moveId,
    vendorId: move.vendorId,
    type: move.moveType,
    items: move.items,
  };
}

export async function memCreateRequest(input: {
  phone: string;
  tin: string;
  mrc?: string | null;
  docId?: string | null;
  moveId?: string | null;
  amount?: number | null;
  items?: string | null;
  type?: string;
  vendorId?: string | null;
  channel?: string;
  geo?: string | null;
  timezone?: string | null;
  tinBuyer?: string | null;
  declaredAmount?: number | null;
  paymentSms?: string | null;
  bank?: string | null;
  bankTxnId?: string | null;
  bankAmount?: number | null;
}) {
  await ensureMemorySeed();
  const db = getMemoryDb();
  const phoneHash = hashPhone(input.phone);

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const dup = Array.from(db.requests.values()).find(
    (r) =>
      r.tinSeller === input.tin &&
      (r.mrc ?? null) === (input.mrc ?? null) &&
      (r.docId ?? null) === (input.docId ?? null) &&
      r.phoneHash === phoneHash &&
      r.createdAt.getTime() >= fiveMinAgo,
  );
  if (dup) {
    return dup;
  }

  const gqId = await nextMemGqId();
  const mrcRow = input.mrc ? db.mrcs.get(input.mrc) : undefined;
  const hasVendor = Boolean(input.vendorId ?? mrcRow?.vendorId);
  const status = hasVendor ? "GENERATING" : "STANDBY";
  const decision = hasVendor ? "ROUTED_TO_VENDOR" : "NO_VENDOR";

  const row: MemGlobalQr = {
    payloadId: gqId,
    gqId,
    type: input.type ?? "ORDER",
    tinSeller: input.tin,
    tinBuyer: input.tinBuyer ?? null,
    phoneEnc: encryptPhone(input.phone),
    phoneHash,
    amount: input.amount ?? null,
    declaredAmount: input.declaredAmount ?? null,
    items: input.items ?? null,
    bank: input.bank ?? null,
    bankTxnId: input.bankTxnId ?? null,
    bankAmount: input.bankAmount ?? null,
    paymentSms: input.paymentSms ?? null,
    time: new Date(),
    gps: input.geo ?? null,
    timezone: input.timezone ?? "Africa/Kigali",
    status,
    decision,
    decisionBy: "system",
    decisionTs: new Date(),
    vendorId: input.vendorId ?? mrcRow?.vendorId ?? null,
    mrc: input.mrc ?? null,
    docId: input.docId ?? null,
    moveId: input.moveId ?? null,
    channel: input.channel ?? "QR",
    rraResponse: null,
    invoiceOriginal: null,
    regenerate: null,
    sdcNumber: null,
    invoicePdfUrl: null,
    deliveredVia: null,
    deliveredTs: null,
    processingNote: hasVendor ? "Queued for VSDC" : "No software — seller self-issue",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  db.requests.set(gqId, row);
  writeMemAudit({
    actor: input.phone,
    role: "citizen",
    action: "GLOBAL_QR_CREATE",
    entity: "GlobalQr",
    entityId: gqId,
    after: JSON.stringify({ status, decision }),
  });

  return row;
}

export function memListRequestsForTin(tin: string) {
  const db = getMemoryDb();
  return Array.from(db.requests.values())
    .filter((r) => r.tinSeller === tin)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function memListRequestsForPhoneHash(phoneHash: string) {
  const db = getMemoryDb();
  return Array.from(db.requests.values())
    .filter((r) => r.phoneHash === phoneHash)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function memGetRequest(gqId: string) {
  return getMemoryDb().requests.get(gqId) ?? null;
}

export function memListMrcsForTin(tin: string) {
  const db = getMemoryDb();
  return Array.from(db.mrcs.values()).filter((m) => m.tin === tin);
}

/** Seller starts Ishyiga / vendor VSDC processing */
export function memStartProcessing(gqId: string, actor: string) {
  const db = getMemoryDb();
  const row = db.requests.get(gqId);
  if (!row) throw new Error("Request not found");
  if (row.status !== "QUEUEING" && row.status !== "GENERATING" && row.status !== "STANDBY") {
    throw new Error(`Cannot process from ${row.status}`);
  }
  row.status = "GENERATING";
  row.decision = "UNDER_PROCESSING";
  row.decisionBy = actor;
  row.decisionTs = new Date();
  row.processingNote = "Under processing on Ishyiga / vendor VSDC";
  row.updatedAt = new Date();
  writeMemAudit({
    actor,
    role: "seller",
    action: "UNDER_PROCESSING",
    entity: "GlobalQr",
    entityId: gqId,
    after: JSON.stringify({ status: row.status, decision: row.decision }),
  });
  return row;
}

/** Seller / vendor avails EBM to buyer */
export function memAvailInvoice(
  gqId: string,
  input: { sdcNumber: string; actor: string; role?: string; invoiceOriginal?: unknown },
) {
  const db = getMemoryDb();
  const row = db.requests.get(gqId);
  if (!row) throw new Error("Request not found");
  if (row.status === "DONE") return row;

  const invoiceOriginal =
    typeof input.invoiceOriginal === "string"
      ? input.invoiceOriginal
      : JSON.stringify(
          input.invoiceOriginal ?? {
            sdcNumber: input.sdcNumber,
            tin: row.tinSeller,
            buyerTin: row.tinBuyer,
            amount: row.amount,
            docId: row.docId,
            mrc: row.mrc,
            issuedAt: new Date().toISOString(),
          },
        );

  row.status = "DONE";
  row.decision = "RRA_ACCEPTED";
  row.decisionBy = input.actor;
  row.decisionTs = new Date();
  row.sdcNumber = input.sdcNumber;
  row.rraResponse = JSON.stringify({ accepted: true, sdcNumber: input.sdcNumber });
  row.invoiceOriginal = invoiceOriginal;
  row.invoicePdfUrl = `/i/${gqId}`;
  row.deliveredVia = "PULL";
  row.deliveredTs = new Date();
  row.processingNote = "EBM available for buyer pull";
  row.updatedAt = new Date();

  writeMemAudit({
    actor: input.actor,
    role: input.role ?? "seller",
    action: "INVOICE_AVAIL",
    entity: "GlobalQr",
    entityId: gqId,
    after: JSON.stringify({ sdcNumber: input.sdcNumber }),
  });

  return row;
}

export function memPublicRequestView(row: MemGlobalQr) {
  return {
    gqId: row.gqId,
    payloadId: row.payloadId,
    status: row.status,
    tin: row.tinSeller,
    tinSeller: row.tinSeller,
    tinBuyer: row.tinBuyer,
    mrc: row.mrc,
    docId: row.docId,
    docRef: row.docId,
    amount: row.amount,
    declaredAmount: row.declaredAmount,
    vat: null as number | null,
    channel: row.channel,
    scanTs: row.time.toISOString(),
    time: row.time.toISOString(),
    gps: row.gps,
    timezone: row.timezone,
    decision: row.decision,
    processingNote: row.processingNote,
    vendorId: row.vendorId,
    deliveredVia: row.deliveredVia,
    deliveredTs: row.deliveredTs?.toISOString() ?? null,
    invoicePdfUrl: row.invoicePdfUrl,
    sdcNumber: row.sdcNumber,
    paymentSms: row.paymentSms ? "[provided]" : null,
    bank: row.bank,
    bankTxnId: row.bankTxnId,
    bankAmount: row.bankAmount,
  };
}

export function memInvoiceView(row: MemGlobalQr) {
  return {
    gqId: row.gqId,
    status: row.status,
    sdcNumber: row.sdcNumber,
    rraResponse: row.rraResponse,
    invoicePdfUrl: row.invoicePdfUrl,
    invoiceOriginal: row.invoiceOriginal ? JSON.parse(row.invoiceOriginal) : null,
    deliveredVia: row.deliveredVia,
    deliveredTs: row.deliveredTs?.toISOString() ?? null,
    processingNote: row.processingNote,
    amount: row.amount,
    tinSeller: row.tinSeller,
    tinBuyer: row.tinBuyer,
    docId: row.docId,
    mrc: row.mrc,
  };
}
