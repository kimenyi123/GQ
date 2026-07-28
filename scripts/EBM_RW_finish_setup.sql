-- Run AFTER EBM_RW_create_tables.sql if GqUser / OtpSession / AuditLog / BatchRun are missing
-- Also adds demo password hashes for seller portal login (GqDemo#2026)

USE [EBM_RW];
GO

IF OBJECT_ID(N'dbo.GqUser', N'U') IS NULL
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
    PRINT 'Created GqUser';
END
GO

IF OBJECT_ID(N'dbo.OtpSession', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OtpSession (
        otpId     NVARCHAR(40)  NOT NULL PRIMARY KEY,
        phone     NVARCHAR(20)  NOT NULL,
        codeHash  NVARCHAR(200) NOT NULL,
        expiresAt DATETIME2(3)  NOT NULL,
        verified  BIT           NOT NULL DEFAULT 0,
        createdAt DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    PRINT 'Created OtpSession';
END
GO

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
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
    PRINT 'Created AuditLog';
END
GO

IF OBJECT_ID(N'dbo.BatchRun', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BatchRun (
        batchId  NVARCHAR(40) NOT NULL PRIMARY KEY,
        runDate  DATE         NOT NULL,
        pushed   INT          NOT NULL,
        refunded INT          NOT NULL,
        failed   INT          NOT NULL,
        report   NVARCHAR(MAX) NULL,
        batchTs  DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
    PRINT 'Created BatchRun';
END
GO

-- Demo password: GqDemo#2026
DECLARE @hash NVARCHAR(200) = N'$2a$10$Eq7aZYua6FlNSCX/MdJo1.0sb2bfYeB6iA4c.FmM85qtdfsUK0NEW';

MERGE dbo.GqUser AS t
USING (VALUES
    (N'USR-CITIZEN',        N'+250788000001', NULL,                  N'citizen', NULL,         NULL,           N'Demo Citizen'),
    (N'USR-SELLER-SERENA',  N'+250788000101', N'seller@serena.demo', N'seller',  N'100000101', NULL,           N'Serena Seller'),
    (N'USR-SELLER-BURROWS', N'+250788000102', N'seller@burrows.demo',N'seller',  N'100000102', NULL,           N'Burrows Seller'),
    (N'USR-VENDOR-ISH',     N'+250788000020', NULL,                  N'vendor',  NULL,         N'VND-ISHYIGA', N'Ishyiga Ops'),
    (N'USR-ADMIN',          N'+250788000040', N'admin@gq.example',   N'admin',   NULL,         NULL,           N'GQ Admin')
) AS s(userId, phone, email, userRole, tin, vendorId, displayName)
ON t.userId = s.userId
WHEN NOT MATCHED THEN
    INSERT (userId, phone, email, passwordHash, userRole, tin, vendorId, displayName)
    VALUES (s.userId, s.phone, s.email, @hash, s.userRole, s.tin, s.vendorId, s.displayName);
GO

UPDATE dbo.GqUser SET passwordHash = N'$2a$10$Eq7aZYua6FlNSCX/MdJo1.0sb2bfYeB6iA4c.FmM85qtdfsUK0NEW'
WHERE userRole IN (N'seller', N'admin', N'vendor') AND passwordHash IS NULL;
GO

PRINT 'Finish setup complete.';
GO
