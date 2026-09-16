import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPushToUser } from '@/lib/webPush';

// ডিবাগিং টুল — caller নিজের subscription-এ একটা টেস্ট পুশ পাঠায়, আর real
// sent/removed কাউন্ট (বা এরর) সরাসরি রেসপন্সে ফেরত দেয়। dispatch route-এর
// fire-and-forget ফ্লোতে এই তথ্য কখনো ক্লায়েন্টে ফেরত আসে না (সার্ভার লগেই
// থেকে যায়) — তাই push আসলে কোথায় আটকাচ্ছে সেটা ব্রাউজার থেকেই যাচাই করা যায়।

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });

  const { count } = await supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id);

  try {
    const result = await sendPushToUser(data.user.id, {
      title: 'টেস্ট নোটিফিকেশন',
      body: 'এটা একটা টেস্ট — এটা দেখলে পুশ ঠিকভাবে কাজ করছে।',
      link: '/notifications',
    });
    return Response.json({ subscriptionCount: count ?? 0, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return Response.json({ subscriptionCount: count ?? 0, error: msg }, { status: 500 });
  }
}
