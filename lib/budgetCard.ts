// Quote Card Generator (Phase 5) — সরাসরি Canvas 2D context দিয়ে আঁকা, কোনো
// html2canvas/dom-to-image ডিপেন্ডেন্সি ছাড়াই (স্পেক §15: "DO NOT use
// generative AI to render pricing cards" — প্রাইস সবসময় exact হতে হবে, তাই
// deterministic ড্রয়িং কোড, ছবি-জেনারেশন মডেল না)। এই একই canvas.toBlob()
// প্যাটার্ন আগে থেকেই সিগনেচার ক্যাপচারে ব্যবহৃত হয়
// (app/client/project/[id]/sow/sign/page.tsx)।
//
// দুটো ফরম্যাটই (Square/Portrait) একই ড্রয়িং ফাংশন শেয়ার করে, শুধু CARD_SIZES
// এন্ট্রি আলাদা — নতুন সাইজ যোগ করা মানে একটা নতুন কনফিগ এন্ট্রি, নতুন কোড না।

export type CardFormat = 'square' | 'portrait';

export const CARD_SIZES: Record<CardFormat, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: 'Square (1080×1080)' },
  portrait: { w: 1080, h: 1350, label: 'Portrait (1080×1350)' },
};

export type CardTier = { key: 'starter' | 'standard' | 'advanced'; label: string; range: string; recommended?: boolean };

export type CardOptions = {
  format: CardFormat;
  teamName: string;
  logoImage: HTMLImageElement | null;
  showLogo: boolean;
  serviceName: string;
  serviceBrief: string;
  showBrief: boolean;
  clientName: string;
  companyName: string;
  showClientName: boolean;
  validUntilLabel: string | null;
  showValidity: boolean;
  tiers: CardTier[];
  website: string;
  contactEmail: string;
  brandAccent: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  else if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && lines[maxLines - 1].length > 1) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
    }
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawQuoteCard(canvas: HTMLCanvasElement, opts: CardOptions): void {
  const { w, h } = CARD_SIZES[opts.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pad = 72;
  const contentW = w - pad * 2;

  // background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  // top accent bar
  ctx.fillStyle = opts.brandAccent;
  ctx.fillRect(0, 0, w, 14);

  let y = pad + 20;

  // header: logo + team name
  ctx.textBaseline = 'alphabetic';
  let headerTextX = pad;
  if (opts.showLogo && opts.logoImage) {
    const logoSize = 72;
    ctx.drawImage(opts.logoImage, pad, y, logoSize, logoSize);
    headerTextX = pad + logoSize + 20;
  }
  ctx.fillStyle = opts.brandAccent;
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText(opts.teamName, headerTextX, y + 46);
  y += 72 + 40;

  // divider
  ctx.strokeStyle = '#E8E8EC';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(w - pad, y);
  ctx.stroke();
  y += 48;

  // service title
  ctx.fillStyle = '#14141A';
  ctx.font = '800 52px Arial, sans-serif';
  const titleLines = wrapText(ctx, opts.serviceName, contentW, 2);
  for (const line of titleLines) {
    ctx.fillText(line, pad, y + 42);
    y += 60;
  }
  y += 6;

  // client/company subtitle
  if (opts.showClientName && (opts.clientName || opts.companyName)) {
    const sub = [opts.clientName, opts.companyName].filter(Boolean).join(' · ');
    ctx.fillStyle = '#6E6E7A';
    ctx.font = '600 28px Arial, sans-serif';
    ctx.fillText(`Prepared for: ${sub}`, pad, y + 26);
    y += 48;
  }

  // brief
  if (opts.showBrief && opts.serviceBrief) {
    ctx.fillStyle = '#6E6E7A';
    ctx.font = '400 26px Arial, sans-serif';
    const briefLines = wrapText(ctx, opts.serviceBrief, contentW, 3);
    for (const line of briefLines) {
      ctx.fillText(line, pad, y + 22);
      y += 38;
    }
    y += 14;
  }

  y += 20;

  // price tiers
  const tierH = 108;
  const tierGap = 18;
  for (const tier of opts.tiers) {
    const isRecommended = !!tier.recommended;
    ctx.fillStyle = isRecommended ? rgba(opts.brandAccent, 0.08) : '#FBFBFC';
    roundRect(ctx, pad, y, contentW, tierH, 16);
    ctx.fill();
    if (isRecommended) {
      ctx.strokeStyle = opts.brandAccent;
      ctx.lineWidth = 2.5;
      roundRect(ctx, pad, y, contentW, tierH, 16);
      ctx.stroke();
    }

    ctx.fillStyle = isRecommended ? opts.brandAccent : '#6E6E7A';
    ctx.font = '700 26px Arial, sans-serif';
    ctx.fillText(tier.label.toUpperCase(), pad + 32, y + 42);

    if (isRecommended) {
      const badgeText = 'RECOMMENDED';
      ctx.font = '700 18px Arial, sans-serif';
      const badgeW = ctx.measureText(badgeText).width + 28;
      ctx.fillStyle = opts.brandAccent;
      roundRect(ctx, pad + 32, y + 56, badgeW, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeText, pad + 46, y + 78);
    }

    ctx.fillStyle = '#14141A';
    ctx.font = '800 36px Arial, sans-serif';
    const priceW = ctx.measureText(tier.range).width;
    ctx.fillText(tier.range, pad + contentW - priceW - 32, y + 66);

    y += tierH + tierGap;
  }

  y += 14;

  // validity
  if (opts.showValidity && opts.validUntilLabel) {
    ctx.fillStyle = '#A3A3AE';
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText(`Valid until ${opts.validUntilLabel}`, pad, y + 20);
    y += 40;
  }

  // footer — নিচে অ্যাঙ্কর করা (portrait ফরম্যাটে বাড়তি স্পেস নিচে ফাঁকা থাকে)
  const footerY = h - pad - 30;
  ctx.strokeStyle = '#E8E8EC';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, footerY - 30);
  ctx.lineTo(w - pad, footerY - 30);
  ctx.stroke();

  ctx.fillStyle = '#A3A3AE';
  ctx.font = '500 22px Arial, sans-serif';
  const footerParts = [opts.website, opts.contactEmail].filter(Boolean);
  ctx.fillText(footerParts.join('  ·  '), pad, footerY);
}
