/*******************************************************************************
  EBM_RW - Global QR (ebm.rw) database setup
  Server : 161.35.136.204
  Database: EBM_RW
  User   : ebm_rw

  HOW TO RUN (SSMS):
    1. Connect to 161.35.136.204
    2. File -> Open -> this file
    3. Check database dropdown = EBM_RW
    4. Ctrl+A, then F5

  Safe to re-run: drops tables first, then recreates + seed.
*******************************************************************************/

USE [EBM_RW];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT 'Dropping existing tables...';
GO

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NOT NULL DROP TABLE dbo.AuditLog;
IF OBJECT_ID(N'dbo.BatchRun', N'U') IS NOT NULL DROP TABLE dbo.BatchRun;
IF OBJECT_ID(N'dbo.OtpSession', N'U') IS NOT NULL DROP TABLE dbo.OtpSession;
IF OBJECT_ID(N'dbo.[User]', N'U') IS NOT NULL DROP TABLE dbo.[User];
IF OBJECT_ID(N'dbo.EvasionReport', N'U') IS NOT NULL DROP TABLE dbo.EvasionReport;
IF OBJECT_ID(N'dbo.Payment', N'U') IS NOT NULL DROP TABLE dbo.Payment;
IF OBJECT_ID(N'dbo.GlobalQr', N'U') IS NOT NULL DROP TABLE dbo.GlobalQr;
IF OBJECT_ID(N'dbo.Move', N'U') IS NOT NULL DROP TABLE dbo.Move;
IF OBJECT_ID(N'dbo.Mrc', N'U') IS NOT NULL DROP TABLE dbo.Mrc;
IF OBJECT_ID(N'dbo.Vendor', N'U') IS NOT NULL DROP TABLE dbo.Vendor;
IF OBJECT_ID(N'dbo.Seller', N'U') IS NOT NULL DROP TABLE dbo.Seller;
GO

PRINT 'Creating tables...';
GO

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.Vendor (
    vendorId              NVARCHAR(40)  NOT NULL,
    vendorName            NVARCHAR(200) NOT NULL,
    vsdcRef               NVARCHAR(120) NULL,
    webhookUrl            NVARCHAR(500) NULL,
    oauthClientId         NVARCHAR(80)  NULL,
    oauthClientSecretHash NVARCHAR(200) NULL,
    vendorStatus          NVARCHAR(20)  NOT NULL DEFAULT N'PENDING',
    lastHeartbeat         DATETIME2(3)  NULL,
    createdAt             DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Vendor PRIMARY KEY CLUSTERED (vendorId)
);
GO

-- ---------------------------------------------------------------------------
-- Seller
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.Seller (
    tin          NVARCHAR(20)  NOT NULL,
    sellerName   NVARCHAR(200) NOT NULL,
    sector       NVARCHAR(80)  NOT NULL,
    contacts     NVARCHAR(500) NULL,
    vendorId     NVARCHAR(40)  NULL,
    sellerStatus NVARCHAR(20)  NOT NULL DEFAULT N'ACTIVE',
    createdAt    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Seller PRIMARY KEY CLUSTERED (tin)
);
GO

-- ---------------------------------------------------------------------------
-- MRC (device / counter)
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.Mrc (
    mrc           NVARCHAR(40)  NOT NULL,
    tin           NVARCHAR(20)  NOT NULL,
    vendorId      NVARCHAR(40)  NULL,
    locationLabel NVARCHAR(200) NULL,
    deviceType    NVARCHAR(40)  NOT NULL,
    qrVersion     NVARCHAR(10)  NOT NULL,
    mrcStatus     NVARCHAR(20)  NOT NULL DEFAULT N'ACTIVE',
    issuedAt      DATETIME2(3)  NOT NULL,
    issuedBy      NVARCHAR(80)  NULL,
    CONSTRAINT PK_Mrc PRIMARY KEY CLUSTERED (mrc)
);
GO

CREATE INDEX IX_Mrc_tin ON dbo.Mrc (tin);
CREATE INDEX IX_Mrc_vendorId ON dbo.Mrc (vendorId);
GO

-- ---------------------------------------------------------------------------
-- Move (POS feed)
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.Move (
    moveId   NVARCHAR(40)   NOT NULL,
    vendorId NVARCHAR(40)   NOT NULL,
    tin      NVARCHAR(20)   NOT NULL,
    mrc      NVARCHAR(40)   NULL,
    moveType NVARCHAR(40)   NOT NULL,
    docRef   NVARCHAR(80)   NOT NULL,
    items    NVARCHAR(MAX)  NOT NULL,
    amount   DECIMAL(18, 2) NOT NULL,
    currency NVARCHAR(3)    NOT NULL DEFAULT N'RWF',
    moveTs   DATETIME2(3)   NOT NULL,
    rawJson  NVARCHAR(MAX)  NULL,
    CONSTRAINT PK_Move PRIMARY KEY CLUSTERED (moveId)
);
GO

CREATE INDEX IX_Move_mrc ON dbo.Move (mrc);
CREATE INDEX IX_Move_docRef ON dbo.Move (docRef);
GO

-- ---------------------------------------------------------------------------
-- GlobalQr (master citizen request)
-- Status: QUEUEING, GENERATING, STANDBY, ADJUST, DONE, REFUNDED, FAILED
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.GlobalQr (
    gqId            NVARCHAR(20)   NOT NULL,
    payloadId       NVARCHAR(20)   NULL,
    requestType     NVARCHAR(20)   NOT NULL DEFAULT N'ORDER',
    tin             NVARCHAR(20)   NOT NULL,
    tinSeller       NVARCHAR(20)   NULL,
    tinBuyer        NVARCHAR(20)   NULL,
    mrc             NVARCHAR(40)   NULL,
    docRef          NVARCHAR(80)   NULL,
    docId           NVARCHAR(80)   NULL,
    moveId          NVARCHAR(40)   NULL,
    vendorId        NVARCHAR(40)   NULL,
    amount          DECIMAL(18, 2) NULL,
    declaredAmount  DECIMAL(18, 2) NULL,
    items           NVARCHAR(MAX)  NULL,
    channel         NVARCHAR(20)   NOT NULL,
    buyerPhoneEnc   NVARCHAR(500)  NOT NULL,
    buyerPhoneHash  NVARCHAR(64)   NULL,
    buyerEmail      NVARCHAR(200)  NULL,
    geo             NVARCHAR(120)  NULL,
    timezone        NVARCHAR(60)   NULL DEFAULT N'Africa/Kigali',
    bank            NVARCHAR(40)   NULL,
    bankTxnId       NVARCHAR(80)   NULL,
    bankAmount      DECIMAL(18, 2) NULL,
    paymentSms      NVARCHAR(MAX)  NULL,
    scanTs          DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    gqPayload       NVARCHAR(500)  NULL,
    gqRequestSignature NVARCHAR(128) NULL,
    vsdcSignature   NVARCHAR(32)   NULL,
    vsdcInternalData NVARCHAR(64)  NULL,
    gqStatus        NVARCHAR(20)   NOT NULL,
    decision        NVARCHAR(40)   NULL,
    decisionBy      NVARCHAR(80)   NULL,
    decisionTs      DATETIME2(3)   NULL,
    processingNote  NVARCHAR(500)  NULL,
    sdcNumber       NVARCHAR(80)   NULL,
    rraResponse     NVARCHAR(MAX)  NULL,
    invoiceOriginal NVARCHAR(MAX)  NULL,
    invoicePdfUrl   NVARCHAR(500)  NULL,
    regenerate      NVARCHAR(MAX)  NULL,
    deliveredVia    NVARCHAR(20)   NULL,
    deliveredTs     DATETIME2(3)   NULL,
    createdAt       DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt       DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_GlobalQr PRIMARY KEY CLUSTERED (gqId)
);
GO

CREATE INDEX IX_GlobalQr_gqStatus ON dbo.GlobalQr (gqStatus);
CREATE INDEX IX_GlobalQr_tin ON dbo.GlobalQr (tin);
CREATE INDEX IX_GlobalQr_mrc ON dbo.GlobalQr (mrc);
CREATE INDEX IX_GlobalQr_buyerPhoneHash ON dbo.GlobalQr (buyerPhoneHash);
GO

-- ---------------------------------------------------------------------------
-- Payment
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.Payment (
    txnId       NVARCHAR(80)   NOT NULL,
    provider    NVARCHAR(40)   NOT NULL,
    payerRef    NVARCHAR(80)   NULL,
    payeeTin    NVARCHAR(20)   NOT NULL,
    amount      DECIMAL(18, 2) NOT NULL,
    paymentTs   DATETIME2(3)   NOT NULL,
    gqId        NVARCHAR(20)   NULL,
    matchStatus NVARCHAR(20)   NOT NULL DEFAULT N'UNMATCHED',
    CONSTRAINT PK_Payment PRIMARY KEY CLUSTERED (txnId)
);
GO

CREATE INDEX IX_Payment_gqId ON dbo.Payment (gqId);
GO

-- ---------------------------------------------------------------------------
-- EvasionReport
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.EvasionReport (
    reportId    NVARCHAR(40)  NOT NULL,
    gqId        NVARCHAR(20)  NULL,
    sellerTin   NVARCHAR(20)  NOT NULL,
    phoneEnc    NVARCHAR(500) NOT NULL,
    note        NVARCHAR(MAX) NULL,
    evidenceUrl NVARCHAR(500) NULL,
    reportStatus NVARCHAR(20) NOT NULL DEFAULT N'NEW',
    createdAt   DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_EvasionReport PRIMARY KEY CLUSTERED (reportId)
);
GO

-- ---------------------------------------------------------------------------
-- User
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.GqUser (
    userId       NVARCHAR(40)  NOT NULL,
    phone        NVARCHAR(20)  NULL,
    email        NVARCHAR(200) NULL,
    passwordHash NVARCHAR(200) NULL,
    userRole     NVARCHAR(20)  NOT NULL,
    tin          NVARCHAR(20)  NULL,
    vendorId     NVARCHAR(40)  NULL,
    displayName  NVARCHAR(200) NULL,
    createdAt    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_GqUser PRIMARY KEY CLUSTERED (userId)
);
GO

CREATE UNIQUE INDEX UX_GqUser_phone ON dbo.GqUser (phone) WHERE phone IS NOT NULL;
GO

-- ---------------------------------------------------------------------------
-- OtpSession
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.OtpSession (
    otpId     NVARCHAR(40)  NOT NULL,
    phone     NVARCHAR(20)  NOT NULL,
    codeHash  NVARCHAR(200) NOT NULL,
    expiresAt DATETIME2(3)  NOT NULL,
    verified  BIT           NOT NULL DEFAULT 0,
    createdAt DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_OtpSession PRIMARY KEY CLUSTERED (otpId)
);
GO

CREATE INDEX IX_OtpSession_phone ON dbo.OtpSession (phone);
GO

-- ---------------------------------------------------------------------------
-- AuditLog
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.AuditLog (
    auditId  NVARCHAR(40)  NOT NULL,
    actor    NVARCHAR(80)  NOT NULL,
    userRole NVARCHAR(20)  NOT NULL,
    action   NVARCHAR(80)  NOT NULL,
    entity   NVARCHAR(40)  NOT NULL,
    entityId NVARCHAR(40)  NOT NULL,
    beforeJson NVARCHAR(MAX) NULL,
    afterJson  NVARCHAR(MAX) NULL,
    auditTs  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AuditLog PRIMARY KEY CLUSTERED (auditId)
);
GO

CREATE INDEX IX_AuditLog_entity ON dbo.AuditLog (entity, entityId);
GO

-- ---------------------------------------------------------------------------
-- BatchRun
-- ---------------------------------------------------------------------------
CREATE TABLE dbo.BatchRun (
    batchId  NVARCHAR(40) NOT NULL,
    runDate  DATE         NOT NULL,
    pushed   INT          NOT NULL,
    refunded INT          NOT NULL,
    failed   INT          NOT NULL,
    report   NVARCHAR(MAX) NULL,
    batchTs  DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_BatchRun PRIMARY KEY CLUSTERED (batchId)
);
GO

PRINT 'Adding foreign keys...';
GO

ALTER TABLE dbo.Mrc
    ADD CONSTRAINT FK_Mrc_Seller FOREIGN KEY (tin) REFERENCES dbo.Seller (tin);
GO

ALTER TABLE dbo.Mrc
    ADD CONSTRAINT FK_Mrc_Vendor FOREIGN KEY (vendorId) REFERENCES dbo.Vendor (vendorId);
GO

ALTER TABLE dbo.Move
    ADD CONSTRAINT FK_Move_Vendor FOREIGN KEY (vendorId) REFERENCES dbo.Vendor (vendorId);
GO

ALTER TABLE dbo.Move
    ADD CONSTRAINT FK_Move_Seller FOREIGN KEY (tin) REFERENCES dbo.Seller (tin);
GO

ALTER TABLE dbo.GlobalQr
    ADD CONSTRAINT FK_GlobalQr_Seller FOREIGN KEY (tin) REFERENCES dbo.Seller (tin);
GO

ALTER TABLE dbo.GlobalQr
    ADD CONSTRAINT FK_GlobalQr_Mrc FOREIGN KEY (mrc) REFERENCES dbo.Mrc (mrc);
GO

ALTER TABLE dbo.GlobalQr
    ADD CONSTRAINT FK_GlobalQr_Vendor FOREIGN KEY (vendorId) REFERENCES dbo.Vendor (vendorId);
GO

ALTER TABLE dbo.GlobalQr
    ADD CONSTRAINT FK_GlobalQr_Move FOREIGN KEY (moveId) REFERENCES dbo.Move (moveId);
GO

ALTER TABLE dbo.Payment
    ADD CONSTRAINT FK_Payment_GlobalQr FOREIGN KEY (gqId) REFERENCES dbo.GlobalQr (gqId);
GO

ALTER TABLE dbo.EvasionReport
    ADD CONSTRAINT FK_EvasionReport_GlobalQr FOREIGN KEY (gqId) REFERENCES dbo.GlobalQr (gqId);
GO

ALTER TABLE dbo.EvasionReport
    ADD CONSTRAINT FK_EvasionReport_Seller FOREIGN KEY (sellerTin) REFERENCES dbo.Seller (tin);
GO

ALTER TABLE dbo.GqUser
    ADD CONSTRAINT FK_GqUser_Seller FOREIGN KEY (tin) REFERENCES dbo.Seller (tin);
GO

ALTER TABLE dbo.GqUser
    ADD CONSTRAINT FK_GqUser_Vendor FOREIGN KEY (vendorId) REFERENCES dbo.Vendor (vendorId);
GO

PRINT 'Inserting seed data...';
GO

INSERT INTO dbo.Vendor (vendorId, vendorName, vsdcRef, webhookUrl, oauthClientId, vendorStatus, lastHeartbeat)
VALUES
    (N'VND-ISHYIGA',     N'Ishyiga',     N'ISHYIGA_API_VSDC', N'mock://ishyiga',     N'gq_ishyiga_demo',     N'LIVE',    SYSUTCDATETIME()),
    (N'VND-MICROINVEST', N'Microinvest', N'RRA_API_VSDC',     N'mock://microinvest', N'gq_microinvest_demo', N'PENDING', DATEADD(HOUR, -2, SYSUTCDATETIME())),
    (N'VND-NOSOFTWARE',  N'NoSoftware',  N'NONE',             NULL,                  N'gq_nosoftware_demo',  N'PENDING', NULL);
GO

INSERT INTO dbo.Seller (tin, sellerName, sector, contacts, vendorId, sellerStatus)
VALUES
    (N'100000101', N'Serena',            N'hotel',       N'+250788000101', N'VND-ISHYIGA',     N'ACTIVE'),
    (N'100000102', N'Burrows',           N'restaurant',  N'+250788000102', N'VND-MICROINVEST', N'ACTIVE'),
    (N'100000103', N'Cheaz Lando',       N'hospitality', N'+250788000103', N'VND-ISHYIGA',     N'ACTIVE'),
    (N'100000104', N'Butique',           N'retail',      N'+250788000104', N'VND-NOSOFTWARE',  N'ACTIVE'),
    (N'100000105', N'IMPACT PHARMA LTD', N'pharmacy',    N'+250788000105', N'VND-ISHYIGA',     N'ACTIVE');
GO

INSERT INTO dbo.Mrc (mrc, tin, vendorId, locationLabel, deviceType, qrVersion, issuedAt, issuedBy)
VALUES
    (N'ISHSER000001', N'100000101', N'VND-ISHYIGA',     N'TABLE 1',   N'TABLE',   N'GQ1', SYSUTCDATETIME(), N'seed'),
    (N'ISHSER000002', N'100000101', N'VND-ISHYIGA',     N'COUNTER 1', N'COUNTER', N'GQ2', SYSUTCDATETIME(), N'seed'),
    (N'ISHSER000006', N'100000101', N'VND-ISHYIGA',     N'Main counter', N'COUNTER', N'GQ3', SYSUTCDATETIME(), N'seed'),
    (N'MICBUR000001', N'100000102', N'VND-MICROINVEST', N'COUNTER 1', N'COUNTER', N'GQ2', SYSUTCDATETIME(), N'seed'),
    (N'ISHCHE000001', N'100000103', N'VND-ISHYIGA',     N'WINDOWS 1', N'WINDOWS', N'GQ2', SYSUTCDATETIME(), N'seed'),
    (N'NONBUT000001', N'100000104', N'VND-NOSOFTWARE',  N'DESKTOP 1', N'DESKTOP', N'GQ2', SYSUTCDATETIME(), N'seed'),
    (N'ISHIMP000001', N'100000105', N'VND-ISHYIGA',     N'COUNTER 1', N'COUNTER', N'GQ3', SYSUTCDATETIME(), N'seed');
GO

INSERT INTO dbo.GqUser (userId, phone, email, userRole, tin, vendorId, displayName)
VALUES
    (N'USR-CITIZEN',        N'+250788000001', NULL,                  N'citizen', NULL,         NULL,           N'Demo Citizen'),
    (N'USR-SELLER-SERENA',  N'+250788000101', N'seller@serena.demo', N'seller',  N'100000101', NULL,           N'Serena Seller'),
    (N'USR-SELLER-BURROWS', N'+250788000102', N'seller@burrows.demo',N'seller',  N'100000102', NULL,           N'Burrows Seller'),
    (N'USR-VENDOR-ISH',     N'+250788000020', NULL,                  N'vendor',  NULL,         N'VND-ISHYIGA', N'Ishyiga Ops'),
    (N'USR-ADMIN',          N'+250788000040', N'admin@gq.example',   N'admin',   NULL,         NULL,           N'GQ Admin'),
    (N'USR-RRA',            N'+250788000050', NULL,                  N'rra',     NULL,         NULL,           N'RRA Inspector');
GO

INSERT INTO dbo.AuditLog (auditId, actor, userRole, action, entity, entityId, afterJson)
VALUES (N'AUD-INIT', N'seed', N'system', N'INIT_DATABASE', N'Database', N'EBM_RW', N'{"ok":true}');
GO

PRINT 'DONE - EBM_RW tables created.';
GO

SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME;
GO
