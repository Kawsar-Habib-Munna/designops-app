import { NextRequest } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/googleDrive';

// /api/drive-auth/start-এর পরের ধাপ — Google থেকে ফেরত আসা authorization code
// দিয়ে refresh token জেনারেট করে স্ক্রিনে দেখায়। শুধু সেটআপের সময় একবার লাগে।

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) return new Response(`Google অনুমতি দেয়নি: ${error}`, { status: 400 });
  if (!code) return new Response('কোনো authorization code পাওয়া যায়নি।', { status: 400 });

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      return new Response(
        'refresh_token পাওয়া যায়নি — সম্ভবত এই অ্যাকাউন্ট দিয়ে আগে একবার অনুমতি দেওয়া হয়েছিল। ' +
          'https://myaccount.google.com/permissions -এ গিয়ে "DesignOps Files" অ্যাপের অ্যাক্সেস রিভোক করে আবার /api/drive-auth/start ভিজিট করুন।',
        { status: 400 }
      );
    }

    return new Response(
      `<!doctype html><html><body style="font-family:sans-serif;padding:40px;max-width:640px;margin:0 auto;">
        <h2>সফল হয়েছে!</h2>
        <p>এই refresh token-টা কপি করে <code>.env.local</code>-এ <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>-এর ভ্যালু হিসেবে বসান, তারপর dev সার্ভার রিস্টার্ট করুন:</p>
        <pre style="background:#f4f4f4;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;">${tokens.refresh_token}</pre>
        <p style="color:#666;font-size:13px;">এরপর <code>app/api/drive-auth/</code> ফোল্ডারটা মুছে ফেলা নিরাপদ — আর দরকার নেই।</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (e) {
    return new Response(`এরর: ${e instanceof Error ? e.message : 'অজানা এরর'}`, { status: 500 });
  }
}
