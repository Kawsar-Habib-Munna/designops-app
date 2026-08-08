'use client';

// Tasks/Discussions পেজ থেকে ব্যবহৃত হেল্পার — নোটিফিকেশন রো insert করে, আর
// discussion/vote টাইপের জন্য /api/notifications/dispatch-কে fire-and-forget
// কল করে (ইমেইল/WhatsApp পাঠানোর জন্য, প্রাপকের নিজের টগল অনুযায়ী)। এই কলটা
// ব্যর্থ হলেও মূল অ্যাকশন (টাস্ক তৈরি/ডিসকাশন পাবলিশ ইত্যাদি) যেন আটকে না যায়,
// তাই এরর চুপচাপ গিলে ফেলা হয় — নোটিফিকেশন পাঠানো ব্যর্থ হওয়া কখনোই মূল কাজ
// ব্যর্থ করার কারণ হওয়া উচিত না।

import { supabase } from './supabaseClient';

export type NotificationType = 'task_assigned' | 'discussion_created' | 'discussion_mention' | 'discussion_reply' | 'vote_created';

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

  const { data, error } = await supabase.from('notifications').insert(rows).select('id, type');
  if (error || !data) return;

  const dispatchable = data.filter((d) => d.type.startsWith('discussion') || d.type.startsWith('vote'));
  if (dispatchable.length === 0) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ notificationIds: dispatchable.map((d) => d.id) }),
    }).catch(() => {});
  } catch {
    // notification dispatch ব্যর্থ হলেও চুপচাপ — মূল অ্যাকশনে প্রভাব ফেলবে না
  }
}
