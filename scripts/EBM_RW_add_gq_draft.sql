-- GqDraft table for ERP till draft mirror (Phase 1)
USE [EBM_RW];
GO

IF OBJECT_ID('dbo.GqDraft', 'U') IS NULL
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
  CREATE INDEX IX_GqDraft_tin ON dbo.GqDraft (tin);
  CREATE INDEX IX_GqDraft_mrc ON dbo.GqDraft (mrc);
  CREATE INDEX IX_GqDraft_status ON dbo.GqDraft (draftStatus);
END
GO

PRINT 'GqDraft table ready.';
GO
