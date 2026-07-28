-- Run in SSMS on EBM_RW if your sticker uses MRC ISHSER000006 (Algorithm Inc / TIN 100000101)
USE [EBM_RW];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Seller WHERE tin = N'100000101')
BEGIN
    RAISERROR('Seller TIN 100000101 missing — run EBM_RW_create_tables.sql seed first.', 16, 1);
    RETURN;
END

IF NOT EXISTS (SELECT 1 FROM dbo.Mrc WHERE mrc = N'ISHSER000006')
BEGIN
    INSERT INTO dbo.Mrc (mrc, tin, vendorId, locationLabel, deviceType, qrVersion, issuedAt, issuedBy)
    VALUES (N'ISHSER000006', N'100000101', N'VND-ISHYIGA', N'Main counter', N'COUNTER', N'GQ3', SYSUTCDATETIME(), N'patch');
    PRINT 'Inserted MRC ISHSER000006';
END
ELSE
    PRINT 'MRC ISHSER000006 already exists';
GO
