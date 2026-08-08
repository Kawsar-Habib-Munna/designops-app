import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp';

// discussion/vote নোটিফিকেশন তৈরি হওয়ার পর ক্লায়েন্ট থেকে fire-and-forget
// কল করা হয় — এই রুট প্রতিটা নোটিফিকেশনের প্রাপকের প্রোফাইল দেখে (তাদের
// email/WhatsApp টগল আর whatsapp_number অনুযায়ী) বাইরের চ্যানেলে পাঠায়।
// task_assigned/discussion বাদে অন্য টাইপ (এখনো) এখানে হ্যান্ডেল হয় না —
// শুধু discussion_* আর vote_* টাইপই আসলে ইমেইল/WhatsApp পাঠায়, বাকিগুলো
// শুধু in-app ফিডেই থাকে (ব্যবহারকারীর সুনির্দিষ্ট অনুরোধ অনুযায়ী)।

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  link: string | null;
};

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return '';
}

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

  const body = await request.json();
  const notificationIds: string[] = Array.isArray(body.notificationIds) ? body.notificationIds : [];
  if (notificationIds.length === 0) return Response.json({ sent: [], skipped: [], errors: [] });

  const { data: rows } = await supabaseAdmin
    .from('notifications')
    .select('id, recipient_id, actor_id, type, title, subtitle, meta, link')
    .in('id', notificationIds);

  const results = { sent: [] as string[], skipped: [] as string[], errors: [] as string[] };
  const base = appUrl();

  for (const n of (rows as NotificationRow[]) ?? []) {
    const isDiscussion = n.type.startsWith('discussion');
    const isVote = n.type.startsWith('vote');
    if (!isDiscussion && !isVote) { results.skipped.push(n.id); continue; }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('whatsapp_number, notify_email_discussions, notify_email_votes, notify_whatsapp_discussions, notify_whatsapp_votes')
      .eq('id', n.recipient_id)
      .single();
    if (!profile) { results.skipped.push(n.id); continue; }

    const wantsEmail = isDiscussion ? profile.notify_email_discussions : profile.notify_email_votes;
    const wantsWhatsapp = (isDiscussion ? profile.notify_whatsapp_discussions : profile.notify_whatsapp_votes) && !!profile.whatsapp_number;

    const link = n.link ? `${base}${n.link}` : base;
    const plainMessage = `${n.title}${n.subtitle ? `\n${n.subtitle}` : ''}${n.meta ? `\n${n.meta}` : ''}${link ? `\n${link}` : ''}`;

    if (wantsEmail) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(n.recipient_id);
        const to = userData.user?.email;
        if (to) {
          await sendEmail(
            to,
            n.title,
            `<div style="font-family:sans-serif;font-size:14px;color:#14141A;">
              <p style="font-size:16px;font-weight:600;margin:0 0 6px;">${n.title}</p>
              ${n.subtitle ? `<p style="margin:0 0 4px;color:#333;">${n.subtitle}</p>` : ''}
              ${n.meta ? `<p style="margin:0 0 12px;color:#6E6E7A;font-size:12px;">${n.meta}</p>` : ''}
              ${link ? `<p style="margin-top:16px;"><a href="${link}" style="background:#5B4FE8;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;display:inline-block;">DesignOps-এ দেখুন</a></p>` : ''}
            </div>`
          );
          results.sent.push(`${n.id}:email`);
        }
      } catch (err) {
        results.errors.push(`${n.id}:email:${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (wantsWhatsapp && profile.whatsapp_number) {
      try {
        await sendWhatsApp(profile.whatsapp_number, plainMessage);
        results.sent.push(`${n.id}:whatsapp`);
      } catch (err) {
        results.errors.push(`${n.id}:whatsapp:${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }

  return Response.json(results);
}
