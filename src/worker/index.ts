import cron from "node-cron";
import { generateBatchRunId } from "../lib/ids";
import { mockRraPush } from "../lib/rra-mock";
import { prisma } from "../lib/prisma";
import { transitionGlobalQr } from "../lib/state-machine";

const HOUR = 60 * 60 * 1000;
const standbyHours = Number(process.env.GQ_STANDBY_HOURS ?? 48);

export async function sweepAgingRequests() {
  const now = Date.now();
  const generatingCutoff = new Date(now - 24 * HOUR);
  const standbyCutoff = new Date(now - standbyHours * HOUR);

  const staleGenerating = await prisma.globalQr.findMany({
    where: {
      status: "GENERATING",
      updatedAt: { lt: generatingCutoff },
    },
    select: { gqId: true },
  });

  for (const record of staleGenerating) {
    await transitionGlobalQr(record.gqId, "STANDBY", {
      actor: "worker",
      role: "system",
      decision: "24H_BREACH",
      decisionBy: "worker",
    });
  }

  const staleStandby = await prisma.globalQr.findMany({
    where: {
      status: "STANDBY",
      updatedAt: { lt: standbyCutoff },
    },
    select: { gqId: true },
  });

  for (const record of staleStandby) {
    await transitionGlobalQr(record.gqId, "ADJUST", {
      actor: "worker",
      role: "system",
      decision: "STANDBY_WINDOW_EXPIRED",
      decisionBy: "worker",
    });
  }

  return {
    generatingToStandby: staleGenerating.length,
    standbyToAdjust: staleStandby.length,
  };
}

export async function runAdjustBatch() {
  const candidates = await prisma.globalQr.findMany({
    where: { status: "ADJUST" },
    orderBy: { updatedAt: "asc" },
  });
  let pushed = 0;
  let failed = 0;

  for (const record of candidates) {
    try {
      const rraResponse = mockRraPush(record);
      await transitionGlobalQr(record.gqId, "DONE", {
        actor: "batch-worker",
        role: "system",
        decision: "FINAL_PUSH",
        decisionBy: "batch-worker",
        extra: {
          sdcNumber: rraResponse.sdcNumber,
          rraResponse: JSON.stringify(rraResponse),
          invoicePdfUrl: record.invoicePdfUrl ?? `/demo/invoices/${record.gqId}.pdf`,
        },
      });
      pushed += 1;
    } catch (error) {
      failed += 1;
      console.error("[ADJUST BATCH FAILED]", record.gqId, error);
    }
  }

  const batchRun = await prisma.batchRun.create({
    data: {
      id: generateBatchRunId(),
      date: new Date(),
      pushed,
      refunded: 0,
      failed,
      report: JSON.stringify({
        candidates: candidates.length,
        pushed,
        failed,
      }),
    },
  });

  return batchRun;
}

function startWorker() {
  cron.schedule("* * * * *", () => {
    sweepAgingRequests().catch((error) => {
      console.error("[AGING SWEEP FAILED]", error);
    });
  });

  cron.schedule(
    "0 2 * * *",
    () => {
      runAdjustBatch().catch((error) => {
        console.error("[ADJUST BATCH FAILED]", error);
      });
    },
    { timezone: "Africa/Kigali" },
  );

  console.log("Global QR worker started");
}

const invokedDirectly = process.argv.some(
  (arg) => arg.endsWith("src/worker/index.ts") || arg.endsWith("src\\worker\\index.ts"),
);

if (process.env.NODE_ENV !== "test" && invokedDirectly) {
  startWorker();
}
