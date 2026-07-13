# ebm.rw — Global QR (GQ)

Neutral national rail for self-service EBM invoicing in Rwanda (**Saba EBM yawe**).

A citizen scans one QR (table, counter, receipt, or online order), asks for their EBM invoice, and this platform routes the request to whichever certified invoicing system (VCIS) the business uses, obtains the signed invoice, links it to the payment, and reports outcomes to RRA.

This Next.js implementation is the **pilot/demo**. The `/api/v1` contract is clean REST/JSON so production can move to the Java/Tomcat stack without changing clients.

Architecture overview: [`public/docs/Global_QR_Architecture_v3.svg`](public/docs/Global_QR_Architecture_v3.svg)

Remote: [https://github.com/kimenyi123/GQ.git](https://github.com/kimenyi123/GQ.git)

## Stack

- Next.js 14 (App Router) + TypeScript
- SQLite via Prisma for local pilot (`file:./dev.db`) — swap `provider` to PostgreSQL for production
- Tailwind CSS with ebm.rw design tokens
- Auth: phone OTP (mock SMS), JWT roles, OAuth2 client-credentials for vendors
- Worker (`pnpm worker`): STANDBY/GENERATING timeouts + nightly ADJUST batch (02:00 Africa/Kigali)

## Quick start

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional background worker:

```bash
pnpm worker
```

## Demo walkthrough (citizen → invoice → RRA)

1. Open `/` — default language is **Kinyarwanda**. Switch RW / EN / FR / SW anytime.
2. Click **Skana QR**, keep the prefilled `GQ2|…` payload (Chez Kivu), click **Soma QR**.
3. **Ohereza kode** → use the demo OTP printed on screen (or `123456`) → **Emeza** → **Saba**.
4. You get a confirmation card with a `GQ-######` reference and status **Gutegereza**.
5. Open **Reba uko bihagaze** (`/r/{gqId}`). Ishyiga mock auto-completes many GENERATING jobs; or call:
   ```bash
   curl -X POST http://localhost:3000/api/v1/dev/simulate-scan
   ```
6. Open `/rra` → demo login → **Conversion** view (heat table includes Chez Kivu table 1 vs table 4 narrative).
7. Open `/status` (no auth) for live queue depths.

### Demo credentials (from seed)

| Role   | Phone          | Password    |
|--------|----------------|-------------|
| Citizen| +250788000001  | GqDemo#2026 |
| Seller | +250788000010  | GqDemo#2026 |
| Vendor | +250788000020  | GqDemo#2026 |
| Agent  | +250788000030  | GqDemo#2026 |
| Admin  | +250788000040  | GqDemo#2026 |
| RRA    | +250788000050  | GqDemo#2026 |

- Demo OTP: `123456` (also returned as `debugCode` from `/api/v1/otp/issue`)
- Chez Kivu TIN: `100000001` · Table 1 MRC: `MRC-CKT001`
- OAuth clients: `gq_ishyiga_demo`, `gq_odoo_demo`, `gq_sage_demo` · secret: `demo-oauth-secret`

## UIs

| Path       | Audience |
|------------|----------|
| `/`        | Citizen — Saba EBM yawe |
| `/r/[gqId]`| Status tracker |
| `/i/[gqId]`| Invoice view |
| `/report`  | Evasion report |
| `/seller`  | Seller portal |
| `/vendor`  | Vendor console + sandbox |
| `/rra`     | RRA conversion & inspector |
| `/admin`   | MRC registry, adjust desk, ops |
| `/status`  | Public queue depths |

## State machine

```
QUEUEING → GENERATING → DONE
    │           │
    │           └→ STANDBY (24h SLA)
    └→ STANDBY → REFUNDED (seller self-issue)
              └→ ADJUST → DONE | REFUNDED | FAILED (nightly batch)
```

Every transition is audited. Buyer phones are AES-256-GCM encrypted at rest and never appear in QR payloads, seller UIs, or vendor webhooks.

## QR payloads

```
Static:  GQ1|<TIN>|<MRC>|<issuedTs>
Dynamic: GQ2|<TIN>|<MRC>|<txTs>|<docRef>
```

## Core API (all under `/api/v1`)

Citizen: `otp/*`, `requests`, `resolve/{code}`, `invoices/{gqId}`, `reports/evasion`  
Seller: `sellers`, `sellers/{tin}/requests`, `requests/{gqId}/self-issue`, `qr`  
MRC: `mrc`, `vendors/{id}/mrc/claim`  
Vendor: `vendors`, `moves`, `invoices/callback`  
Payments: `payments/notify`  
RRA: `rra/conversion`, `rra/records/{gqId}`, `rra/batch`, `rra/reports/evasion`  
Platform: `auth/token`, `health`, `status`, `dev/simulate-scan`

## Env

Copy `.env.example` → `.env` (already present for local). Required keys: `DATABASE_URL`, `GQ_JWT_SECRET`, `GQ_PHONE_KEY` (64 hex chars), `GQ_HMAC_SECRET`, `GQ_OTP_PEPPER`.

## Scripts

| Script        | Purpose |
|---------------|---------|
| `pnpm dev`    | Next.js app |
| `pnpm db:push`| Sync schema |
| `pnpm db:seed`| Demo dataset |
| `pnpm db:reset`| Wipe + reseed |
| `pnpm worker` | Timeout + batch jobs |

## Privacy & neutrality

GQ is institutional infrastructure — not a marketplace. Ishyiga is the first VCIS client on the rail, not the rail itself. Sensitive fields decrypt only for delivery, OTP, or RRA agent inspection (each decrypt writes `AuditLog`).
