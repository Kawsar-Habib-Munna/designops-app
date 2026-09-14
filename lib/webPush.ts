// শুধু সার্ভার-সাইড (API route) থেকে ইম্পোর্ট করার জন্য — VAPID_PRIVATE_KEY একটা
// secret env var, ক্লায়েন্ট বান্ডলে যাওয়া চলবে না। lib/email.ts/lib/whatsapp.ts-এর
// মতোই প্যাটার্ন: একটা সিম্পল sendPushToUser() যেটা caller (dispatch route)
// থেকে fire-and-forget কল হয়।
//
// একটা ব্যবহারকারীর একাধিক push_subscriptions থাকতে পারে (একাধিক ডিভাইস/ব্রাউজার) —
// সবগুলোতে পাঠানো হয়, আর কোনো subscription push service থেকে 404/410 (গন/এক্সপায়ার্ড)
// রিপোর্ট করলে সেটা টেবিল থেকে মুছে ফেলা হয় (স্বাভাবিক ক্লিনআপ — uninstalled/revoked ব্রাউজার)।

import webpush from 'web-push';
import { getSupabaseAdmin } from './supabaseAdmin';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT সেট করা নেই — .env.local / Vercel env var দেখুন।');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = { title: string; body?: string | null; link?: string | null };

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();
  const supabaseAdmin = getSupabaseAdmin();

  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body ?? '', link: payload.link ?? '/' }),
        );
        sent++;
      } catch (err) {
        const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          const msg = err instanceof Error ? err.message : 'unknown';
          console.error(`[webPush] sendNotification failed for subscription ${sub.id} (user ${userId}):`, msg);
        }
      }
    }),
  );

  return { sent, removed };
}
