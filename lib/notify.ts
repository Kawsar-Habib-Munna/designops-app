'use client';

// Tasks/Discussions পেজ থেকে ব্যবহৃত হেল্পার — /api/notifications/dispatch-কে
// raw নোটিফিকেশন ডেটা পাঠায় (fire-and-forget), যেটা service-role দিয়ে insert
// করে তারপর discussion/vote টাইপের জন্য ইমেইল/WhatsApp পাঠায়।
//
// নোট: এখানে ক্লায়েন্ট থেকে সরাসরি `notifications` টেবিলে insert করা হয় না —
// কারণ recipient আর actor আলাদা মানুষ হওয়ায়, insert().select() করলে Postgres
// RETURNING clause-এর জন্য recipient-এর SELECT RLS policy (recipient_id =
// auth.uid()) চেক করে, আর actor সেটা পাস করতে পারে না (সে recipient না) —
// ফলে পুরো insert-ই "new row violates row-level security policy" এরর দিয়ে
// ব্যর্থ হয়ে যেত, যদিও INSERT policy নিজে ঠিকই ছিল। তাই insert-টা সার্ভার
// রুটে সরিয়ে service role দিয়ে করা হচ্ছে (RLS পুরোপুরি বাইপাস করে)।
import { supabase } from './supabaseClient';

export type NotificationType = 'task_assigned' | 'discussion_created' | 'discussion_mention' | 'discussion_reply' | 'vote_created' | 'todo_assigned';

export type NotificationInput = {
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  link?: string | null;
};

export async function sendNotifications(inputs: NotificationInput[]) {
  const rows = inputs.filter((n) => n.recipient_id && n.recipient_id !== n.actor_id);
  if (rows.length === 0) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ notifications: rows }),
    }).catch(() => {});
  } catch {
    // notification dispatch ব্যর্থ হলেও চুপচাপ — মূল অ্যাকশনে প্রভাব ফেলবে না
  }
}
