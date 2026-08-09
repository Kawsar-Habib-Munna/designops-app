// শুধু সার্ভার-সাইড (API route) থেকে ইম্পোর্ট করার জন্য — SENDGRID_API_KEY একটা
// secret env var, ক্লায়েন্ট বান্ডলে যাওয়া চলবে না।
// SendGrid ব্যবহার করা হয়েছে (Resend থেকে সরিয়ে) কারণ Resend কাস্টম ডোমেইন
// ভেরিফাই না করলে শুধু account owner-এর নিজের ইমেইলেই পাঠাতে দেয় — টিমের
// বাকিদের কাছে কিছুই পৌঁছাচ্ছিল না। SendGrid-এর "Single Sender Verification"
// দিয়ে ডোমেইন ছাড়াই একটা ইমেইল অ্যাড্রেস ভেরিফাই করলেই যেকোনো recipient-কে
// পাঠানো যায়। REST API সরাসরি fetch দিয়ে কল করা — কোনো SDK ডিপেন্ডেন্সি ছাড়াই
// — https://docs.sendgrid.com/api-reference/mail-send/mail-send

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY সেট করা নেই — .env.local / Vercel env var দেখুন।');
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) throw new Error('SENDGRID_FROM_EMAIL সেট করা নেই — SendGrid-এ verify করা sender email এখানে দিন।');

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'FLOW 53' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SendGrid email পাঠানো যায়নি: ${errText}`);
  }
}
