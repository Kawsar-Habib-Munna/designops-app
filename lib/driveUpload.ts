// Files পেজে বানানো resumable Google Drive আপলোড — এখন Discussions পেজও একই
// লজিক ব্যবহার করে, তাই দুই জায়গায় কোড ডুপ্লিকেট না রেখে এখানে শেয়ার্ড করা হলো।
// dedicated Google অ্যাকাউন্টের সাথে OAuth দিয়ে কানেক্ট করা resumable upload —
// ফাইলের বাইট আমাদের সার্ভার দিয়ে যায় না, ব্রাউজার সরাসরি Google-কে পাঠায়
// (Vercel-এর ৪.৫MB body-size লিমিট এড়াতে), তাই real progress % পাওয়া যায়।

export function guessFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'fig') return 'figma';
  if (ext === 'pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
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
