'use client';

// A client's profile picture: the photo from their Google account when we have one, otherwise their initial. If the photo
// cannot be loaded (the link expired, or the network is blocked) the initial is shown rather than a broken-image icon.
import { useState } from 'react';

export default function ClientAvatar({ src, name }: { src?: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = (name || '?').charAt(0).toUpperCase();
  if (!src || failedSrc === src) return <>{initial}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="client-avatar-img" src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
