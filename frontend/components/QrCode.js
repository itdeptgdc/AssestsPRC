'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** URL encoded in every QR label: opens the public asset page */
export function assetQrUrl(code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/a/${encodeURIComponent(code)}`;
}

export async function qrDataUrl(text, size = 512) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });
}

export default function QrCode({ code, size = 160, className }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!code) return;
    let alive = true;
    qrDataUrl(assetQrUrl(code), Math.max(size * 2, 256)).then((s) => alive && setSrc(s));
    return () => { alive = false; };
  }, [code, size]);
  if (!src) return <div className={`skeleton ${className || ''}`} style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={code} width={size} height={size} className={className} style={{ width: size, height: size }} />;
}

export async function downloadQrPng(code, name) {
  const qr = await qrDataUrl(assetQrUrl(code), 600);
  // Compose label: QR + code text
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 860;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  await new Promise((res) => { img.onload = res; img.src = qr; });
  ctx.drawImage(img, 60, 50, 600, 600);
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px "JetBrains Mono", monospace';
  ctx.fillText(code, 360, 720);
  ctx.font = '32px "Noto Sans Thai", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText((name || '').slice(0, 36), 360, 780);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `QR-${code}.png`;
  a.click();
}
