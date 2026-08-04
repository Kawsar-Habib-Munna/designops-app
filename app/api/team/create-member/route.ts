import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// টিম মেম্বার ম্যানুয়ালি তৈরি করার সার্ভার-সাইড এন্ডপয়েন্ট — magic-link (OTP)
// আওয়ারে মাত্র ২টা ইমেইল পাঠাতে পারত, ৯ জনের টিমের জন্য যথেষ্ট ছিল না। এই রুট
// service_role কী দিয়ে auth.admin.createUser() কল করে, তাই কোনো ইমেইলই পাঠায় না —
// রেট-লিমিটের সমস্যা পুরোপুরি এড়ানো যায়।
//
// শুধু is_admin=true প্রোফাইলরাই এই এন্ডপয়েন্ট কল করতে পারবে।

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
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা টিম মেম্বার যোগ করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const email = (body.email ?? '').trim();
  const password = (body.password ?? '').trim();
  const fullName = (body.fullName ?? '').trim();
  const role = (body.role ?? '').trim();
  const makeAdmin = !!body.isAdmin;

  if (!email || !password || !fullName) return Response.json({ error: 'নাম, ইমেইল ও পাসওয়ার্ড আবশ্যক।' }, { status: 400 });
  if (password.length < 8) return Response.json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।' }, { status: 400 });

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return Response.json({ error: createError?.message ?? 'ইউজার তৈরি করা যায়নি।' }, { status: 400 });
  }

  if (role || makeAdmin) {
    const patch: { role?: string; is_admin?: boolean } = {};
    if (role) patch.role = role;
    if (makeAdmin) patch.is_admin = true;
    const { error: profileError } = await supabaseAdmin.from('profiles').update(patch).eq('id', created.user.id);
    if (profileError) return Response.json({ error: `ইউজার তৈরি হয়েছে কিন্তু প্রোফাইল আপডেট করা যায়নি: ${profileError.message}` }, { status: 200 });
  }

  return Response.json({ id: created.user.id });
}
