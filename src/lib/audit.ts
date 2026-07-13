import { prisma } from "./prisma";
import { generateAuditId } from "./ids";

export type AuditInput = {
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

function stringify(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      id: generateAuditId(),
      actor: input.actor,
      role: input.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: stringify(input.before),
      after: stringify(input.after),
    },
  });
}
