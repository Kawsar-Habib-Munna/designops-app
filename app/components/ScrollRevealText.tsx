'use client';

// text-reveal-on-scroll.framer.website-এর প্যারাগ্রাফ-হাইলাইট কৌশলটা পোর্ট করা:
// প্রতিটা শব্দ শুরুতে ম্লান (opacity 0.15), স্ক্রল করার সাথে সাথে (ভিউপোর্টে
// এলে একবারের জন্য না, বরং সরাসরি স্ক্রল-পজিশনের সাথে যুক্ত) একটার পর একটা
// পূর্ণ রঙে উজ্জ্বল হয়ে ওঠে - useScroll দিয়ে প্যারাগ্রাফের নিজের
// scrollYProgress বের করে, প্রতিটা শব্দকে তার নিজের ভাগের progress-রেঞ্জে
// ম্যাপ করা হয়েছে।

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span style={{ opacity, marginRight: '0.28em', display: 'inline-block' }}>
      {children}
    </motion.span>
  );
}

// `span` wrapper ব্যবহার করা হয়েছে (আগে `p` ছিল) - যাতে services-list-name-এর
// মতো <button> এর ভেতরেও বসানো যায়, যেখানে ব্লক-লেভেল <p> বসালে HTML spec
// অনুযায়ী অবৈধ হতো।
export default function ScrollRevealText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'start 0.35'],
  });

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  const words = text.split(' ');

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {word}
        </Word>
      ))}
    </span>
  );
}
