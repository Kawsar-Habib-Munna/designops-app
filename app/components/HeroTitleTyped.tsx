'use client';

// হিরো টাইটেল আগে টাইপরাইটার effect-এ ছিল (page.tsx: আগের "Add a typewriter-style
// entrance" request) - এখন ekon.framer.ai-এর hero সিকোয়েন্সের (curtain + wordmark
// + background reveal) সাথে মেলাতে সেই একই per-letter blur+rise reveal কৌশল
// এখানেও পোর্ট করা হলো: প্রতিটা অক্ষর আলাদা span, শুরুতে opacity:0.001,
// blur(8px), translateY(10px) - তারপর স্বাভাবিক অবস্থায় reveal হয়, stagger করে।
// প্রতিটা শব্দ একটা white-space:nowrap wrapper-এ রাখা হয়েছে যাতে লাইন wrap
// হলে কোনো শব্দ মাঝখান থেকে না ভাঙে। START_DELAY হিরো ব্যাকগ্রাউন্ড
// reveal-এর (home.css: hero-fig-bg animation-delay 3s) কাছাকাছি, যাতে curtain
// wipe শুরু হওয়ার সাথে সাথেই টাইটেলও reveal হতে শুরু করে।
import { motion, useReducedMotion } from 'framer-motion';
import { readIntroSeen } from '@/lib/introSeen';

const PRE = 'We Design And Build Digital Products That ';
const EM = 'Create';
const POST = ' Impact!';

const START_DELAY = 3.05;
// repeat visit: the loader is skipped, so the title types in almost immediately
const SEEN_START_DELAY = 0.1;
const PER_LETTER = 0.018;

function Word({ word, startIndex, italic }: { word: string; startIndex: number; italic?: boolean }) {
  const startDelay = readIntroSeen() ? SEEN_START_DELAY : START_DELAY;
  const content = (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
      {word.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0.001, filter: 'blur(8px)', y: 10 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.6, delay: startDelay + (startIndex + i) * PER_LETTER, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'inline-block' }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
  return italic ? <em>{content}</em> : content;
}

function AnimatedWords({ text, baseIndex, italic }: { text: string; baseIndex: number; italic?: boolean }) {
  const parts = text.split(' ');
  const starts = parts.reduce<number[]>((acc, word, i) => {
    acc.push(i === 0 ? baseIndex : acc[i - 1] + parts[i - 1].length + 1);
    return acc;
  }, []);
  return (
    <>
      {parts.map((word, i) => (
        <span key={i}>
          {word.length > 0 && <Word word={word} startIndex={starts[i]} italic={italic} />}
          {i < parts.length - 1 && ' '}
        </span>
      ))}
    </>
  );
}

export default function HeroTitleTyped() {
  const reduceMotion = useReducedMotion();
  const fullText = `${PRE}${EM}${POST}`;

  if (reduceMotion) {
    return (
      <h1 className="hero-title">
        {PRE}
        <em>{EM}</em>
        {POST}
      </h1>
    );
  }

  return (
    <h1 className="hero-title" aria-label={fullText}>
      <span aria-hidden="true">
        <AnimatedWords text={PRE} baseIndex={0} />
        <AnimatedWords text={EM} baseIndex={PRE.length} italic />
        <AnimatedWords text={POST} baseIndex={PRE.length + EM.length} />
      </span>
    </h1>
  );
}
