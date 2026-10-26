'use client';

import { motion, useReducedMotion } from 'framer-motion';

export type WhyCard = {
  icon: string;
  title: string;
  desc: string;
  alt?: boolean;
};

const COLUMNS = 3;

export default function WhyCardsGrid({ cards }: { cards: WhyCard[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="why-grid">
      {cards.map((c, i) => {
        // সাজানো ৩-কলাম গ্রিডে প্রথম সারি (ইনডেক্স 0-2) বাঁ দিক থেকে, দ্বিতীয়
        // সারি (3-5) ডান দিক থেকে ঢোকে - row-এর ভেতরের কলাম (i % COLUMNS) বোঝার
        // জন্যই, দিক নির্ধারণ হয় row ইনডেক্স (Math.floor(i / COLUMNS)) জোড়-বিজোড়
        // দিয়ে।
        const row = Math.floor(i / COLUMNS);
        const fromLeft = row % 2 === 0;
        return (
          <motion.div
            className={`why-card${c.alt ? ' alt' : ''}`}
            key={c.title}
            initial={reduceMotion ? undefined : { opacity: 0, x: fromLeft ? -300 : 300 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0 }}
            transition={{ duration: 0.6, delay: (i % COLUMNS) * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="why-card-top">
              <span className="why-card-icon">
                <img loading="lazy" src={c.icon} alt="" />
              </span>
              <span className="why-card-line">
                <img loading="lazy" src="/why/card-line.svg" alt="" />
              </span>
            </div>
            <div className="why-card-copy">
              <h3 className="why-card-title">{c.title}</h3>
              <p className="why-card-desc">{c.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
