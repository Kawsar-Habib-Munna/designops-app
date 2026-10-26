import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Google OAuth দিয়ে client portal-এ সাইন-ইন করার পর /client/auth/callback এখানে
// পোস্ট করে। handle_new_user() ট্রিগার (sql/schema.sql) account_type মেটাডেটা
// না পেলে ডিফল্ট 'team' ধরে profiles রো বানিয়ে দেয় — OAuth দিয়ে সাইন-আপের সময়
// Google প্রোফাইল ডেটা ছাড়া কাস্টম মেটাডেটা পাঠানো যায় না, তাই প্রথমবার
// Google দিয়ে সাইন-ইন করা client-দের জন্য এই ভুল 'team' profiles রো সবসময়
// তৈরি হয়ে যায়। এখানে সেটা সাবধানে ক্লিনআপ করা হয়: শুধু তখনই মোছা হয় যখন
// last_sign_in_at ≈ created_at (অর্থাৎ এটাই এই ইউজারের প্রথম সাইন-ইন) — তাই
// আগে থেকে existing কোনো real টিম মেম্বার ভুলে client Google sign-in ব্যবহার
// করলে তার profiles রো কখনো ছোঁয়া হয় না, বরং client পোর্টাল অ্যাক্সেস ব্লক
// করে দেওয়া হয়।
const FIRST_SIGN_IN_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'সার্ভার কনফিগ ভুল আছে।' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = userData.user;

  const { data: clientRow } = await supabaseAdmin.from('clients').select('id').eq('user_id', user.id).maybeSingle();
  if (clientRow) {
    return Response.json({ hasClient: true });
  }

  const { data: profileRow } = await supabaseAdmin.from('profiles').select('id, account_type').eq('id', user.id).maybeSingle();
  if (!profileRow) {
    // কোনো profiles রো-ই নেই — সরাসরি প্রোফাইল-সম্পূর্ণ করার ধাপে পাঠানো নিরাপদ।
    return Response.json({ hasClient: false });
  }

  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : createdAt;
  const isFirstEverSignIn = Math.abs(lastSignInAt - createdAt) < FIRST_SIGN_IN_WINDOW_MS;

  if (!isFirstEverSignIn) {
    // এই Google অ্যাকাউন্ট আগে থেকেই সাইন-ইন করেছে এবং তার একটা profiles রো
    // আছে মানে এটা আসল টিম মেম্বার অ্যাকাউন্ট — client পোর্টালে ঢুকতে দেওয়া
    // যাবে না।
    return Response.json({ blocked: true });
  }

  // প্রথমবার সাইন-ইন + trigger-তৈরি ভুল 'team' profiles রো — পরিষ্কার করে
  // client হিসেবে এগিয়ে যাওয়া হলো।
  await supabaseAdmin.from('profiles').delete().eq('id', user.id);
  return Response.json({ hasClient: false });
}
