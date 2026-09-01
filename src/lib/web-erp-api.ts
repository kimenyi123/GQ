import { jsonErr, jsonOk } from "@/lib/api";
import { upsertDraft, patchDraftStatus } from "@/lib/gq-drafts";
import {
  webErpCurrent,
  webErpMarkPaid,
  webErpMarkStamped,
  webErpPushReady,
  webErpReset,
  webErpToLanJson,
  webErpUpsertSession,
  type WebErpSnapshot,
} from "@/lib/web-erp-store";
import { readJson } from "@/lib/request-utils";
import type { SimCartLine } from "@/lib/simulator-helpers";

function devOnly() {
  if (process.env.NODE_ENV === "production") {
    return jsonErr("Web ERP simulator not available in production", 404);
  }
  return null;
}

async function syncCloud(snap: WebErpSnapshot) {
  await upsertDraft({
    docRef: snap.docRef,
    tin: snap.tin,
    mrc: snap.mrc,
    status: snap.status,
    ijisho: snap.ijisho,
    buyerTin: snap.buyerTin,
    buyerName: snap.buyerName,
    amount: snap.amount,
    tva: snap.tva,
    items: snap.items,
    gqPayload: snap.gqPayload || null,
    gqUrl: snap.gqUrl || null,
    railCode: snap.railCode || null,
    railTxnId: snap.railTxnId || null,
    railAmount: snap.railAmount || null,
    railSource: snap.railSource || null,
  });
  if (snap.status !== "DRAFT") {
    await patchDraftStatus(snap.docRef, { status: snap.status });
  }
}

export async function webErpHealthRoute() {
  const blocked = devOnly();
  if (blocked) return blocked;
  return jsonOk({ ok: true, service: "web-erp-adapter", replaces: "Ishyiga LAN :8744" });
}

export async function webErpCurrentRoute() {
  const blocked = devOnly();
  if (blocked) return blocked;
  const snap = webErpCurrent();
  if (!snap) return jsonErr("No active draft", 404);
  return jsonOk(webErpToLanJson(snap));
}

export async function webErpGetDraftRoute(docRef: string) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const snap = webErpCurrent();
  if (!snap || snap.docRef !== decodeURIComponent(docRef)) {
    return jsonErr("Draft not found", 404);
  }
  return jsonOk(webErpToLanJson(snap));
}

export async function webErpSessionRoute(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body || typeof body.tin !== "string" || typeof body.mrc !== "string") {
    return jsonErr("tin, mrc and items required", 400);
  }
  const items = (body.items as SimCartLine[]) ?? [];
  const snap = webErpUpsertSession({
    tin: body.tin,
    mrc: body.mrc,
    employe: typeof body.employe === "string" ? body.employe : undefined,
    merchantName: typeof body.merchantName === "string" ? body.merchantName : undefined,
    buyerTin: typeof body.buyerTin === "string" ? body.buyerTin : undefined,
    buyerName: typeof body.buyerName === "string" ? body.buyerName : undefined,
    buyerPhone: typeof body.buyerPhone === "string" ? body.buyerPhone : undefined,
    ijisho: typeof body.ijisho === "string" ? body.ijisho : undefined,
    items,
    printOption: body.printOption as WebErpSnapshot["printOption"],
    promoText: typeof body.promoText === "string" ? body.promoText : undefined,
    docRef: typeof body.docRef === "string" ? body.docRef : undefined,
  });
  try {
    await syncCloud(snap);
  } catch (error) {
    console.warn("[WEB_ERP_CLOUD]", error);
  }
  return jsonOk(webErpToLanJson(snap));
}

export async function webErpPushRoute(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const body = await readJson<{ appBaseUrl?: string }>(request);
  const origin = request.headers.get("origin") ?? request.headers.get("referer")?.split("/").slice(0, 3).join("/");
  const base = body?.appBaseUrl ?? origin ?? "http://localhost:3000";
  const snap = webErpPushReady(base);
  if (!snap) return jsonErr("Cart empty — add items first", 400);
  try {
    await syncCloud(snap);
    await patchDraftStatus(snap.docRef, {
      status: "READY",
      gqPayload: snap.gqPayload,
      gqUrl: snap.gqUrl,
    });
  } catch (error) {
    console.warn("[WEB_ERP_PUSH]", error);
  }
  return jsonOk(webErpToLanJson(snap));
}

export async function webErpPaidRoute(request: Request, docRef: string) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const body = await readJson<Record<string, unknown>>(request);
  const railCode = String(body?.railCode ?? "");
  const txnId = String(body?.txnId ?? "");
  const amount = Number(body?.amount ?? 0);
  const source = String(body?.source ?? "till");
  const snap = webErpMarkPaid(decodeURIComponent(docRef), railCode, txnId, amount, source);
  if (!snap) return jsonErr("Draft not found", 404);
  try {
    await patchDraftStatus(snap.docRef, {
      status: "PAID",
      railCode,
      railTxnId: txnId,
      railAmount: amount,
      railSource: source,
    });
  } catch (error) {
    console.warn("[WEB_ERP_PAID]", error);
  }
  return jsonOk(webErpToLanJson(snap));
}

export async function webErpResetRoute() {
  const blocked = devOnly();
  if (blocked) return blocked;
  webErpReset();
  return jsonOk({ reset: true });
}

export async function webErpStampedRoute(docRef: string) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const snap = webErpMarkStamped(decodeURIComponent(docRef));
  if (!snap) return jsonErr("Draft not found", 404);
  return jsonOk(webErpToLanJson(snap));
}
