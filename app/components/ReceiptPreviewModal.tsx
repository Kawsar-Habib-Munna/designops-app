'use client';

// Full-screen receipt preview. The receipt is the real ReceiptDocument page (plain HTML tables), not a screenshot: "Download"
// opens the browser's own print dialog showing only the receipt, and "Save as PDF" there makes the file. The browser draws
// the text itself, so the PDF matches the preview exactly. Used by the team's and the client's payments pages.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReceiptDocument, { type ReceiptDocData } from './ReceiptDocument';
import './receipt-preview-modal.css';

const PRINTING = 'rpm-printing';

export default function ReceiptPreviewModal({ title, subtitle, data, onClose }: { title: string; subtitle?: string; data: ReceiptDocData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function download() {
    const root = document.documentElement;
    const oldTitle = document.title;
    const done = () => {
      root.classList.remove(PRINTING);
      document.title = oldTitle;
      window.removeEventListener('afterprint', done);
    };
    root.classList.add(PRINTING);
    document.title = title.replace(/\.pdf$/i, ''); // becomes the suggested file name
    window.addEventListener('afterprint', done);
    window.print();
  }

  return createPortal(
    <div className="rpm-portal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rpm-box">
        <header className="rpm-head">
          <div className="rpm-who">
            <div className="rpm-title">{title}</div>
            {subtitle && <div className="rpm-sub">{subtitle}</div>}
          </div>
          <button type="button" className="rpm-btn" onClick={download}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /></svg>
            Print
          </button>
          <button type="button" className="rpm-btn" onClick={download}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
            Download
          </button>
          <button type="button" className="rpm-btn rpm-close" aria-label="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="rpm-body">
          <div className="rpm-sheet">
            <ReceiptDocument data={data} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
