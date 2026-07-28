import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const statements = [
  `IF OBJECT_ID(N'dbo.GqUser', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.GqUser (
    userId       NVARCHAR(40)  NOT NULL PRIMARY KEY,
    phone        NVARCHAR(20)  NULL,
    email        NVARCHAR(200) NULL,
    passwordHash NVARCHAR(200) NULL,
    userRole     NVARCHAR(20)  NOT NULL,
    tin          NVARCHAR(20)  NULL,
    vendorId     NVARCHAR(40)  NULL,
    displayName  NVARCHAR(200) NULL,
    createdAt    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
  );
END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_GqUser_phone' AND object_id = OBJECT_ID(N'dbo.GqUser'))
  CREATE UNIQUE INDEX UX_GqUser_phone ON dbo.GqUser (phone) WHERE phone IS NOT NULL`,
  `IF OBJECT_ID(N'dbo.OtpSession', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OtpSession (
    otpId     NVARCHAR(40)  NOT NULL PRIMARY KEY,
    phone     NVARCHAR(20)  NOT NULL,
    codeHash  NVARCHAR(200) NOT NULL,
    expiresAt DATETIME2(3)  NOT NULL,
    verified  BIT           NOT NULL DEFAULT 0,
    createdAt DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
  );
END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OtpSession_phone' AND object_id = OBJECT_ID(N'dbo.OtpSession'))
  CREATE INDEX IX_OtpSession_phone ON dbo.OtpSession (phone)`,
  `IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLog (
    auditId    NVARCHAR(40)  NOT NULL PRIMARY KEY,
    actor      NVARCHAR(80)  NOT NULL,
    userRole   NVARCHAR(20)  NOT NULL,
    action     NVARCHAR(80)  NOT NULL,
    entity     NVARCHAR(40)  NOT NULL,
    entityId   NVARCHAR(40)  NOT NULL,
    beforeJson NVARCHAR(MAX) NULL,
    afterJson  NVARCHAR(MAX) NULL,
    auditTs    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
  );
END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLog_entity' AND object_id = OBJECT_ID(N'dbo.AuditLog'))
  CREATE INDEX IX_AuditLog_entity ON dbo.AuditLog (entity, entityId)`,
];

for (const sql of statements) {
  await p.$executeRawUnsafe(sql);
}

const tables = await p.$queryRawUnsafe(`
  SELECT name FROM sys.tables
  WHERE name IN (N'AuditLog', N'OtpSession', N'GqUser')
  ORDER BY name
`);

console.log(JSON.stringify({ ok: true, tables }));
await p.$disconnect();
