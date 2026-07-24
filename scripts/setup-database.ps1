# Run from GLOBAL_QR root (PowerShell)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Prisma schema push"
npm run db:push

Write-Host "==> Full demo seed"
npm run db:seed

Write-Host ""
Write-Host "Done. Testing login:"
Write-Host "  GQ_OPEN_LOGIN=1"
Write-Host "  Citizen: +250780000001  OTP: 1234"
Write-Host "  Portal password: GqDemo#2026"
Write-Host ""
Write-Host "Production QRs:"
Write-Host "  NEXT_PUBLIC_APP_URL=https://ebm.rw"
