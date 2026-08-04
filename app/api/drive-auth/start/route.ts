import { getAuthUrl } from '@/lib/googleDrive';

// এক-বারের সেটআপ ইউটিলিটি — dedicated Google অ্যাকাউন্ট দিয়ে ব্রাউজারে এই
// রুট ভিজিট করলে Google-এর কনসেন্ট স্ক্রিনে রিডাইরেক্ট হয়। অনুমতি দেওয়ার পর
// /api/drive-auth/callback একটা refresh token দেখাবে, সেটা .env.local-এ
// GOOGLE_OAUTH_REFRESH_TOKEN হিসেবে বসাতে হবে। refresh token পাওয়ার পর এই
// দুটো রুট (start, callback) মুছে ফেলা নিরাপদ — সেগুলো আর দরকার হয় না।

export async function GET() {
  try {
    return Response.redirect(getAuthUrl());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'সার্ভার কনফিগ ভুল আছে।' }, { status: 500 });
  }
}
