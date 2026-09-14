'use client';

// একবার বানানো, শেয়ার্ড attachment/media preview মডাল — Google Drive-হোস্ট করা
// ফাইলে ক্লিক করলে আগে একটা নতুন ব্রাউজার ট্যাবে খুলত, এখন এই ইন-অ্যাপ মডালে
// দেখায় (dark overlay, filename + Download + close — Google-এর নিজস্ব ফাইল
// ভিউয়ারের ধাঁচে)। যেকোনো পেজ থেকে import করে ব্যবহার করা যায় — নিজের CSS
// এখানেই বান্ডলড, তাই কোনো host page-এর scoped stylesheet-এর উপর নির্ভর করে না।

import './MediaPreviewModal.css';
import { driveFullImageUrl, driveEmbedUrl, driveDownloadUrl, canPreviewInline } from '@/lib/driveUpload';

export type MediaPreviewItem = { name: string; url: string; fileType: string | null };

function DownloadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function MediaPreviewModal({ item, onClose }: { item: MediaPreviewItem | null; onClose: () => void }) {
  if (!item) return null;

  const isImage = item.fileType === 'image';
  const isPreviewable = canPreviewInline(item.fileType, item.url);
  const embedUrl = !isImage && isPreviewable ? driveEmbedUrl(item.url) : null;
  const downloadHref = driveDownloadUrl(item.url);

  return (
    <div className="mpm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mpm-box">
        <div className="mpm-head">
          <div className="mpm-title" title={item.name}>{item.name}</div>
          <div className="mpm-actions">
            <a className="mpm-download" href={downloadHref} target="_blank" rel="noopener noreferrer">
              <DownloadIcon /> Download
            </a>
            <button type="button" className="mpm-close" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="mpm-body">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mpm-image" src={driveFullImageUrl(item.url)} alt={item.name} />
          ) : embedUrl ? (
            <iframe src={embedUrl} className="mpm-frame" title={item.name} />
          ) : (
            <div className="mpm-fallback">এই ফাইলের ইন-অ্যাপ প্রিভিউ নেই — ডাউনলোড করে দেখুন।</div>
          )}
        </div>
      </div>
    </div>
  );
}
