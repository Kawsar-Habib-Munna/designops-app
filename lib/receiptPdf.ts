// Turns the on-page ReceiptDocument into an A4 PDF (html2canvas + jsPDF) with real page margins, and also returns the
// page images so the preview can show them where browsers cannot display a PDF inside an iframe (phones/tablets).

const PAGE_W = 210; // A4, mm
const PAGE_H = 297;
const MARGIN_X = 25.4; // the standard document margin: 1 inch (2.54 cm) on every side
const MARGIN_Y = 25.4;

// html2canvas capture of an on-page document, always in light colours
async function captureDocument(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  return Promise.race([
    html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      imageTimeout: 15000,
      onclone: (_doc, el) => {
        // the receipt is always generated in light colours, whatever theme the dashboard is in
        el.classList.remove('theme-dark');
        el.classList.add('theme-light');
      },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF generation timed out')), 25000)),
  ]);
}

// The document laid out on real A4 sheets: every page is a full 210 x 297 mm white page (same proportions whatever the
// content), with the page margins around it, so a short receipt is still an A4 page and a long one runs onto more pages.
function composeA4Pages(canvas: HTMLCanvasElement, breaks: number[] = []): HTMLCanvasElement[] {
  const contentW = PAGE_W - MARGIN_X * 2;
  const contentH = PAGE_H - MARGIN_Y * 2;
  const pxPerMm = canvas.width / contentW;
  const sliceH = Math.floor(contentH * pxPerMm);
  const pages: HTMLCanvasElement[] = [];
  for (let y = 0; y < canvas.height; ) {
    // a page ends at the last safe break (the top of a table row, a heading or a block) that still fits, so nothing is cut in half;
    // without one that fits (or when the rest fits on this page) it simply ends where the page is full
    const limit = y + sliceH;
    let end = Math.min(limit, canvas.height);
    if (limit < canvas.height) {
      const fit = breaks.filter((b) => b > y + sliceH * 0.3 && b <= limit);
      if (fit.length > 0) end = fit[fit.length - 1];
    }
    const h = end - y;
    const page = document.createElement('canvas');
    page.width = Math.round(PAGE_W * pxPerMm);
    page.height = Math.round(PAGE_H * pxPerMm);
    const ctx = page.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, Math.round(MARGIN_X * pxPerMm), Math.round(MARGIN_Y * pxPerMm), canvas.width, h);
    pages.push(page);
    y = end;
  }
  return pages;
}

// where it is safe to start a new page, in canvas pixels: before a table row (not the first one under a heading, so a heading
// never ends up alone at the bottom of a page), before a section heading, the totals, the thank-you block
function collectBreaks(node: HTMLElement, canvas: HTMLCanvasElement): number[] {
  const box = node.getBoundingClientRect();
  if (!box.width) return [];
  const ratio = canvas.width / box.width;
  const tops = new Set<number>();
  node.querySelectorAll('tbody tr:not(:first-child), .rd3-cap, .rd3-totals, .rd3-thanks, .rd3-pair, .rd3-notes').forEach((el) => {
    const y = Math.round((el.getBoundingClientRect().top - box.top) * ratio);
    if (y > 0) tops.add(y);
  });
  return [...tops].sort((a, b) => a - b);
}

// a PNG of the document: the first A4 page (a receipt fits on one), or the whole tall image if it runs longer
export async function renderDocumentImage(node: HTMLElement): Promise<Blob> {
  const canvas = await captureDocument(node);
  const pages = composeA4Pages(canvas, collectBreaks(node, canvas));
  const target = pages.length === 1 ? pages[0] : canvas;
  return new Promise<Blob>((resolve, reject) => {
    target.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('image'))), 'image/png');
  });
}

export async function renderReceiptPdf(node: HTMLElement): Promise<{ blob: Blob; pages: string[] }> {
  const [{ default: jsPDF }, canvas] = await Promise.all([import('jspdf'), captureDocument(node)]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages: string[] = [];
  composeA4Pages(canvas, collectBreaks(node, canvas)).forEach((page, n) => {
    const data = page.toDataURL('image/png');
    if (n > 0) pdf.addPage();
    // each image already is a whole A4 page (margins included), so it fills the sheet edge to edge
    pdf.addImage(data, 'PNG', 0, 0, PAGE_W, PAGE_H);
    pages.push(data);
  });
  return { blob: pdf.output('blob'), pages };
}
