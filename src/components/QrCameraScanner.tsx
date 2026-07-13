"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import jsQR from "jsqr";

type Props = {
  onScan: (text: string) => void;
  onCancel: () => void;
  labels: {
    aiming: string;
    cancel: string;
    cameraError: string;
    fallback: string;
    insecureHint: string;
    takePhoto: string;
    useLive: string;
    detecting: string;
    notFound: string;
  };
};

function canUseLiveCamera() {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

async function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image load failed"));
    el.src = url;
  });
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

function drawScaled(img: HTMLImageElement, maxSide = 1600) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

async function decodeQrFromFile(file: File): Promise<string> {
  const { img, revoke } = await loadImage(file);
  try {
    const { canvas, ctx, w, h } = drawScaled(img);

    const imageData = ctx.getImageData(0, 0, w, h);
    const js = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
    if (js?.data) return js.data;

    try {
      const reader = new BrowserMultiFormatReader();
      const result = reader.decodeFromCanvas(canvas);
      if (result?.getText()) return result.getText();
    } catch {
      // continue
    }

    const crop = Math.min(w, h);
    const sx = Math.floor((w - crop) / 2);
    const sy = Math.floor((h - crop) / 2);
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = crop;
    cropCanvas.height = crop;
    const cctx = cropCanvas.getContext("2d", { willReadFrequently: true });
    if (cctx) {
      cctx.drawImage(canvas, sx, sy, crop, crop, 0, 0, crop, crop);
      const cropData = cctx.getImageData(0, 0, crop, crop);
      const jsCrop = jsQR(cropData.data, crop, crop, { inversionAttempts: "attemptBoth" });
      if (jsCrop?.data) return jsCrop.data;
      try {
        const reader = new BrowserMultiFormatReader();
        const result = reader.decodeFromCanvas(cropCanvas);
        if (result?.getText()) return result.getText();
      } catch {
        // fall through
      }
    }

    throw new Error("QR_NOT_FOUND");
  } finally {
    revoke();
  }
}

export function QrCameraScanner({ onScan, onCancel, labels }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handled = useRef(false);
  const [error, setError] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [live, setLive] = useState(false);
  const [secure, setSecure] = useState(false);

  useEffect(() => {
    setSecure(canUseLiveCamera());
  }, []);

  useEffect(() => {
    if (!secure) {
      setError(labels.insecureHint);
      return;
    }

    handled.current = false;
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    setLive(true);
    setError("");

    async function start() {
      try {
        // Prefer back camera on phones
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          devices[devices.length - 1]?.deviceId;

        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          back,
          videoRef.current,
          (result) => {
            if (cancelled || handled.current) return;
            if (!result) return;
            handled.current = true;
            controlsRef.current?.stop();
            onScan(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        setLive(false);
        setError(e instanceof Error ? e.message : labels.cameraError);
      }
    }

    start();

    return () => {
      cancelled = true;
      setLive(false);
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [labels.cameraError, labels.insecureHint, onScan, secure]);

  async function decodeFromFile(file: File) {
    setBusyPhoto(true);
    setError(labels.detecting);
    try {
      const text = await decodeQrFromFile(file);
      onScan(text);
    } catch {
      setError(labels.notFound);
    } finally {
      setBusyPhoto(false);
    }
  }

  return (
    <div className="mt-3.5 space-y-3">
      {secure && live ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
          <video
            ref={videoRef}
            className="aspect-[3/4] w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-2xl border-2 border-emerald shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <p className="absolute bottom-3 left-0 right-0 text-center text-xs font-semibold text-white drop-shadow">
            {labels.aiming}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-4 text-center">
          <p className="text-sm font-bold text-gold">{labels.cameraError}</p>
          {error ? <p className="mt-2 text-sm leading-relaxed text-muted">{error}</p> : null}
          <p className="mt-2 text-sm text-muted">{labels.fallback}</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) decodeFromFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busyPhoto}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-[15px] bg-navy py-[18px] text-[17px] font-bold text-white disabled:opacity-60"
      >
        {busyPhoto ? labels.detecting : labels.takePhoto}
      </button>

      {secure ? <p className="text-center text-xs text-muted">{labels.useLive}</p> : null}

      <button
        type="button"
        onClick={() => {
          controlsRef.current?.stop();
          onCancel();
        }}
        className="w-full rounded-[13px] border-[1.5px] border-line bg-white py-3 text-sm font-bold text-navy"
      >
        {labels.cancel}
      </button>
    </div>
  );
}
