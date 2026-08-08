// শুধু সার্ভার-সাইড (API route) থেকে ইম্পোর্ট করার জন্য — Twilio credentials
// secret env var, ক্লায়েন্ট বান্ডলে যাওয়া চলবে না।
// Twilio-র REST API সরাসরি fetch দিয়ে কল করা হয়েছে, কোনো SDK ডিপেন্ডেন্সি
// ছাড়াই — https://www.twilio.com/docs/whatsapp/api
//
// Sandbox মোডে পাঠানোর আগে প্রতিটা প্রাপককে একবার Twilio sandbox নম্বরে
// "join <your-sandbox-code>" টেক্সট করে অপ্ট-ইন করতে হয় (Twilio Console →
// Messaging → Try it out → Send a WhatsApp message-এ কোডটা পাওয়া যায়),
// নাহলে Twilio মেসেজ ডেলিভার করবে না।

export async function sendWhatsApp(toNumber: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // যেমন: 'whatsapp:+14155238886' (Twilio sandbox নম্বর)
  if (!sid || !token || !from) throw new Error('Twilio env vars (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM) সেট করা নেই।');

  const to = toNumber.trim().startsWith('whatsapp:') ? toNumber.trim() : `whatsapp:${toNumber.trim()}`;
  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio WhatsApp মেসেজ পাঠানো যায়নি: ${errText}`);
  }
  return res.json();
}
