// বাটন-হোভার "text slide-swap" effect - একই লেখার দুটো কপি উল্লম্বভাবে
// stacked, একটা single-line clip window-এর ভেতরে। হোভার-এ (প্যারেন্ট বাটনের
// নিজস্ব CSS সিলেক্টর দিয়ে, যেমন `.hero-start:hover .slide-swap-track`)
// পুরো track 50% (মানে ঠিক এক লাইন) ওপরে সরে যায় - প্রথম কপিটা ওপরে বেরিয়ে
// যায়, দ্বিতীয় (হুবহু একই) কপিটা নিচ থেকে উঠে একই জায়গা নেয়। কোনো hook
// লাগে না বলে এটা Server Component-এও (app/page.tsx) সরাসরি ব্যবহার করা যায়।
export default function SlideSwapLabel({ text }: { text: string }) {
  return (
    <span className="slide-swap-clip">
      <span className="slide-swap-track">
        <span className="slide-swap-line">{text}</span>
        <span className="slide-swap-line">{text}</span>
      </span>
    </span>
  );
}
