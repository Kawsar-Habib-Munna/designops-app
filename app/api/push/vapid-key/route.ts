// ক্লায়েন্টকে VAPID পাবলিক কী দেয় (subscribe() কল করার সময় applicationServerKey
// হিসেবে লাগে) — পাবলিক কী স্পর্শকাতর না, কিন্তু তাও NEXT_PUBLIC_ বান্ডল করার বদলে
// এই ছোট রুট দিয়ে সার্ভার-সাইডেই env var-এ রাখা হলো, যাতে ভবিষ্যতে কী রোটেট করতে
// রিডিপ্লয় ছাড়াই শুধু env var বদলালেই হয়।

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return Response.json({ error: 'VAPID_PUBLIC_KEY সেট করা নেই।' }, { status: 500 });
  return Response.json({ publicKey });
}
