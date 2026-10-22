import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// /portfolio-এর "টিম কার্ডের অর্ডার" সেকশনের up/down বাটন - profiles-এর RLS
// update policy শুধু auth.uid() = id (নিজেরটাই) মানে, তাই ক্লায়েন্ট সাইড থেকে
// সরাসরি supabase.from('profiles').update() কল করলে অন্য মেম্বারের
// order_index আপডেট RLS-এ চুপচাপ ব্লক হয়ে যায় (কোনো error ছাড়াই 0 রো
// আপডেট হয়) - UI optimistically বদলে যায় কিন্তু রিলোড করলে আগের অর্ডারে
// ফিরে আসে। update-profile রুটের মতোই service-role দিয়ে বাইপাস করা হলো।

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'সার্ভার কনফিগ ভুল আছে।' }, { status: 500 });
  }

  const caller = await getCallerProfile(supabaseAdmin, token);
  if (!caller) return Response.json({ error: 'সেশন যাচাই করা যায়নি — আবার লগইন করুন।' }, { status: 401 });
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা টিম কার্ডের অর্ডার পরিবর্তন করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) return Response.json({ error: 'কোনো আপডেট দেওয়া হয়নি।' }, { status: 400 });

  for (const u of updates) {
    if (!u || typeof u.id !== 'string' || typeof u.order_index !== 'number') {
      return Response.json({ error: 'ভুল ফরম্যাটে অর্ডার ডেটা পাঠানো হয়েছে।' }, { status: 400 });
    }
  }

  const results = await Promise.all(
    updates.map((u: { id: string; order_index: number }) => supabaseAdmin.from('profiles').update({ order_index: u.order_index }).eq('id', u.id)),
  );
  const firstError = results.find((r) => r.error);
  if (firstError?.error) return Response.json({ error: firstError.error.message }, { status: 400 });

  return Response.json({ ok: true });
}
