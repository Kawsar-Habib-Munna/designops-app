import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getDriveClient, getUploadFolderId } from '@/lib/googleDrive';

// ধাপ ১: একটা resumable আপলোড সেশন শুরু করে Google-এর কাছে (ছোট JSON রিকোয়েস্ট,
// কোনো ফাইল বাইট এখানে যায় না)। ব্রাউজার এরপর সরাসরি ফেরত পাওয়া uploadUrl-এ
// ফাইলটা PUT করবে — এভাবে Vercel-এর ৪.৫MB সার্ভারলেস body-size লিমিট এড়ানো যায়,
// কারণ আমাদের নিজের সার্ভার কখনো ফাইলের বাইট ছোঁয়ই না।

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });

  const body = await request.json();
  const fileName = (body.fileName ?? '').trim();
  const mimeType = (body.mimeType ?? '').trim() || 'application/octet-stream';
  const fileSize = Number(body.fileSize ?? 0);

  if (!fileName || !fileSize) return Response.json({ error: 'ফাইলের নাম ও সাইজ আবশ্যক।' }, { status: 400 });

  let accessToken: string;
  let folderId: string;
  try {
    const { auth } = getDriveClient();
    const tokenRes = await auth.getAccessToken();
    if (!tokenRes.token) throw new Error('Google access token পাওয়া যায়নি — refresh token চেক করুন।');
    accessToken = tokenRes.token;
    folderId = getUploadFolderId();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Google Drive কনফিগ ভুল আছে।' }, { status: 500 });
  }

  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize),
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    return Response.json({ error: `Drive আপলোড সেশন শুরু করা যায়নি: ${errText.slice(0, 300)}` }, { status: 400 });
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) return Response.json({ error: 'Drive থেকে আপলোড URL পাওয়া যায়নি।' }, { status: 500 });

  return Response.json({ uploadUrl });
}
