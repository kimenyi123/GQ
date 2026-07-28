-- EBM_RW - minimal tables only (no FK, no seed)
-- Use if the full script fails. Run on EBM_RW, Ctrl+A, F5.

USE [EBM_RW];
GO

IF OBJECT_ID(N'dbo.Vendor', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Vendor (
        vendorId   NVARCHAR(40) NOT NULL PRIMARY KEY,
        vendorName NVARCHAR(200) NOT NULL,
        vsdcRef    NVARCHAR(120) NULL,
        vendorStatus NVARCHAR(20) NOT NULL DEFAULT N'LIVE'
    );
    PRINT 'Created Vendor';
END
ELSE PRINT 'Vendor already exists';
GO

IF OBJECT_ID(N'dbo.Seller', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Seller (
        tin        NVARCHAR(20) NOT NULL PRIMARY KEY,
        sellerName NVARCHAR(200) NOT NULL,
        sector     NVARCHAR(80) NOT NULL,
        vendorId   NVARCHAR(40) NULL
    );
    PRINT 'Created Seller';
END
ELSE PRINT 'Seller already exists';
GO

IF OBJECT_ID(N'dbo.Mrc', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Mrc (
        mrc        NVARCHAR(40) NOT NULL PRIMARY KEY,
        tin        NVARCHAR(20) NOT NULL,
        vendorId   NVARCHAR(40) NULL,
        deviceType NVARCHAR(40) NOT NULL,
        qrVersion  NVARCHAR(10) NOT NULL,
        issuedAt   DATETIME2 NOT NULL
    );
    PRINT 'Created Mrc';
END
ELSE PRINT 'Mrc already exists';
GO

IF OBJECT_ID(N'dbo.GlobalQr', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GlobalQr (
        gqId          NVARCHAR(20) NOT NULL PRIMARY KEY,
        tin           NVARCHAR(20) NOT NULL,
        mrc           NVARCHAR(40) NULL,
        channel       NVARCHAR(20) NOT NULL,
        buyerPhoneEnc NVARCHAR(500) NOT NULL,
        gqStatus      NVARCHAR(20) NOT NULL,
        scanTs        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        createdAt     DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created GlobalQr';
END
ELSE PRINT 'GlobalQr already exists';
GO

IF OBJECT_ID(N'dbo.GqUser', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GqUser (
        userId      NVARCHAR(40) NOT NULL PRIMARY KEY,
        phone       NVARCHAR(20) NULL,
        userRole    NVARCHAR(20) NOT NULL,
        displayName NVARCHAR(200) NULL
    );
    PRINT 'Created GqUser';
END
ELSE PRINT 'GqUser already exists';
GO

IF OBJECT_ID(N'dbo.Payment', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Payment (
        txnId     NVARCHAR(80) NOT NULL PRIMARY KEY,
        provider  NVARCHAR(40) NOT NULL,
        payeeTin  NVARCHAR(20) NOT NULL,
        amount    DECIMAL(18,2) NOT NULL,
        paymentTs DATETIME2 NOT NULL
    );
    PRINT 'Created Payment';
END
ELSE PRINT 'Payment already exists';
GO

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLog (
        auditId NVARCHAR(40) NOT NULL PRIMARY KEY,
        actor   NVARCHAR(80) NOT NULL,
        action  NVARCHAR(80) NOT NULL,
        auditTs DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created AuditLog';
END
ELSE PRINT 'AuditLog already exists';
GO

-- Seed (only if empty)
IF NOT EXISTS (SELECT 1 FROM dbo.Vendor)
    INSERT INTO dbo.Vendor (vendorId, vendorName, vsdcRef, vendorStatus)
    VALUES (N'VND-ISHYIGA', N'Ishyiga', N'ISHYIGA_API_VSDC', N'LIVE');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Seller)
    INSERT INTO dbo.Seller (tin, sellerName, sector, vendorId)
    VALUES
        (N'100000101', N'Serena', N'hotel', N'VND-ISHYIGA'),
        (N'100000102', N'Burrows', N'restaurant', N'VND-ISHYIGA'),
        (N'100000103', N'Cheaz Lando', N'hospitality', N'VND-ISHYIGA'),
        (N'100000104', N'Butique', N'retail', N'VND-ISHYIGA'),
        (N'100000105', N'IMPACT PHARMA LTD', N'pharmacy', N'VND-ISHYIGA');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Mrc)
    INSERT INTO dbo.Mrc (mrc, tin, vendorId, deviceType, qrVersion, issuedAt)
    VALUES (N'ISHSER000001', N'100000101', N'VND-ISHYIGA', N'COUNTER', N'GQ3', GETUTCDATE());
GO

PRINT 'MINIMAL SETUP DONE';
GO

SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' ORDER BY 1;
GO
