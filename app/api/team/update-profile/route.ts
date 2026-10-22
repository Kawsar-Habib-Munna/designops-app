import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// Team পেজে এডমিন যেকোনো মেম্বারের প্রোফাইল (নাম/রোল/বায়ো/সোশ্যাল লিংক) এডিট
// করতে পারে - আগে শুধু ProfileMenu থেকে প্রত্যেকে নিজেরটাই এডিট করতে পারত
// (profiles-এর RLS update policy auth.uid() = id-তে বাঁধা)। set-admin/
// remove-member যেভাবে service-role দিয়ে RLS বাইপাস করে, এটাও সেভাবেই।

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
  if (!caller.isAdmin) return Response.json({ error: 'শুধু এডমিনরা অন্য মেম্বারের প্রোফাইল এডিট করতে পারবে।' }, { status: 403 });

  const body = await request.json();
  const userId = (body.userId ?? '').trim();
  if (!userId) return Response.json({ error: 'কোন মেম্বারের কথা বলা হচ্ছে তা দেওয়া হয়নি।' }, { status: 400 });

  const fullName = (body.full_name ?? '').trim();
  if (!fullName) return Response.json({ error: 'নাম খালি রাখা যাবে না।' }, { status: 400 });

  const trimOrNull = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || null;
  };

  // avatar_url আলাদা - ছবি আপলোড (Drive-এ) ক্লায়েন্ট সাইডে অ্যাডমিনের নিজের
  // সেশন টোকেন দিয়ে হয় (uploadFileToDrive, ProfileMenu যেভাবে করে), এই রুটে
  // শুধু ফলাফল লিংকটা সেভ হয় - তাই undefined হলে কলামটা স্পর্শ করা হয় না।
  const updates: Record<string, string | null> = {
    full_name: fullName,
    role: trimOrNull(body.role),
    bio: trimOrNull(body.bio),
    behance_url: trimOrNull(body.behance_url),
    linkedin_url: trimOrNull(body.linkedin_url),
    facebook_url: trimOrNull(body.facebook_url),
    instagram_url: trimOrNull(body.instagram_url),
  };
  if (typeof body.avatar_url === 'string' && body.avatar_url.trim()) updates.avatar_url = body.avatar_url.trim();

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, full_name, role, bio, avatar_color, avatar_url, behance_url, linkedin_url, facebook_url, instagram_url, is_admin')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ profile: data });
}
