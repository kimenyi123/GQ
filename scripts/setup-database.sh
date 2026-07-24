#!/usr/bin/env bash
# Bootstrap GLOBAL_QR database for ebm.rw (pilot / testing)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Prisma schema push"
npm run db:push

echo "==> Full demo seed (vendors, sellers, MRCs, 120 GQ requests, users)"
npm run db:seed

echo ""
echo "Done. Open login (testing):"
echo "  GQ_OPEN_LOGIN=1"
echo "  Citizen phone: +250780000001  OTP: 1234"
echo "  Portal password (seed users): GqDemo#2026"
echo ""
echo "Production URL in QRs:"
echo "  NEXT_PUBLIC_APP_URL=https://ebm.rw"
