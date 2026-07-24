-- GLOBAL_QR (ebm.rw) — SQLite schema + minimal starter rows
-- Full demo data: npm run db:reset  (runs prisma db push + seed.ts)
--
-- Usage:
--   sqlite3 prisma/dev.db < scripts/init-database.sql
--   — or —
--   npm run db:push && npm run db:seed

PRAGMA foreign_keys = ON;

-- ── Schema (matches prisma/schema.prisma) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "Seller" (
  "tin" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sector" TEXT NOT NULL,
  "contacts" TEXT,
  "vendorId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Vendor" (
  "vendorId" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "vsdcRef" TEXT,
  "webhookUrl" TEXT,
  "oauthClientId" TEXT,
  "oauthClientSecretHash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastHeartbeat" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Mrc" (
  "mrc" TEXT NOT NULL PRIMARY KEY,
  "tin" TEXT NOT NULL,
  "vendorId" TEXT,
  "locationLabel" TEXT,
  "deviceType" TEXT NOT NULL,
  "qrVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" DATETIME NOT NULL,
  "issuedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "Move" (
  "moveId" TEXT NOT NULL PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "tin" TEXT NOT NULL,
  "mrc" TEXT,
  "moveType" TEXT NOT NULL,
  "docRef" TEXT NOT NULL,
  "items" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RWF',
  "ts" DATETIME NOT NULL,
  "raw" TEXT
);
CREATE INDEX IF NOT EXISTS "Move_mrc_idx" ON "Move"("mrc");
CREATE INDEX IF NOT EXISTS "Move_docRef_idx" ON "Move"("docRef");

CREATE TABLE IF NOT EXISTS "GlobalQr" (
  "gqId" TEXT NOT NULL PRIMARY KEY,
  "tin" TEXT NOT NULL,
  "mrc" TEXT,
  "docRef" TEXT,
  "moveId" TEXT,
  "amount" REAL,
  "items" TEXT,
  "channel" TEXT NOT NULL,
  "buyerPhoneEnc" TEXT NOT NULL,
  "buyerPhoneHash" TEXT,
  "buyerEmail" TEXT,
  "geo" TEXT,
  "scanTs" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "decision" TEXT,
  "decisionBy" TEXT,
  "decisionTs" DATETIME,
  "sdcNumber" TEXT,
  "rraResponse" TEXT,
  "invoicePdfUrl" TEXT,
  "deliveredVia" TEXT,
  "deliveredTs" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GlobalQr_status_idx" ON "GlobalQr"("status");
CREATE INDEX IF NOT EXISTS "GlobalQr_tin_idx" ON "GlobalQr"("tin");
CREATE INDEX IF NOT EXISTS "GlobalQr_mrc_idx" ON "GlobalQr"("mrc");
CREATE INDEX IF NOT EXISTS "GlobalQr_buyerPhoneHash_idx" ON "GlobalQr"("buyerPhoneHash");

CREATE TABLE IF NOT EXISTS "Payment" (
  "txnId" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "payerRef" TEXT,
  "payeeTin" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "ts" DATETIME NOT NULL,
  "gqId" TEXT,
  "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED'
);
CREATE INDEX IF NOT EXISTS "Payment_gqId_idx" ON "Payment"("gqId");

CREATE TABLE IF NOT EXISTS "EvasionReport" (
  "reportId" TEXT NOT NULL PRIMARY KEY,
  "gqId" TEXT,
  "sellerTin" TEXT NOT NULL,
  "phoneEnc" TEXT NOT NULL,
  "note" TEXT,
  "evidenceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT,
  "email" TEXT,
  "passwordHash" TEXT,
  "role" TEXT NOT NULL,
  "tin" TEXT,
  "vendorId" TEXT,
  "name" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OtpSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "verified" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actor" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" TEXT,
  "after" TEXT,
  "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BatchRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL,
  "pushed" INTEGER NOT NULL,
  "refunded" INTEGER NOT NULL,
  "failed" INTEGER NOT NULL,
  "report" TEXT,
  "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Minimal rows (sticker pilot: Algorithm Inc.) ────────────────────────────
-- Password for portal roles (seller/vendor/admin): GqDemo#2026
-- Citizen OTP (when GQ_OPEN_LOGIN=1): 1234 or 123456
-- Demo phone: +250780000001

INSERT OR IGNORE INTO "Vendor" ("vendorId", "name", "vsdcRef", "status", "oauthClientId")
VALUES ('VND-ISHYIGA', 'Ishyiga', 'VSDC-ISHYIGA-LIVE', 'LIVE', 'gq_ishyiga_demo');

INSERT OR IGNORE INTO "Seller" ("tin", "name", "sector", "contacts", "vendorId", "status")
VALUES ('100000101', 'Algorithm Inc.', 'pharmacy', '+250788101000', 'VND-ISHYIGA', 'ACTIVE');

INSERT OR IGNORE INTO "Mrc" ("mrc", "tin", "vendorId", "locationLabel", "deviceType", "qrVersion", "issuedAt", "issuedBy")
VALUES ('ISHSER000006', '100000101', 'VND-ISHYIGA', 'Main counter', 'COUNTER', 'GQ3', datetime('now'), 'init-sql');

INSERT OR IGNORE INTO "User" ("id", "phone", "role", "name")
VALUES ('USR-CITIZEN', '+250788000001', 'citizen', 'Demo Citizen');

INSERT OR IGNORE INTO "User" ("id", "phone", "role", "tin", "name")
VALUES ('USR-ALGO-SELLER', '+250788101000', 'seller', '100000101', 'Algorithm Inc.');

INSERT OR IGNORE INTO "User" ("id", "phone", "email", "role", "name")
VALUES ('USR-ADMIN', '+250788000040', 'admin@gq.example', 'admin', 'GQ Admin');

INSERT OR IGNORE INTO "AuditLog" ("id", "actor", "role", "action", "entity", "entityId", "after")
VALUES ('AUD-INIT', 'init-sql', 'system', 'INIT_DATABASE', 'Database', 'dev', '{"note":"minimal starter rows"}');
