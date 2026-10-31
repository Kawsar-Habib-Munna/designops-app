'use client';

// A person's profile picture. Profile pictures are stored as Google Drive links (the "view" page, not the image itself),
// so the address is converted to Drive's thumbnail address first. If the picture cannot be loaded, the person's initial
// is shown instead of a broken-image icon.
import { useState } from 'react';
import { driveThumbnailUrl } from '@/lib/driveUpload';

export default function AvatarImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{(name || '?').charAt(0).toUpperCase()}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={driveThumbnailUrl(src)} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
