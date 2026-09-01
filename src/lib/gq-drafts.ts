import { Prisma } from "@prisma/client";
import { writeAudit } from "./audit";
import { isDatabaseReady } from "./db-ready";
import { generateAuditId } from "./ids";
import { prisma } from "./prisma";
import { verifyOptionalHmac } from "./request-utils";

export const draftStatuses = ["DRAFT", "READY", "PAYING", "PAID", "STAMPED", "EXPIRED"] as const;
export type DraftStatus = (typeof draftStatuses)[number];

export type DraftInput = {
  docRef: string;
  tin: string;
  mrc: string;
  status?: DraftStatus;
  ijisho?: string | null;
  buyerTin?: string | null;
  buyerName?: string | null;
  amount?: number | null;
  tva?: number | null;
  items?: unknown;
  gqPayload?: string | null;
  gqUrl?: string | null;
  railCode?: string | null;
  railTxnId?: string | null;
  railAmount?: number | null;
  railSource?: string | null;
};

const memDrafts = new Map<string, DraftInput & { updatedAt: Date }>();

function normalizeItems(items: unknown) {
  if (items == null) return null;
  return typeof items === "string" ? items : JSON.stringify(items);
}

function publicDraft(row: DraftInput & { updatedAt?: Date }) {
  let items: unknown[] = [];
  if (row.items != null) {
    if (typeof row.items === "string") {
      try {
        items = JSON.parse(row.items);
      } catch {
        items = [];
      }
    } else if (Array.isArray(row.items)) {
      items = row.items;
    }
  }
  return {
    docRef: row.docRef,
    status: row.status ?? "DRAFT",
    tin: row.tin,
    mrc: row.mrc,
    ijisho: row.ijisho ?? null,
    buyerTin: row.buyerTin ?? null,
    buyerName: row.buyerName ?? null,
    amount: row.amount ?? null,
    tva: row.tva ?? null,
    items,
    gqPayload: row.gqPayload ?? null,
    gqUrl: row.gqUrl ?? null,
    railCode: row.railCode ?? null,
    railTxnId: row.railTxnId ?? null,
    railAmount: row.railAmount ?? null,
    railSource: row.railSource ?? null,
    updatedAt: row.updatedAt ?? new Date(),
  };
}

export async function upsertDraft(input: DraftInput, actor = "erp-adapter") {
  const status = input.status ?? "DRAFT";
  const itemsJson = normalizeItems(input.items);
  const updatedAt = new Date();

  if (!(await isDatabaseReady())) {
    memDrafts.set(input.docRef, { ...input, status, items: itemsJson, updatedAt });
    return publicDraft(memDrafts.get(input.docRef)!);
  }

  try {
    const row = await prisma.gqDraft.upsert({
      where: { docRef: input.docRef },
      create: {
        docRef: input.docRef,
        tin: input.tin,
        mrc: input.mrc,
        status,
        ijisho: input.ijisho ?? null,
        buyerTin: input.buyerTin ?? null,
        buyerName: input.buyerName ?? null,
        amount: input.amount == null ? null : new Prisma.Decimal(input.amount),
        tva: input.tva == null ? null : new Prisma.Decimal(input.tva),
        items: itemsJson,
        gqPayload: input.gqPayload ?? null,
        gqUrl: input.gqUrl ?? null,
        railCode: input.railCode ?? null,
        railTxnId: input.railTxnId ?? null,
        railAmount: input.railAmount == null ? null : new Prisma.Decimal(input.railAmount),
        railSource: input.railSource ?? null,
      },
      update: {
        tin: input.tin,
        mrc: input.mrc,
        status,
        ijisho: input.ijisho ?? null,
        buyerTin: input.buyerTin ?? null,
        buyerName: input.buyerName ?? null,
        amount: input.amount == null ? null : new Prisma.Decimal(input.amount),
        tva: input.tva == null ? null : new Prisma.Decimal(input.tva),
        items: itemsJson,
        gqPayload: input.gqPayload ?? null,
        gqUrl: input.gqUrl ?? null,
        railCode: input.railCode ?? null,
        railTxnId: input.railTxnId ?? null,
        railAmount: input.railAmount == null ? null : new Prisma.Decimal(input.railAmount),
        railSource: input.railSource ?? null,
      },
    });

    await writeAudit({
      actor,
      role: "vendor",
      action: "GQ_DRAFT_UPSERT",
      entity: "GqDraft",
      entityId: row.docRef,
      after: JSON.stringify(row),
    });

    return publicDraft({
      docRef: row.docRef,
      tin: row.tin,
      mrc: row.mrc,
      status: row.status as DraftStatus,
      ijisho: row.ijisho,
      buyerTin: row.buyerTin,
      buyerName: row.buyerName,
      amount: row.amount == null ? null : Number(row.amount),
      tva: row.tva == null ? null : Number(row.tva),
      items: row.items,
      gqPayload: row.gqPayload,
      gqUrl: row.gqUrl,
      railCode: row.railCode,
      railTxnId: row.railTxnId,
      railAmount: row.railAmount == null ? null : Number(row.railAmount),
      railSource: row.railSource,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    console.warn("[GQ_DRAFT_DB_FALLBACK]", error);
    memDrafts.set(input.docRef, { ...input, status, items: itemsJson, updatedAt });
    return publicDraft(memDrafts.get(input.docRef)!);
  }
}

export async function patchDraftStatus(docRef: string, patch: Partial<DraftInput>, actor = "erp-adapter") {
  const existing = await getDraft(docRef);
  if (!existing) {
    throw new Error(`Draft not found: ${docRef}`);
  }

  const merged: DraftInput = {
    docRef,
    tin: patch.tin ?? existing.tin,
    mrc: patch.mrc ?? existing.mrc,
    status: (patch.status ?? existing.status) as DraftStatus,
    ijisho: patch.ijisho ?? existing.ijisho,
    buyerTin: patch.buyerTin ?? existing.buyerTin,
    buyerName: patch.buyerName ?? existing.buyerName,
    amount: patch.amount ?? existing.amount,
    tva: patch.tva ?? existing.tva,
    items: patch.items ?? existing.items,
    gqPayload: patch.gqPayload ?? existing.gqPayload,
    gqUrl: patch.gqUrl ?? existing.gqUrl,
    railCode: patch.railCode ?? existing.railCode,
    railTxnId: patch.railTxnId ?? existing.railTxnId,
    railAmount: patch.railAmount ?? existing.railAmount,
    railSource: patch.railSource ?? existing.railSource,
  };

  return upsertDraft(merged, actor);
}

export async function getDraft(docRef: string) {
  if (!(await isDatabaseReady())) {
    const row = memDrafts.get(docRef);
    return row ? publicDraft(row) : null;
  }

  try {
    const row = await prisma.gqDraft.findUnique({ where: { docRef } });
    if (!row) {
      const mem = memDrafts.get(docRef);
      return mem ? publicDraft(mem) : null;
    }

    return publicDraft({
      docRef: row.docRef,
      tin: row.tin,
      mrc: row.mrc,
      status: row.status as DraftStatus,
      ijisho: row.ijisho,
      buyerTin: row.buyerTin,
      buyerName: row.buyerName,
      amount: row.amount == null ? null : Number(row.amount),
      tva: row.tva == null ? null : Number(row.tva),
      items: row.items,
      gqPayload: row.gqPayload,
      gqUrl: row.gqUrl,
      railCode: row.railCode,
      railTxnId: row.railTxnId,
      railAmount: row.railAmount == null ? null : Number(row.railAmount),
      railSource: row.railSource,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    console.warn("[GQ_DRAFT_GET_FALLBACK]", error);
    const row = memDrafts.get(docRef);
    return row ? publicDraft(row) : null;
  }
}

export async function verifyDraftRequest(request: Request, raw: string) {
  return verifyOptionalHmac(request, raw);
}

export async function clearMemoryDrafts() {
  memDrafts.clear();
}
