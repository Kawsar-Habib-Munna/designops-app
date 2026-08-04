import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// আগে থেকে থাকা (magic-link দিয়ে সাইন-আপ করা) মেম্বারদের পাসওয়ার্ড সেট করতে বা
// কারো পাসওয়ার্ড রিসেট করতে ব্যবহার হয় — শুধু is_admin=true প্রোফাইলরা এটা কল
// করতে পারবে। নিজের পাসওয়ার্ড নিজে বদলানো (ProfileMenu) এই রুট দিয়ে যায় না,
// সরাসরি supabase.auth.updateUser() ব্যবহার করে, তাই সবার জন্য খোলা থাকে।

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
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা অন্যের পাসওয়ার্ড রিসেট করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const userId = (body.userId ?? '').trim();
  const password = (body.password ?? '').trim();

  if (!userId || !password) return Response.json({ error: 'ইউজার ও নতুন পাসওয়ার্ড আবশ্যক।' }, { status: 400 });
  if (password.length < 8) return Response.json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।' }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
