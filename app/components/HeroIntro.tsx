'use client';

// ekon.framer.ai-এর hero-র "Loading curtain + preloader wordmark" কৌশলটা এখানে
// পোর্ট করা হয়েছে (রিভার্স-ইঞ্জিনিয়ার করে পাওয়া exact mechanism): ৪টা কালো
// panel হিরো-র ওপর বসে থাকে, মাঝখানে "FLOW 53" ওয়ার্ডমার্কের প্রতিটা অক্ষর
// আলাদাভাবে (translateY(-20px) + opacity 0 থেকে স্বাভাবিক) reveal হয় - কোনো
// blur ছাড়াই, ঠিক যেমন আসল সাইটে "EKON.STUDIO" লোডার টেক্সট কাজ করে। একটা
// fixed হোল্ড টাইমের পর ৪টা panel বাঁ থেকে ডানে সামান্য stagger করে উপরের
// দিকে স্কেল-আউট হয়ে হিরো-র বাকি কনটেন্ট দেখায়। prefers-reduced-motion
// থাকলে পুরো ইন্ট্রো স্কিপ করে সরাসরি null রিটার্ন করে।
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const WORDMARK = 'FLOW 53';
const HOLD_MS = 1300;
const PANEL_COUNT = 4;

export default function HeroIntro() {
  const reduceMotion = useReducedMotion();
  const [wiping, setWiping] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => setWiping(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  if (reduceMotion || removed) return null;

  return (
    <div className="hero-intro" aria-hidden="true">
      <div className="hero-intro-panels">
        {Array.from({ length: PANEL_COUNT }, (_, i) => (
          <motion.div
            key={i}
            className="hero-intro-panel"
            initial={{ y: '0%' }}
            animate={wiping ? { y: '-100%' } : { y: '0%' }}
            transition={{ duration: 0.7, delay: wiping ? i * 0.08 : 0, ease: [0.76, 0, 0.24, 1] }}
            onAnimationComplete={() => {
              if (wiping && i === PANEL_COUNT - 1) setRemoved(true);
            }}
          />
        ))}
      </div>
      <AnimatePresence>
        {!wiping && (
          <motion.div className="hero-intro-word" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {WORDMARK.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0.001, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
