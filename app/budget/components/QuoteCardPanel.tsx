'use client';

// Quote Card configuration + live preview (Phase 5, স্পেক §17)। বাম দিকে
// টগল/ফরম্যাট কনফিগ, ডান দিকে real-time canvas প্রিভিউ — Generate Quote
// wizard-এর Card ধাপ আর Quote Detail পাতা দুই জায়গাতেই রিইউজড।
//
// লোগো এখনো (Phase 7 Settings-এর আগে) কখনো সেট থাকে না — budget_settings.
// logo_url ভবিষ্যতে যোগ হলে Drive থেকে আসবে, crossOrigin='anonymous' দিয়ে
// লোড করার চেষ্টা হয়; লোড/CORS ফেইল করলে চুপচাপ লোগো ছাড়াই আঁকা হয় (কখনো
// crash করবে না, canvas.toBlob() পুরো "tainted canvas" এরর দিতে পারে যদি
// crossOrigin ছাড়া cross-origin ছবি আঁকা হয়)।

import { useEffect, useRef, useState } from 'react';
import { CARD_SIZES, drawQuoteCard, type CardFormat, type CardTier } from '@/lib/budgetCard';

export type QuoteCardData = {
  teamName: string;
  logoUrl: string | null;
  serviceName: string;
  serviceBrief: string;
  clientName: string;
  companyName: string;
  validUntilLabel: string | null;
  tiers: CardTier[];
  website: string;
  contactEmail: string;
  brandAccent: string;
};

export default function QuoteCardPanel({ data }: { data: QuoteCardData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<CardFormat>('square');
  const [showLogo, setShowLogo] = useState(true);
  const [showBrief, setShowBrief] = useState(true);
  const [showClientName, setShowClientName] = useState(true);
  const [showValidity, setShowValidity] = useState(true);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data.logoUrl) {
      const timer = setTimeout(() => setLogoImage(null), 0);
      return () => clearTimeout(timer);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setLogoImage(img);
    img.onerror = () => setLogoImage(null);
    img.src = data.logoUrl;
  }, [data.logoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawQuoteCard(canvas, {
      format,
      teamName: data.teamName,
      logoImage,
      showLogo,
      serviceName: data.serviceName,
      serviceBrief: data.serviceBrief,
      showBrief,
      clientName: data.clientName,
      companyName: data.companyName,
      showClientName,
      validUntilLabel: data.validUntilLabel,
      showValidity,
      tiers: data.tiers,
      website: data.website,
      contactEmail: data.contactEmail,
      brandAccent: data.brandAccent || '#5B4FE8',
    });
  }, [data, format, showLogo, showBrief, showClientName, showValidity, logoImage]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-quote-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], 'quote-card.png', { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          setShareMsg('Sharing images is not supported here — use Download instead.');
          return;
        }
        await navigator.share({ files: [file], title: `${data.serviceName} — Quote`, text: `Estimated pricing for ${data.serviceName}` });
      } catch {
        // ইউজার শেয়ার ক্যানসেল করলে বা সাপোর্ট না থাকলে চুপচাপ — এরর দেখানোর দরকার নেই
      }
    }, 'image/png');
  }

  return (
    <div className="card-panel-grid">
      <div className="card-config">
        <div className="field">
          <label className="field-label">Card Format</label>
          <select className="field-select" value={format} onChange={(e) => setFormat(e.target.value as CardFormat)}>
            {(Object.keys(CARD_SIZES) as CardFormat[]).map((f) => (
              <option key={f} value={f}>
                {CARD_SIZES[f].label}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Show logo
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showBrief} onChange={(e) => setShowBrief(e.target.checked)} /> Show service brief
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showClientName} onChange={(e) => setShowClientName(e.target.checked)} /> Show client name
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showValidity} onChange={(e) => setShowValidity(e.target.checked)} /> Show validity
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-accent btn-sm" onClick={handleDownload}>
            Download PNG
          </button>
          {canShare && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleShare}>
              Share
            </button>
          )}
        </div>
        {shareMsg && <p className="field-hint">{shareMsg}</p>}
      </div>

      <div className="card-preview-wrap">
        <canvas ref={canvasRef} className={`card-preview-canvas card-preview-${format}`} />
      </div>
    </div>
  );
}
