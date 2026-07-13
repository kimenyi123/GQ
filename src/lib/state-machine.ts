import { Prisma } from "@prisma/client";
import { generateAuditId } from "./ids";
import { prisma } from "./prisma";

export const globalQrStatuses = [
  "QUEUEING",
  "GENERATING",
  "STANDBY",
  "ADJUST",
  "DONE",
  "REFUNDED",
  "FAILED",
] as const;

export type GlobalQrStatus = (typeof globalQrStatuses)[number];

const terminalStatuses = new Set<GlobalQrStatus>([
  "DONE",
  "REFUNDED",
  "FAILED",
]);

const validTransitions: Record<GlobalQrStatus, GlobalQrStatus[]> = {
  QUEUEING: ["GENERATING", "STANDBY"],
  GENERATING: ["DONE", "STANDBY"],
  STANDBY: ["REFUNDED", "ADJUST"],
  ADJUST: ["DONE", "REFUNDED", "FAILED"],
  DONE: [],
  REFUNDED: [],
  FAILED: [],
};

export type TransitionMeta = {
  actor: string;
  role: string;
  decision?: string;
  decisionBy?: string;
  extra?: Partial<Prisma.GlobalQrUncheckedUpdateInput>;
};

export async function transitionGlobalQr(
  gqId: string,
  toStatus: GlobalQrStatus,
  meta: TransitionMeta,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.globalQr.findUnique({ where: { gqId } });

    if (!existing) {
      throw new Error(`GlobalQr not found: ${gqId}`);
    }

    if (existing.status === toStatus) {
      return existing;
    }

    const fromStatus = existing.status as GlobalQrStatus;

    if (terminalStatuses.has(fromStatus)) {
      throw new Error(`Cannot transition terminal status ${fromStatus}`);
    }

    if (!validTransitions[fromStatus]?.includes(toStatus)) {
      throw new Error(`Invalid transition ${fromStatus} -> ${toStatus}`);
    }

    const updated = await tx.globalQr.update({
      where: { gqId },
      data: {
        ...(meta.extra ?? {}),
        status: toStatus,
        decision: meta.decision,
        decisionBy: meta.decisionBy,
        decisionTs: meta.decision ? new Date() : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        id: generateAuditId(),
        actor: meta.actor,
        role: meta.role,
        action: "GLOBAL_QR_TRANSITION",
        entity: "GlobalQr",
        entityId: gqId,
        before: JSON.stringify(existing),
        after: JSON.stringify(updated),
      },
    });

    return updated;
  });
}
