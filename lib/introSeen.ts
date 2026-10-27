// হিরো লোডিং ইন্ট্রো (HeroIntro.tsx) শুধু একটা ব্রাউজার সেশনে প্রথমবারই চলে — চলা শেষ হলে এই
// ফ্ল্যাগ সেট হয়, পরের ভিজিটে (হোমে ফিরে এলে বা রিলোড করলে) ইন্ট্রো স্কিপ হয়। sessionStorage
// ব্যবহার করা হয়েছে: ট্যাব/ব্রাউজার বন্ধ করে আবার এলে নতুন সেশন, তাই ইন্ট্রো আবার চলে।
export const INTRO_SEEN_KEY = 'flow53-intro-seen';

export function readIntroSeen(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // storage blocked (private mode etc.) — the intro simply plays every time
  }
}
