import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// সোশ্যাল শেয়ার প্রিভিউ (WhatsApp/LinkedIn/Facebook/X) — সাদা ব্যাকগ্রাউন্ডে নতুন লোগো।
export const alt = 'FLOW 53 — UI/UX Design & Development Agency';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public', 'New Logo.png'));
  const src = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={880} height={210} />
        <div style={{ marginTop: 56, fontSize: 40, color: '#4b4558' }}>UI/UX Design &amp; Development Agency</div>
      </div>
    ),
    { ...size },
  );
}
