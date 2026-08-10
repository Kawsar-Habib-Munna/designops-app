// Files পেজে বানানো resumable Google Drive আপলোড — এখন Discussions পেজও একই
// লজিক ব্যবহার করে, তাই দুই জায়গায় কোড ডুপ্লিকেট না রেখে এখানে শেয়ার্ড করা হলো।
// dedicated Google অ্যাকাউন্টের সাথে OAuth দিয়ে কানেক্ট করা resumable upload —
// ফাইলের বাইট আমাদের সার্ভার দিয়ে যায় না, ব্রাউজার সরাসরি Google-কে পাঠায়
// (Vercel-এর ৪.৫MB body-size লিমিট এড়াতে), তাই real progress % পাওয়া যায়।

// আপলোড করা ফাইলের drive_url আসলে Google-এর "webViewLink" (viewer পেজ, কাঁচা
// ইমেজ ডেটা না) — তাই ছবি সরাসরি <img>-এ দেখাতে লিংক থেকে Drive file id বের করে
// thumbnail এন্ডপয়েন্টে কনভার্ট করা হয়। আপলোডের সময় ফাইলে "anyone: reader"
// পারমিশন দেওয়া হয় (দেখুন app/api/drive-upload/finalize), তাই এই এন্ডপয়েন্ট
// লগইন ছাড়াই কাজ করে। Drive না হওয়া সরাসরি ইমেজ লিংক অপরিবর্তিত থাকে।
function driveFileId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
export function driveThumbnailUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : url;
}

// ভিডিও প্লে করার জন্য Drive-এর "preview" এন্ডপয়েন্ট — একটা <iframe>-এ বসালে
// নিজস্ব প্লেয়ার (play/pause/fullscreen) দেখায়, লগইন ছাড়াই কাজ করে যেহেতু
// আপলোডের সময় ফাইলে "anyone: reader" পারমিশন দেওয়া হয়। Drive না হওয়া লিংকের
// জন্য (পেস্ট করা YouTube/external ভিডিও লিংক) কাজ করবে না — সেগুলো plain
// লিংক হিসেবেই দেখানো উচিত।
export function driveEmbedUrl(url: string): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

// Drive-এর thumbnail এন্ডপয়েন্ট ইমেজের পাশাপাশি ভিডিও আর PDF-এরও একটা স্ট্যাটিক
// প্রিভিউ জেনারেট করে দেয়, কিন্তু শুধু Drive-এ হোস্ট করা ফাইলের জন্যই — পেস্ট করা
// কোনো বহিরাগত (non-Drive) ভিডিও/PDF লিংকের জন্য এই এন্ডপয়েন্ট কাজ করবে না।
// সরাসরি ইমেজ লিংক ব্যতিক্রম, কারণ raw ইমেজ URL এমনিতেই <img src>-এ কাজ করে।
export function canPreviewInline(fileType: string | null, url: string): boolean {
  if (fileType === 'image') return true;
  if (fileType === 'video' || fileType === 'pdf') return driveFileId(url) !== null;
  return false;
}

export function guessFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'fig') return 'figma';
  if (ext === 'pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'zip';
  return 'other';
}

export async function uploadFileToDrive(
  file: File,
  accessToken: string,
  onProgress?: (pct: number) => void
): Promise<{ id: string; webViewLink: string; name?: string }> {
  const initRes = await fetch('/api/drive-upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.error ?? 'আপলোড সেশন শুরু করা যায়নি।');
  const uploadUrl: string = initData.uploadUrl;

  // ব্রাউজারের XHR PUT-এর নিজের রেসপন্স বিশ্বাস করা হয় না — CORS-এর কারণে Google
  // আসলে ফাইল সফলভাবে সেভ করলেও ব্রাউজার মাঝে মাঝে সেই রেসপন্স পড়তে না পেরে
  // "network error" দেখায়। তাই এখানে শুধু প্রোগ্রেস ট্র্যাক করা হয়; PUT শেষ হওয়ার
  // পর (সফল হোক বা এরর দেখাক) সবসময় সার্ভারকে দিয়ে আসল অবস্থা যাচাই করানো হয়
  // (নিচের finalize কল) — সেটাই এখানে ভরসাযোগ্য সোর্স অফ ট্রুথ।
  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve();
    xhr.onerror = () => resolve();
    xhr.send(file);
  });

  const finalizeRes = await fetch('/api/drive-upload/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ uploadUrl }),
  });
  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok) throw new Error(finalizeData.error ?? 'আপলোড সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।');

  onProgress?.(100);
  return { id: finalizeData.id, webViewLink: finalizeData.webViewLink, name: finalizeData.name };
}
