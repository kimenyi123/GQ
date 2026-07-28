-- Add GQ request + VSDC signature columns to GlobalQr
USE [EBM_RW];
GO

IF COL_LENGTH('dbo.GlobalQr', 'gqPayload') IS NULL
  ALTER TABLE dbo.GlobalQr ADD gqPayload NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.GlobalQr', 'gqRequestSignature') IS NULL
  ALTER TABLE dbo.GlobalQr ADD gqRequestSignature NVARCHAR(128) NULL;
GO

IF COL_LENGTH('dbo.GlobalQr', 'vsdcSignature') IS NULL
  ALTER TABLE dbo.GlobalQr ADD vsdcSignature NVARCHAR(32) NULL;
GO

IF COL_LENGTH('dbo.GlobalQr', 'vsdcInternalData') IS NULL
  ALTER TABLE dbo.GlobalQr ADD vsdcInternalData NVARCHAR(64) NULL;
GO

PRINT 'GlobalQr signature columns ready.';
GO
