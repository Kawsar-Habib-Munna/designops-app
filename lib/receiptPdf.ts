// Turns the on-page ReceiptDocument into an A4 PDF (html2canvas + jsPDF) with real page margins, and also returns the
// page images so the preview can show them where browsers cannot display a PDF inside an iframe (phones/tablets).

const PAGE_W = 210; // A4, mm
const PAGE_H = 297;
const MARGIN_X = 14;
const MARGIN_Y = 16;

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

// one tall PNG of the whole document
export async function renderDocumentImage(node: HTMLElement): Promise<Blob> {
  const canvas = await captureDocument(node);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('image'))), 'image/png');
  });
}

export async function renderReceiptPdf(node: HTMLElement): Promise<{ blob: Blob; pages: string[] }> {
  const [{ default: jsPDF }, canvas] = await Promise.all([import('jspdf'), captureDocument(node)]);

  // fit the document into the printable area (page minus margins) and cut it into one slice per page
  const contentW = PAGE_W - MARGIN_X * 2;
  const contentH = PAGE_H - MARGIN_Y * 2;
  const pxPerMm = canvas.width / contentW;
  const sliceH = Math.floor(contentH * pxPerMm);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages: string[] = [];
  for (let y = 0, n = 0; y < canvas.height; y += sliceH, n++) {
    const h = Math.min(sliceH, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    const data = slice.toDataURL('image/png');
    if (n > 0) pdf.addPage();
    pdf.addImage(data, 'PNG', MARGIN_X, MARGIN_Y, contentW, h / pxPerMm);
    pages.push(data);
  }
  return { blob: pdf.output('blob'), pages };
}
