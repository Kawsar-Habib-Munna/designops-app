'use client';

// Loading screen (Figma "Flow 53 Web Loader", node 2810:3522): a dark 1440x1024 stage with the neon U emblem, the
// FLOW 53 wordmark and a LOADING / LOADED + percent line above a glowing horizon and the faint service tiles
// (the glow, tiles and corner marks are part of /loader/bg.webp). The percent counts up, then the whole screen fades
// out and the hero animations start. HOLD_MS is tied to home.css (hero-fig-bg-reveal delay) and HeroTitleTyped.tsx
// (START_DELAY): change them together. prefers-reduced-motion skips the intro, and a repeat visit skips it too.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { markIntroSeen, readIntroSeen } from '@/lib/introSeen';

// on a repeat visit a tiny script in app/layout.tsx adds `intro-seen` to <html> before first paint,
// and home.css hides the overlay and starts the hero animations right away
const subscribeNoop = () => () => {};

const COUNT_START_MS = 250;
const COUNT_MS = 2600;
const HOLD_MS = 3100;

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

  return (
    <motion.div
      className="hero-intro"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: wiping ? 0 : 1 }}
      transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => {
        if (wiping) setRemoved(true);
      }}
    >
      <div className="hero-intro-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-intro-bg" src="/loader/bg.webp" alt="" fetchPriority="high" />
        <div className="hero-intro-emblem">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loader/emblem.webp" alt="" fetchPriority="high" />
        </div>
        <div className="hero-intro-brand">
          <span className="hero-intro-flow">FLOW</span>
          <span className="hero-intro-53">53</span>
        </div>
        <div className="hero-intro-meta">
          <span className="hero-intro-state">{percent >= 100 ? 'LOADED' : 'LOADING'}</span>
          <span className="hero-intro-pct">{percent}%</span>
        </div>
        <div className="hero-intro-line">
          <span className="hero-intro-line-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </motion.div>
  );
}
