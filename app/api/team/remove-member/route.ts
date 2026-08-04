import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// টিম মেম্বার রিমুভ করে (auth.users থেকে ডিলিট) — শুধু is_admin=true প্রোফাইলরা
// কল করতে পারবে। প্রোফাইল রো cascade-এ ডিলিট হয়ে যায় (profiles.id references
// auth.users on delete cascade); মেম্বারের করা টাস্ক/কমেন্ট/অ্যাক্টিভিটি মুছে
// যায় না — schema.sql-এ সেই ফরেন কী-গুলো "on delete set null" করা আছে বলে
// এগুলো শুধু "আনঅ্যাসাইনড" হয়ে যায়।

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
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা টিম মেম্বার রিমুভ করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const userId = (body.userId ?? '').trim();
  if (!userId) return Response.json({ error: 'কোন মেম্বার রিমুভ করবেন তা দেওয়া হয়নি।' }, { status: 400 });
  if (userId === caller.userId) return Response.json({ error: 'নিজেকে রিমুভ করা যাবে না।' }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
