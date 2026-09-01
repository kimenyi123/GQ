import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const statements = [
  `IF OBJECT_ID(N'dbo.GqDraft', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.GqDraft (
    docRef NVARCHAR(64) NOT NULL PRIMARY KEY,
    draftStatus NVARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    tin NVARCHAR(20) NOT NULL,
    mrc NVARCHAR(20) NOT NULL,
    ijisho NVARCHAR(40) NULL,
    buyerTin NVARCHAR(20) NULL,
    buyerName NVARCHAR(200) NULL,
    amount DECIMAL(18, 2) NULL,
    tva DECIMAL(18, 2) NULL,
    items NVARCHAR(MAX) NULL,
    gqPayload NVARCHAR(500) NULL,
    gqUrl NVARCHAR(500) NULL,
    gqId NVARCHAR(20) NULL,
    railCode NVARCHAR(40) NULL,
    railTxnId NVARCHAR(100) NULL,
    railAmount DECIMAL(18, 2) NULL,
    railSource NVARCHAR(20) NULL,
    railConfirmedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GqDraft_tin' AND object_id = OBJECT_ID(N'dbo.GqDraft'))
  CREATE INDEX IX_GqDraft_tin ON dbo.GqDraft (tin)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GqDraft_mrc' AND object_id = OBJECT_ID(N'dbo.GqDraft'))
  CREATE INDEX IX_GqDraft_mrc ON dbo.GqDraft (mrc)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GqDraft_status' AND object_id = OBJECT_ID(N'dbo.GqDraft'))
  CREATE INDEX IX_GqDraft_status ON dbo.GqDraft (draftStatus)`,
];

for (const sql of statements) {
  await p.$executeRawUnsafe(sql);
}

const tables = await p.$queryRawUnsafe(`
  SELECT name FROM sys.tables WHERE name = N'GqDraft'
`);

console.log("GqDraft ready:", tables);
await p.$disconnect();
