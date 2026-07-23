import type { SmartStickerConfig } from "./smart-sticker";

const W = 400;
const NAVY = "#1B4F8A";
const NAVY_DARK = "#153E6D";
const MAROON = "#7F1D1D";
const GOLD = "#F5B800";
const GREEN = "#B8E986";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load QR image"));
    img.src = src;
  });
}

function drawHexLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  for (let layer = 0; layer < 3; layer++) {
    const colors = ["#F5B800", "#22C55E", "#0057A8"];
    ctx.fillStyle = colors[layer];
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const rad = r - layer * (size * 0.1);
      const px = rad * Math.cos(a);
      const py = rad * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRraSplash(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const colors = ["#F97316", "#22C55E", "#3B82F6", "#EAB308"];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 18);
    ctx.arc(x + 18 + i * 2, y + 16 + i, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = NAVY;
  ctx.font = "900 11px Arial, Helvetica, sans-serif";
  ctx.fillText("RRA", x + 8, y + 34);
}

function drawHeader(ctx: CanvasRenderingContext2D, config: SmartStickerConfig) {
  roundRect(ctx, 14, 12, 168, 44, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  drawHexLogo(ctx, 20, 16, 36);
  ctx.fillStyle = NAVY;
  ctx.font = "900 11px Arial, Helvetica, sans-serif";
  ctx.fillText(config.brandTop, 58, 30);
  ctx.fillStyle = "#16A34A";
  ctx.fillText(config.brandBottom, 58, 44);

  roundRect(ctx, W - 14 - 118, 12, 118, 44, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.font = "700 8px Arial, Helvetica, sans-serif";
  ctx.fillText("Certified by", W - 108, 28);
  drawRraSplash(ctx, W - 52, 14);

  ctx.font = "900 23px Arial, Helvetica, sans-serif";
  const w1 = ctx.measureText(`${config.scanWord} `).width;
  const w2 = ctx.measureText(`${config.payWord} `).width;
  const w3 = ctx.measureText(config.buildWord).width;
  let x = (W - (w1 + w2 + w3)) / 2;
  ctx.fillStyle = GREEN;
  ctx.fillText(`${config.scanWord} `, x, 78);
  x += w1;
  ctx.fillStyle = GOLD;
  ctx.fillText(`${config.payWord} `, x, 78);
  x += w2;
  ctx.fillStyle = GREEN;
  ctx.fillText(config.buildWord, x, 78);

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, 90);
  ctx.lineTo(W / 2 - 6, 90);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W / 2, 90, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W / 2 + 6, 90);
  ctx.lineTo(W - 28, 90);
  ctx.stroke();
}

function drawRowIcon(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "mrc" | "momo" | "izina") {
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.arc(x + 16, y + 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  if (kind === "mrc") {
    ctx.strokeRect(x + 8, y + 18, 16, 10);
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 18);
    ctx.lineTo(x + 12, y + 12);
    ctx.lineTo(x + 20, y + 12);
    ctx.lineTo(x + 22, y + 18);
    ctx.stroke();
  } else if (kind === "momo") {
    roundRect(ctx, x + 10, y + 8, 12, 18, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 16, y + 22, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  } else {
    ctx.strokeRect(x + 8, y + 12, 16, 10);
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 16);
    ctx.lineTo(x + 24, y + 16);
    ctx.stroke();
  }
}

function drawMerchantBox(ctx: CanvasRenderingContext2D, config: SmartStickerConfig, y: number) {
  const rows = [
    { kind: "mrc" as const, label: "MRC", value: config.mrc },
    { kind: "momo" as const, label: "MOMO KODE", value: config.momoCode },
    { kind: "izina" as const, label: "IZINA", value: config.izina },
  ];
  const boxH = 138;
  roundRect(ctx, 14, y, W - 28, boxH, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  rows.forEach((row, idx) => {
    const ry = y + idx * 46;
    if (idx > 0) {
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, ry);
      ctx.lineTo(W - 22, ry);
      ctx.stroke();
    }
    drawRowIcon(ctx, 24, ry + 6, row.kind);
    ctx.fillStyle = NAVY;
    ctx.font = "800 11px Arial, Helvetica, sans-serif";
    ctx.fillText(row.label, 58, ry + 22);
    ctx.beginPath();
    ctx.moveTo(148, ry + 10);
    ctx.lineTo(148, ry + 36);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.font = "800 15px Arial, Helvetica, sans-serif";
    ctx.fillText(row.value, W - 24, ry + 28);
    ctx.textAlign = "left";
  });
  return y + boxH;
}

async function drawQrBlock(ctx: CanvasRenderingContext2D, config: SmartStickerConfig, qrSrc: string, y: number) {
  const pad = 12;
  const qrSize = 210;
  const boxW = qrSize + pad * 2;
  const boxH = qrSize + pad * 2 + 30;
  const bx = (W - boxW) / 2;

  roundRect(ctx, bx, y, boxW, boxH, 12);
  ctx.fillStyle = MAROON;
  ctx.fill();
  roundRect(ctx, bx + 4, y + 4, boxW - 8, boxH - 8, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const qr = await loadImage(qrSrc);
  ctx.drawImage(qr, bx + pad, y + pad, qrSize, qrSize);

  ctx.fillStyle = MAROON;
  ctx.font = "700 9px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`📷  ${config.cameraHint}`, bx + boxW / 2, y + pad + qrSize + 18);
  ctx.textAlign = "left";
  return y + boxH;
}

function drawPayables(ctx: CanvasRenderingContext2D, config: SmartStickerConfig, y: number) {
  const boxH = 96 + (config.extraNote ? 12 : 0);
  roundRect(ctx, 14, y, W - 28, boxH, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const cols = config.payables.length;
  const colW = (W - 28) / Math.max(cols, 1);
  config.payables.forEach((p, i) => {
    const cx = 14 + colW * i + colW / 2;
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(14 + colW * i, y + 10);
      ctx.lineTo(14 + colW * i, y + boxH - 28);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = i === 0 ? GOLD : "#ffffff";
    ctx.font = "800 10px Arial, Helvetica, sans-serif";
    ctx.fillText(`${p.provider}:`, cx, y + 18);
    const pillW = Math.max(58, ctx.measureText(p.code).width + 22);
    roundRect(ctx, cx - pillW / 2, y + 24, pillW, 26, 6);
    ctx.fillStyle = p.pillBg;
    ctx.fill();
    ctx.fillStyle = p.pillText;
    ctx.font = "900 15px Arial, Helvetica, sans-serif";
    ctx.fillText(p.code, cx, y + 42);
  });

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 11px Arial, Helvetica, sans-serif";
  ctx.fillText("Izina : ", W / 2 - 42, y + boxH - 12);
  ctx.fillStyle = GOLD;
  ctx.fillText(config.payablesFooter, W / 2 + 2, y + boxH - 12);
  ctx.textAlign = "left";
  return y + boxH;
}

function drawFooter(ctx: CanvasRenderingContext2D, config: SmartStickerConfig, y: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(14, y);
  ctx.lineTo(W - 14, y);
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = "900 12px Arial, Helvetica, sans-serif";
  ctx.fillText(config.sabaTitle, 16, y + 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 8px Arial, Helvetica, sans-serif";
  ctx.fillText(config.sabaSubtitle, 16, y + 32);

  ctx.beginPath();
  ctx.moveTo(W / 2, y + 6);
  ctx.lineTo(W / 2, y + 38);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.fillStyle = GOLD;
  ctx.font = "900 12px Arial, Helvetica, sans-serif";
  ctx.fillText(`🛒 ${config.ihuteUrl}`, W - 16, y + 20);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 7px Arial, Helvetica, sans-serif";
  ctx.fillText(config.ihuteTagline, W - 16, y + 32);
  ctx.textAlign = "left";
}

/** Reference layout: header → merchant → QR → payables → footer */
export async function renderStickerPng(config: SmartStickerConfig, qrSrc: string, scale = 2): Promise<string> {
  const payH = 96 + (config.extraNote ? 12 : 0);
  const H = 98 + 138 + 268 + payH + 48 + 16;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);
  ctx.fillStyle = NAVY;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  drawHeader(ctx, config);
  let y = 98;
  y = drawMerchantBox(ctx, config, y) + 10;
  y = (await drawQrBlock(ctx, config, qrSrc, y)) + 10;
  y = drawPayables(ctx, config, y) + 10;
  drawFooter(ctx, config, y);

  return canvas.toDataURL("image/png");
}
