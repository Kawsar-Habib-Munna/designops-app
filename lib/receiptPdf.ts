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
function composeA4Pages(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const contentW = PAGE_W - MARGIN_X * 2;
  const contentH = PAGE_H - MARGIN_Y * 2;
  const pxPerMm = canvas.width / contentW;
  const sliceH = Math.floor(contentH * pxPerMm);
  const pages: HTMLCanvasElement[] = [];
  for (let y = 0; y < canvas.height; y += sliceH) {
    const h = Math.min(sliceH, canvas.height - y);
    const page = document.createElement('canvas');
    page.width = Math.round(PAGE_W * pxPerMm);
    page.height = Math.round(PAGE_H * pxPerMm);
    const ctx = page.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, Math.round(MARGIN_X * pxPerMm), Math.round(MARGIN_Y * pxPerMm), canvas.width, h);
    pages.push(page);
  }
  return pages;
}

// a PNG of the document: the first A4 page (a receipt fits on one), or the whole tall image if it runs longer
export async function renderDocumentImage(node: HTMLElement): Promise<Blob> {
  const canvas = await captureDocument(node);
  const pages = composeA4Pages(canvas);
  const target = pages.length === 1 ? pages[0] : canvas;
  return new Promise<Blob>((resolve, reject) => {
    target.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('image'))), 'image/png');
  });
}

export async function renderReceiptPdf(node: HTMLElement): Promise<{ blob: Blob; pages: string[] }> {
  const [{ default: jsPDF }, canvas] = await Promise.all([import('jspdf'), captureDocument(node)]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages: string[] = [];
  composeA4Pages(canvas).forEach((page, n) => {
    const data = page.toDataURL('image/png');
    if (n > 0) pdf.addPage();
    // each image already is a whole A4 page (margins included), so it fills the sheet edge to edge
    pdf.addImage(data, 'PNG', 0, 0, PAGE_W, PAGE_H);
    pages.push(data);
  });
  return { blob: pdf.output('blob'), pages };
}
