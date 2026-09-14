import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// ব্রাউজারের PushManager.subscribe()-এর রেজাল্ট (endpoint + keys) এখানে সেভ হয়
// (service role দিয়ে — ক্লায়েন্ট থেকে সরাসরি insert-ও RLS দিয়ে কাজ করত, কিন্তু
// অন্য সব notification-সংক্রান্ত রুটের মতো bearer-token যাচাই এখানেও একই প্যাটার্নে
// রাখা হলো)। DELETE দিয়ে একটা নির্দিষ্ট endpoint-এর subscription মোছা যায় (toggle off)।

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabaseAdmin, userId: data.user.id };
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const body = await request.json();
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const authKey = typeof body.keys?.auth === 'string' ? body.keys.auth : '';
  if (!endpoint || !p256dh || !authKey) return Response.json({ error: 'অবৈধ subscription ডেটা।' }, { status: 400 });

  const { error } = await auth.supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_id: auth.userId, endpoint, p256dh, auth: authKey }, { onConflict: 'endpoint' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return Response.json({ error: 'endpoint আবশ্যক।' }, { status: 400 });

  const { error } = await auth.supabaseAdmin.from('push_subscriptions').delete().eq('user_id', auth.userId).eq('endpoint', endpoint);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
