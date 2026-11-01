import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';

// The member details panel on the Team page: a team member's sign-in email and WhatsApp number. The email lives in the
// authentication system, not in the profiles table, so it can only be read with the service role. Any signed-in team
// member may look it up (the same people already see each other on the Team page); clients cannot, since they have
// no profile.

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'You are not signed in.' }, { status: 401 });

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server is not configured.' }, { status: 500 });
  }
  const caller = await getCallerProfile(admin, token);
  if (!caller) return Response.json({ error: 'Your session could not be verified. Please sign in again.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) return Response.json({ error: 'A member is needed.' }, { status: 400 });

  // only people who really are team members (have a profile) are looked up
  const { data: profile } = await admin.from('profiles').select('id, whatsapp_number').eq('id', userId).maybeSingle();
  if (!profile) return Response.json({ error: 'Member not found.' }, { status: 404 });

  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ email: userData.user?.email ?? null, whatsapp: profile.whatsapp_number ?? null });
}
