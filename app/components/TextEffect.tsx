'use client';

// Per-character (or per-word) text reveal, like Motion Primitives' TextEffect: when the text scrolls into view (every time, not just the first) each
// character animates in one after another with a blur, fade, slide or scale preset. Words never break in the middle, the
// full text stays available to screen readers, and with "reduce motion" on it renders as plain text.

import { motion, useReducedMotion, type Variants } from 'framer-motion';

const TAGS = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p, span: motion.span, div: motion.div } as const;

type Preset = 'blur' | 'fade' | 'slide' | 'scale';

const ITEM: Record<Preset, Variants> = {
  blur: { hidden: { opacity: 0, filter: 'blur(12px)', y: 8 }, visible: { opacity: 1, filter: 'blur(0px)', y: 0 } },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.6 }, visible: { opacity: 1, scale: 1 } },
};

export default function TextEffect({
  text,
  as = 'span',
  className,
  preset = 'blur',
  per = 'char',
  stagger,
  delay = 0,
  once = false,
}: {
  text: string;
  as?: keyof typeof TAGS;
  className?: string;
  preset?: Preset;
  per?: 'char' | 'word';
  stagger?: number; // seconds between pieces
  delay?: number;
  once?: boolean; // false (default): plays again every time it scrolls back into view
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = TAGS[as];
  if (reduceMotion) return <MotionTag className={className}>{text}</MotionTag>;

  const gap = stagger ?? (per === 'char' ? 0.025 : 0.08);
  const item = ITEM[preset];
  const words = text.split(' ');

  return (
    <MotionTag
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.6 }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {words.map((word, w) => (
        <span key={w} aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {per === 'word' ? (
            <motion.span style={{ display: 'inline-block' }} variants={item} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              {word}
            </motion.span>
          ) : (
            Array.from(word).map((ch, c) => (
              <motion.span key={c} style={{ display: 'inline-block' }} variants={item} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                {ch}
              </motion.span>
            ))
          )}
          {w < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </MotionTag>
  );
}
