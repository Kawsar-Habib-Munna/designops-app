'use client';

// "Numbers That Speak" সেকশনের ৫টা stat-circle স্ক্রল করে সেকশনে ঢোকার সময় আলাদা
// আলাদা কোণ থেকে উড়ে এসে (যেন টেনিস বল বাউন্স করে থিতু হচ্ছে) নিজের জায়গায় বসে -
// framer-motion-এর spring transition-এ বেশি bounce ভ্যালু দিলে overshoot করে
// কয়েকবার দুলে থেমে যায়, যেটাই সেই "বাউন্সিং" অনুভূতি দেয়। page.tsx একটা Server
// Component, তাই এই motion/scroll-trigger লজিকটা আলাদা client কম্পোনেন্টে।

import { motion, useReducedMotion } from 'framer-motion';

// প্রতিটা ইনডেক্সের জন্য আলাদা শুরুর কোণ/দূরত্ব - প্রতিটা বল সত্যিই ভিন্ন দিক থেকে
// আসছে এমন অনুভূতি দেওয়ার জন্য।
const ENTRY_OFFSETS: { x: number; y: number }[] = [
  { x: -160, y: -110 }, // উপরে-বাঁ দিক থেকে
  { x: 160, y: -110 }, // উপরে-ডান দিক থেকে
  { x: -140, y: 160 }, // নিচে-বাঁ দিক থেকে
  { x: 0, y: -200 }, // সোজা উপর থেকে
  { x: 140, y: 160 }, // নিচে-ডান দিক থেকে
];

export default function BouncyStat({ label, value, index }: { label: string; value: string; index: number }) {
  const reduceMotion = useReducedMotion();
  const offset = ENTRY_OFFSETS[index % ENTRY_OFFSETS.length];

  if (reduceMotion) {
    return (
      <div className="stat-circle">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        <img src="/stats/arrow.svg" alt="" className="stat-arrow" />
      </div>
    );
  }

  return (
    <motion.div
      className="stat-circle"
      initial={{ opacity: 0, x: offset.x, y: offset.y, scale: 0.3 }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ type: 'spring', bounce: 0.55, duration: 1.1, delay: index * 0.12 }}
    >
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <img src="/stats/arrow.svg" alt="" className="stat-arrow" />
    </motion.div>
  );
}
