"use client";

import { useRef, useState } from "react";
import { gqExportDebugLog, gqTrack } from "@/lib/gq-tracker";

async function tryCopyText(text: string, textarea?: HTMLTextAreaElement | null): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* HTTP / permission — fall through */
    }
  }
  if (textarea) {
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
  return false;
}

export function GqDebugShare({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [status, setStatus] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function reveal() {
    const text = gqExportDebugLog();
    gqTrack("debug.share_click", { bytes: text.length });
    setLogText(text);
    setOpen(true);
    setStatus("Loading log…");

    await new Promise((r) => window.setTimeout(r, 50));

    const copied = await tryCopyText(text, textareaRef.current);

    if (!copied && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "GQ debug log", text });
        setStatus("Shared — thank you!");
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }

    setStatus(
      copied
        ? "Copied — paste to WhatsApp / chat"
        : "Long-press the box below → Select all → Copy",
    );
  }

  function selectAll() {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
    void tryCopyText(el.value, el).then((ok) => {
      setStatus(ok ? "Copied!" : "Now tap Copy on your keyboard");
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void reveal()}
        className="w-full rounded-xl border border-dashed border-gold/60 bg-gold/5 py-2.5 text-xs font-bold text-navy"
      >
        {open ? "Refresh debug log" : "Share debug log (for support)"}
      </button>

      {status ? (
        <p className={`mt-2 text-center text-xs ${status.includes("fail") || status.includes("Long-press") ? "text-navy" : "text-emerald"}`}>
          {status}
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Debug log ({logText.length.toLocaleString()} chars)
            </span>
            <button
              type="button"
              onClick={selectAll}
              className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-navy"
            >
              Select all
            </button>
          </div>
          <textarea
            ref={textareaRef}
            readOnly
            value={logText}
            className="h-52 w-full resize-y rounded-xl border border-line bg-white p-3 font-mono text-[10px] leading-snug text-ink"
            onFocus={(e) => e.target.select()}
          />
          <p className="text-center text-[11px] text-muted">
            Screenshot this box or copy the text and send to support.
          </p>
        </div>
      ) : null}
    </div>
  );
}
