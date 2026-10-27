'use client';

// হিরোর লোডিং ইন্ট্রো: সাদা ৪টা panel হিরো-র ওপর বসে থাকে, মাঝখানে "FLOW 53 @ Design"
// লেখা (কাউন্টার এগোনোর সাথে Design → Development → Experienced একটা যায়, পরেরটা আসে — একবারে
// একটাই শব্দ) আর তার নিচে একটা চিকন progress লাইন + 0%→100% কাউন্টার। কাউন্টার শেষ হলে
// panel চারটা বাঁ থেকে ডানে সামান্য stagger করে উপরের দিকে স্কেল-আউট হয়ে হিরো-র
// বাকি কনটেন্ট দেখায় (ekon.framer.ai-এর curtain কৌশল)। HOLD_MS বদলালে home.css-এর
// hero-fig-bg-reveal delay আর HeroTitleTyped.tsx-এর START_DELAY-ও একই সাথে বদলাতে
// হবে। prefers-reduced-motion থাকলে পুরো ইন্ট্রো স্কিপ করে সরাসরি null রিটার্ন করে।
import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { markIntroSeen, readIntroSeen } from '@/lib/introSeen';

// on a repeat visit a tiny script in app/layout.tsx adds `intro-seen` to <html> before first paint,
// and home.css hides the overlay and starts the hero animations right away
const subscribeNoop = () => () => {};

const COUNT_START_MS = 250;
const COUNT_MS = 2600;
const HOLD_MS = 3100;
const PANEL_COUNT = 4;
// কাউন্টার এই percent-এ পৌঁছালে সংশ্লিষ্ট শব্দটা আসে, আগেরটা চলে যায়
const WORDS = [
  { text: 'Design', at: 0 },
  { text: 'Development', at: 34 },
  { text: 'Experienced', at: 67 },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function HeroIntro() {
  const reduceMotion = useReducedMotion();
  const [wiping, setWiping] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [percent, setPercent] = useState(0);
  // false on the server and during hydration, the real value afterwards (and immediately on client navigations)
  const seen = useSyncExternalStore(subscribeNoop, readIntroSeen, () => false);

  useEffect(() => {
    if (reduceMotion || seen) return;
    const t = setTimeout(() => setWiping(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [reduceMotion, seen]);

  useEffect(() => {
    if (reduceMotion || seen) return;
    let raf = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const t = Math.min(Math.max((now - startedAt - COUNT_START_MS) / COUNT_MS, 0), 1);
      setPercent(Math.round(easeOutCubic(t) * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, seen]);

  // while the overlay is up, keep the page from scrolling underneath it
  const active = !reduceMotion && !removed && !seen;

  // once the curtain has finished, remember it so later visits skip the intro
  useEffect(() => {
    if (removed) markIntroSeen();
  }, [removed]);
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [active]);

  if (!active) return null;

  const wordIndex = percent < WORDS[1].at ? 0 : percent < WORDS[2].at ? 1 : 2;

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
          <motion.div
            className="hero-intro-word"
            initial={{ opacity: 0.001, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="hero-intro-brand">FLOW 53 @</span>
            <div className="hero-intro-side">
              <div className="hero-intro-words">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={WORDS[wordIndex].text}
                    className="hero-intro-design"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {WORDS[wordIndex].text}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="hero-intro-progress">
                <span className="hero-intro-bar">
                  <span className="hero-intro-bar-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="hero-intro-pct">{percent}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
