import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Screen 3 — Client Registration-এর সার্ভার-সাইড এন্ডপয়েন্ট। team/create-member-এর
// মতোই service_role দিয়ে auth.admin.createUser() কল করে email_confirm:true সহ —
// তাই কোনো কনফার্মেশন ইমেইল পাঠায় না (Supabase ফ্রি টায়ারের ঘণ্টায় ২টা ইমেইলের
// লিমিট ক্লায়েন্ট সেলফ-রেজিস্ট্রেশনে সমস্যা করবে না)। user_metadata-তে
// account_type:'client' সেট করা থাকে বলে handle_new_user() ট্রিগার profiles-এ
// কোনো রো তৈরি করে না (দেখুন sql/schema.sql-এর ফেজ ১) — ক্লায়েন্ট অ্যাকাউন্ট
// টিমের কোনো profiles-নির্ভর কোয়েরিতে কখনো দেখা যাবে না। clients রো এখানেই
// একই রিকোয়েস্টে তৈরি হয়, যাতে auth user আর clients রেকর্ড সবসময় সিঙ্কে থাকে।

export async function POST(request: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'সার্ভার কনফিগ ভুল আছে।' }, { status: 500 });
  }

  const body = await request.json();
  const fullName = (body.fullName ?? '').trim();
  const companyName = (body.companyName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const phone = (body.phone ?? '').trim();
  const password = (body.password ?? '').trim();

  if (!fullName || !companyName || !email || !password) {
    return Response.json({ error: 'নাম, কোম্পানির নাম, ইমেইল ও পাসওয়ার্ড আবশ্যক।' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।' }, { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: 'client', full_name: fullName },
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? '';
    const friendly = /already.*registered|already exists/i.test(msg) ? 'এই ইমেইলে আগে থেকেই একটা অ্যাকাউন্ট আছে — সাইন-ইন করুন।' : msg || 'অ্যাকাউন্ট তৈরি করা যায়নি।';
    return Response.json({ error: friendly }, { status: 400 });
  }

  const { error: clientError } = await supabaseAdmin.from('clients').insert({
    user_id: created.user.id,
    company_name: companyName,
    primary_contact: fullName,
    contact_email: email,
    contact_phone: phone || null,
    status: 'lead',
  });

  if (clientError) {
    // auth user তৈরি হয়ে গেছে কিন্তু clients রো লেখা যায়নি — অসম্পূর্ণ অ্যাকাউন্ট
    // রেখে না দিয়ে auth user মুছে ফেলা হলো, যাতে ইউজার আবার একই ইমেইল দিয়ে
    // পরিষ্কারভাবে আরেকবার রেজিস্টার করতে পারে।
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return Response.json({ error: `অ্যাকাউন্ট তৈরি করা যায়নি: ${clientError.message}` }, { status: 500 });
  }

  return Response.json({ id: created.user.id });
}
