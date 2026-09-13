import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Google Drive-এর thumbnail/lh3 এন্ডপয়েন্ট ব্রাউজারে <img src> হিসেবে দেখানোর জন্য
// ঠিক আছে, কিন্তু CORS হেডার পাঠায় না — তাই html2canvas দিয়ে PDF জেনারেট করার সময়
// সেই ছবি দিয়ে canvas "tainted" হয়ে যায় (toDataURL() SecurityError ছোঁড়ে)।
// এই রুটটা same-origin প্রক্সি হিসেবে কাজ করে: সার্ভার সাইডে (কোনো CORS নেই)
// ছবিটা fetch করে ব্রাউজারকে ফেরত দেয়, যাতে ক্লায়েন্ট-সাইড fetch() নিরাপদে blob
// পায় আর ক্যানভাস tainted না হয়। ওপেন প্রক্সি এড়াতে শুধু Google-এর নিজস্ব
// ইমেজ হোস্টগুলোতেই allow করা হয়েছে, আর caller-কে লগইন থাকতে হবে।
const ALLOWED_HOSTS = ['drive.google.com', 'lh3.googleusercontent.com'];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });

  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) return Response.json({ error: 'url প্যারামিটার আবশ্যক।' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'অবৈধ url।' }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return Response.json({ error: 'এই হোস্ট থেকে প্রক্সি করা যায় না।' }, { status: 400 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok) return Response.json({ error: 'ছবি লোড করা যায়নি।' }, { status: 502 });

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await upstream.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
