import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// আগে থেকে থাকা কোনো মেম্বারকে এডমিন বানানো/এডমিন থেকে বাদ দেওয়া — শুধু
// is_admin=true প্রোফাইলরা কল করতে পারবে। শেষ এডমিনকে ডিমোট করতে দেওয়া হয় না,
// নাহলে পুরো টিম এডমিন ফিচার থেকে লক-আউট হয়ে যেতে পারে।

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
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা এডমিন স্ট্যাটাস পরিবর্তন করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const userId = (body.userId ?? '').trim();
  const isAdmin = !!body.isAdmin;
  if (!userId) return Response.json({ error: 'কোন মেম্বারের কথা বলা হচ্ছে তা দেওয়া হয়নি।' }, { status: 400 });

  if (!isAdmin) {
    const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true);
    const { data: target } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).single();
    if (target?.is_admin && (count ?? 0) <= 1) {
      return Response.json({ error: 'শেষ এডমিনকে ডিমোট করা যাবে না — আগে অন্য কাউকে এডমিন বানান।' }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.from('profiles').update({ is_admin: isAdmin }).eq('id', userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
