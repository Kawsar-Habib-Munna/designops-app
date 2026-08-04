import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getDriveClient } from '@/lib/googleDrive';

// ধাপ ৩: ব্রাউজারের XHR PUT শেষ হওয়ার পর (সফল হোক বা ব্রাউজার এরর দেখাক) এই রুট
// কল হয় — কিন্তু ব্রাউজারের নিজের PUT রেসপন্স বিশ্বাস করা হয় না, কারণ CORS-এর কারণে
// অনেক সময় Google আসলে ফাইল ঠিকঠাক সেভ করে ফেললেও ব্রাউজার সেই রেসপন্সটা পড়তে না
// পেরে "network error" দেখায় (আপলোড আসলে সফল, শুধু ব্রাউজার সেটা জানতে পারেনি)।
//
// তাই সার্ভার নিজে থেকে সেই resumable session URI-তে একটা status-check রিকোয়েস্ট
// পাঠায় (Content-Range: bytes */* সহ empty PUT) — এটা CORS-এর আওতায় পড়ে না যেহেতু
// সার্ভার-টু-সার্ভার কল, তাই এটাই আসল সত্য জানার নির্ভরযোগ্য উপায়।

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });

  const body = await request.json();
  const uploadUrl = (body.uploadUrl ?? '').trim();
  if (!uploadUrl) return Response.json({ error: 'uploadUrl আবশ্যক।' }, { status: 400 });

  let fileId: string;
  let webViewLink: string;
  let fileName: string | undefined;

  try {
    const statusRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': 'bytes */*' },
    });

    if (statusRes.status === 200 || statusRes.status === 201) {
      const fileData = await statusRes.json();
      fileId = fileData.id;
      webViewLink = fileData.webViewLink;
      fileName = fileData.name;
    } else if (statusRes.status === 308) {
      return Response.json({ error: 'আপলোড এখনো সম্পূর্ণ হয়নি — আবার চেষ্টা করুন।' }, { status: 400 });
    } else {
      const errText = await statusRes.text();
      return Response.json({ error: `Drive স্ট্যাটাস চেক ব্যর্থ হয়েছে: ${errText.slice(0, 300)}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Drive-এর সাথে যোগাযোগ করা যায়নি।' }, { status: 500 });
  }

  try {
    const { drive } = getDriveClient();
    await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'শেয়ারিং সেট করা যায়নি।' }, { status: 500 });
  }

  return Response.json({ id: fileId, webViewLink, name: fileName });
}
