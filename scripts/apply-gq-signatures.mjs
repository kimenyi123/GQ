import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const sql = readFileSync(new URL("./EBM_RW_add_gq_signatures.sql", import.meta.url), "utf8");
const batches = sql.split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);

for (const batch of batches) {
  if (batch.startsWith("USE ") || batch.startsWith("PRINT ")) continue;
  await p.$executeRawUnsafe(batch);
}

const cols = await p.$queryRawUnsafe(`
  SELECT c.name
  FROM sys.columns c
  JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = N'GlobalQr'
    AND c.name IN (N'gqPayload', N'gqRequestSignature', N'vsdcSignature', N'vsdcInternalData')
  ORDER BY c.name
`);

console.log(JSON.stringify({ ok: true, columns: cols.map((c) => c.name) }));
await p.$disconnect();
