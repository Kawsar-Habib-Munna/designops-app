import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getDriveClient } from '@/lib/googleDrive';

// ধাপ ৩: ব্রাউজার সরাসরি Google-এ ফাইল PUT করে ফেলার পর, শেয়ারিং পারমিশন খোলার
// জন্য এই ছোট্ট কলটা লাগে (এটার জন্য আমাদের OAuth অথরাইজেশন লাগে, ব্রাউজারের নেই)।

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });

  const body = await request.json();
  const fileId = (body.fileId ?? '').trim();
  if (!fileId) return Response.json({ error: 'fileId আবশ্যক।' }, { status: 400 });

  try {
    const { drive } = getDriveClient();
    await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'শেয়ারিং সেট করা যায়নি।' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
