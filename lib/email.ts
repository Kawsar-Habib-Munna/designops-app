// শুধু সার্ভার-সাইড (API route) থেকে ইম্পোর্ট করার জন্য — RESEND_API_KEY একটা
// secret env var, ক্লায়েন্ট বান্ডলে যাওয়া চলবে না।
// Resend-এর REST API সরাসরি fetch দিয়ে কল করা হয়েছে, কোনো SDK ডিপেন্ডেন্সি
// ছাড়াই — https://resend.com/docs/api-reference/emails/send-email

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY সেট করা নেই — .env.local / Vercel env var দেখুন।');
  const from = process.env.RESEND_FROM_EMAIL || 'DesignOps <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend email পাঠানো যায়নি: ${errText}`);
  }
  return res.json();
}
