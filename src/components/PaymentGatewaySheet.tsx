"use client";

import type { PaymentRail } from "@/lib/payment-gateway";

export function PaymentGatewaySheet({
  open,
  amountRwf,
  merchantName,
  rails,
  onPick,
  onClose,
}: {
  open: boolean;
  amountRwf: number;
  merchantName: string;
  rails: PaymentRail[];
  onPick: (rail: PaymentRail) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-[fade_0.2s_ease] rounded-t-3xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">Hitamo uburyo bwo kwishyura</p>
        <h2 className="mt-1 text-center text-xl font-black text-navy">{merchantName}</h2>
        <p className="mt-1 text-center text-sm font-bold text-emerald">{amountRwf.toLocaleString()} RWF</p>

        <div className="mt-4 space-y-2">
          {rails.map((rail) => (
            <button
              key={rail.id}
              type="button"
              onClick={() => onPick(rail)}
              className="flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-left transition hover:border-navy"
            >
              <span className="text-sm font-bold text-navy">{rail.provider}</span>
              <span
                className="rounded-lg px-3 py-1.5 font-mono text-sm font-black"
                style={{ background: rail.pillBg, color: rail.pillText }}
              >
                {rail.code}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted">Kanda option — telefone izafungura USSD</p>
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm font-bold text-muted">
          Funga
        </button>
      </div>
    </div>
  );
}
