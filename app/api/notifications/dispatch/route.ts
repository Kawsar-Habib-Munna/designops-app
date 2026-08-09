import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp';

// Tasks/Discussions পেজ থেকে lib/notify.ts যেটা fire-and-forget কল করে —
// এই রুট service role দিয়ে notifications insert করে (ক্লায়েন্ট থেকে সরাসরি
// insert করলে RETURNING-এর জন্য recipient-এর SELECT RLS policy চেক হয়ে
// actor-এর insert ব্যর্থ হয়ে যেত, তাই insert-টাই এখানে সরানো হয়েছে) এবং
// discussion/vote টাইপের জন্য প্রাপকের টগল অনুযায়ী ইমেইল/WhatsApp পাঠায়।
// task_assigned ইত্যাদি বাদে বাকি টাইপ শুধু in-app ফিডেই থাকে।

type NotificationInput = {
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  link?: string | null;
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
  const inputs: NotificationInput[] = Array.isArray(body.notifications) ? body.notifications : [];
  if (inputs.length === 0) return Response.json({ inserted: 0, sent: [], skipped: [], errors: [] });

  // actor_id ক্লায়েন্ট থেকে যাই আসুক, caller-এর নিজের id দিয়ে ওভাররাইট করা হচ্ছে —
  // কেউ যেন অন্য কারো নামে নোটিফিকেশন না পাঠাতে পারে (spoofing প্রতিরোধ)।
  const rows = inputs
    .filter((n) => n.recipient_id && n.recipient_id !== caller.userId)
    .map((n) => ({
      recipient_id: n.recipient_id,
      actor_id: caller.userId,
      type: n.type,
      title: n.title,
      subtitle: n.subtitle ?? null,
      meta: n.meta ?? null,
      entity_type: n.entity_type ?? null,
      entity_id: n.entity_id ?? null,
      link: n.link ?? null,
    }));
  if (rows.length === 0) return Response.json({ inserted: 0, sent: [], skipped: [], errors: [] });

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('notifications')
    .insert(rows)
    .select('id, recipient_id, actor_id, type, title, subtitle, meta, link');
  if (insertErr || !inserted) {
    return Response.json({ error: insertErr?.message ?? 'নোটিফিকেশন তৈরি করা যায়নি।' }, { status: 500 });
  }

  const results = { sent: [] as string[], skipped: [] as string[], errors: [] as string[] };
  const base = appUrl();

  for (const n of inserted) {
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
        const msg = err instanceof Error ? err.message : 'unknown';
        results.errors.push(`${n.id}:email:${msg}`);
        console.error(`[notifications/dispatch] email failed for notification ${n.id} (recipient ${n.recipient_id}):`, msg);
      }
    }

    if (wantsWhatsapp && profile.whatsapp_number) {
      try {
        await sendWhatsApp(profile.whatsapp_number, plainMessage);
        results.sent.push(`${n.id}:whatsapp`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        results.errors.push(`${n.id}:whatsapp:${msg}`);
        console.error(`[notifications/dispatch] whatsapp failed for notification ${n.id} (recipient ${n.recipient_id}):`, msg);
      }
    }
  }

  return Response.json({ inserted: inserted.length, ...results });
}
