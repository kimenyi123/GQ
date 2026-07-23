"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Button, Field, inputClass } from "@/components/design";
import { renderStickerPng } from "@/lib/sticker-canvas";
import {
  buildStickerQrPayload,
  buildStickerScanUrl,
  defaultStickerConfig,
  newPayableRow,
  stickerFromQuery,
  type PayableAccount,
  type SmartStickerConfig,
} from "@/lib/smart-sticker";

function PayableEditor({
  rows,
  onChange,
}: {
  rows: PayableAccount[];
  onChange: (rows: PayableAccount[]) => void;
}) {
  function update(id: string, patch: Partial<PayableAccount>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-line bg-paper p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Provider / bank">
              <input
                className={inputClass}
                value={row.provider}
                onChange={(e) => update(row.id, { provider: e.target.value })}
              />
            </Field>
            <Field label="Pay code">
              <input
                className={inputClass}
                value={row.code}
                onChange={(e) => update(row.id, { code: e.target.value })}
              />
            </Field>
            <Field label="Pill colour">
              <input
                type="color"
                className="h-12 w-full cursor-pointer rounded-xl border border-line bg-white"
                value={row.pillBg}
                onChange={(e) => update(row.id, { pillBg: e.target.value })}
              />
            </Field>
            <Field label="Text colour">
              <input
                type="color"
                className="h-12 w-full cursor-pointer rounded-xl border border-line bg-white"
                value={row.pillText}
                onChange={(e) => update(row.id, { pillText: e.target.value })}
              />
            </Field>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-bold text-red-600"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            disabled={rows.length <= 1}
          >
            Remove account
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" className="w-full py-2 text-xs" onClick={() => onChange([...rows, newPayableRow()])}>
        + Add payable account
      </Button>
    </div>
  );
}

export default function StickerBuilderPage() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<SmartStickerConfig>(() => ({
    ...defaultStickerConfig(),
    ...stickerFromQuery(searchParams),
  }));
  const [generated, setGenerated] = useState(false);
  const [stickerPng, setStickerPng] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [gq3Payload, setGq3Payload] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = useCallback((partial: Partial<SmartStickerConfig>) => {
    setConfig((c) => ({ ...c, ...partial }));
    setGenerated(false);
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const payload = buildStickerQrPayload(config);
      const url = buildStickerScanUrl(config);
      const qrSrc = await QRCode.toDataURL(url, { width: 440, margin: 1, errorCorrectionLevel: "M" });
      const png = await renderStickerPng(config, qrSrc);
      setGq3Payload(payload);
      setScanUrl(url);
      setStickerPng(png);
      setGenerated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate QR");
    } finally {
      setBusy(false);
    }
  }, [config]);

  useEffect(() => {
    if (searchParams.get("auto") === "1") void generate();
  }, [generate, searchParams]);

  async function downloadPng() {
    if (!stickerPng) return;
    setBusy(true);
    try {
      const a = document.createElement("a");
      a.href = stickerPng;
      a.download = `gq-sticker-${config.momoCode || "momo"}.png`;
      a.click();
      setMessage("Sticker PNG downloaded.");
    } catch {
      setMessage("Download failed — long-press the preview image to save.");
    } finally {
      setBusy(false);
    }
  }

  function printSticker() {
    if (!stickerPng) return;
    const w = window.open("");
    if (!w) return;
    w.document.write(`<img src="${stickerPng}" style="width:100%;max-width:400px;display:block;margin:0 auto" onload="window.print();window.close()" />`);
    w.document.close();
  }

  return (
    <AppShell wide nav>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sticker-print-area, #sticker-print-area * { visibility: visible; }
          #sticker-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <section className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald">Smart sticker</p>
        <h1 className="mt-2 text-4xl font-black text-navy">GQ payment sticker builder</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Same layout as the Ishyiga sticker: merchant box, QR, then bank pay codes below. QR encodes all payment
          options — scan opens a picker when more than one bank. Click <strong>Generate sticker</strong> when ready.
        </p>
        <Link href="/demo-qr" className="mt-3 inline-block text-sm font-bold text-emerald">
          ← Back to pilot QRs
        </Link>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-black text-navy">Brand & headline</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Brand line 1">
                <input className={inputClass} value={config.brandTop} onChange={(e) => patch({ brandTop: e.target.value })} />
              </Field>
              <Field label="Brand line 2">
                <input className={inputClass} value={config.brandBottom} onChange={(e) => patch({ brandBottom: e.target.value })} />
              </Field>
              <Field label="Certified by">
                <input className={inputClass} value={config.certifiedBy} onChange={(e) => patch({ certifiedBy: e.target.value })} />
              </Field>
              <Field label="SCAN word">
                <input className={inputClass} value={config.scanWord} onChange={(e) => patch({ scanWord: e.target.value })} />
              </Field>
              <Field label="PAY word">
                <input className={inputClass} value={config.payWord} onChange={(e) => patch({ payWord: e.target.value })} />
              </Field>
              <Field label="BUILD RWANDA">
                <input className={inputClass} value={config.buildWord} onChange={(e) => patch({ buildWord: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-black text-navy">Accounts payable (top)</h2>
            <p className="mt-1 text-xs text-muted">Access Bank, Airtel, BK — add any provider codes you need.</p>
            <div className="mt-4">
              <PayableEditor rows={config.payables} onChange={(payables) => patch({ payables })} />
            </div>
            <div className="mt-4">
              <Field label="Izina (footer under payables)">
                <input
                  className={inputClass}
                  value={config.payablesFooter}
                  onChange={(e) => patch({ payablesFooter: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Extra note (optional)">
                <input
                  className={inputClass}
                  value={config.extraNote}
                  onChange={(e) => patch({ extraNote: e.target.value })}
                  placeholder="e.g. Pay before pickup"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-black text-navy">Merchant & QR (GQ3)</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="TIN">
                <input className={inputClass} value={config.tin} onChange={(e) => patch({ tin: e.target.value })} />
              </Field>
              <Field label="MRC">
                <input className={inputClass} value={config.mrc} onChange={(e) => patch({ mrc: e.target.value })} />
              </Field>
              <Field label="MoMo kode">
                <input className={inputClass} value={config.momoCode} onChange={(e) => patch({ momoCode: e.target.value })} />
              </Field>
              <Field label="Izina">
                <input className={inputClass} value={config.izina} onChange={(e) => patch({ izina: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="QR scan URL (ebm.rw)">
                  <input
                    className={inputClass}
                    value={config.appBaseUrl}
                    onChange={(e) => patch({ appBaseUrl: e.target.value })}
                    placeholder="https://ebm.rw"
                  />
                </Field>
                <p className="mt-1 text-xs text-muted">
                  Encoded in the QR as{" "}
                  <span className="font-mono">{config.appBaseUrl || "https://ebm.rw"}/?payload=GQ3|…</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-black text-navy">Footer text</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Camera hint">
                <input className={inputClass} value={config.cameraHint} onChange={(e) => patch({ cameraHint: e.target.value })} />
              </Field>
              <Field label="SABA EBM title">
                <input className={inputClass} value={config.sabaTitle} onChange={(e) => patch({ sabaTitle: e.target.value })} />
              </Field>
              <Field label="SABA subtitle">
                <input className={inputClass} value={config.sabaSubtitle} onChange={(e) => patch({ sabaSubtitle: e.target.value })} />
              </Field>
              <Field label="ihute.rw URL">
                <input className={inputClass} value={config.ihuteUrl} onChange={(e) => patch({ ihuteUrl: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="ihute tagline">
                  <input className={inputClass} value={config.ihuteTagline} onChange={(e) => patch({ ihuteTagline: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>

          <Button className="w-full py-4 text-base" disabled={busy} onClick={() => void generate()}>
            {busy ? "Generating…" : "Generate sticker"}
          </Button>
        </div>

        <div className="space-y-4">
          <div id="sticker-print-area" className="rounded-2xl border border-line bg-paper p-4">
            {generated && stickerPng ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stickerPng}
                alt="GQ payment sticker"
                className="mx-auto block w-full max-w-[400px] rounded-2xl shadow-lg"
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
                <p className="text-sm font-bold">Preview appears here</p>
                <p className="mt-2 text-xs">Fill the fields and click Generate sticker</p>
              </div>
            )}
          </div>

          {generated ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="gold" className="w-full py-3" disabled={busy} onClick={() => void downloadPng()}>
                Download PNG
              </Button>
              <Button variant="ghost" className="w-full py-3" onClick={printSticker}>
                Print sticker
              </Button>
              <Button
                variant="ghost"
                className="w-full py-3 sm:col-span-2"
                onClick={() => navigator.clipboard.writeText(scanUrl)}
              >
                Copy scan URL
              </Button>
            </div>
          ) : null}

          {generated ? (
            <div className="rounded-xl border border-line bg-white p-4 text-xs">
              <p className="font-bold text-navy">GQ3 payload</p>
              <p className="mt-1 break-all font-mono text-muted">{gq3Payload}</p>
              <p className="mt-3 font-bold text-navy">Scan URL</p>
              <p className="mt-1 break-all font-mono text-emerald">{scanUrl}</p>
            </div>
          ) : null}

          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </div>
      </div>
    </AppShell>
  );
}
