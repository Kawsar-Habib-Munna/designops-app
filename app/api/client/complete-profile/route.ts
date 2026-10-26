import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Google OAuth দিয়ে প্রথমবার সাইন-ইন করা client-এর জন্য /client/complete-profile
// ফর্ম এখানে পোস্ট করে — app/api/client/register-এর মতোই clients রো বানায়, তবে
// নতুন auth user তৈরি করে না (OAuth-এই সেটা হয়ে গেছে), শুধু বর্তমান bearer
// token-এর ইউজারের জন্য clients রো লেখে।

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

  const { data: existing } = await supabaseAdmin.from('clients').select('id').eq('user_id', user.id).maybeSingle();
  if (existing) return Response.json({ id: existing.id });

  const body = await request.json();
  const fullName = (body.fullName ?? '').trim();
  const companyName = (body.companyName ?? '').trim();
  const phone = (body.phone ?? '').trim();

  if (!fullName || !companyName) {
    return Response.json({ error: 'নাম ও কোম্পানির নাম আবশ্যক।' }, { status: 400 });
  }

  const { data: clientRow, error: clientError } = await supabaseAdmin
    .from('clients')
    .insert({
      user_id: user.id,
      company_name: companyName,
      primary_contact: fullName,
      contact_email: user.email ?? null,
      contact_phone: phone || null,
      status: 'lead',
    })
    .select('id')
    .single();

  if (clientError || !clientRow) {
    return Response.json({ error: `অ্যাকাউন্ট তৈরি করা যায়নি: ${clientError?.message ?? 'unknown error'}` }, { status: 500 });
  }

  await supabaseAdmin.from('activity_log').insert({
    actor_id: null,
    action: 'client_registered',
    entity_type: 'client',
    entity_id: clientRow.id,
    detail: `${companyName} Google দিয়ে ক্লায়েন্ট পোর্টালের মাধ্যমে রেজিস্টার করেছে`,
  });

  return Response.json({ id: clientRow.id });
}
