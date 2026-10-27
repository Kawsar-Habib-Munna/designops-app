'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import SlideSwapLabel from './SlideSwapLabel';

// Figma: "Let's Look At What We've built!" (533:505 heading, 565:2813 / 565:2814 the two
// example slides, 577:3342 the prev/dots/next controls) shows one full-width slide at a
// time. Per explicit request, projects now show in fixed pairs instead - 1&2, then 3&4,
// then 5&6 - each pair's first project full size up front, its second peeking out behind/
// below-right of it. Advancing moves a whole pair at a time, not a sliding one-at-a-time
// window (which would show 2&3 after 1&2).

export type ProjectCard = {
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  tags: string[] | null;
  cover: string | null;
};

// /work (প্রজেক্ট লিস্টিং পেজ)-এও এই একই কার্ড রিইউজ হয় - সেখানে carousel-এর
// stacking/motion দরকার নেই, শুধু plain filtered+paginated লিস্টে একটার পর
// একটা কার্ড দেখানো হয়, তাই এখানে export করা হলো।
export function ProjectMiniCard({ project, reversed, number }: { project: ProjectCard; reversed: boolean; number: string }) {
  // Guards a real data-entry slip (a project's Summary field got set to its own slug,
  // e.g. "crypto-trading-web-app-ui-ux-design-case-study-concept") rather than a real
  // description - render nothing instead of that raw slug text. Length is no longer
  // capped here - .project-title/.project-summary (home.css) truncate to a single
  // line with CSS text-overflow:ellipsis instead.
  const summary = project.summary && project.summary.trim() !== project.slug ? project.summary : null;
  // Drive ফাইলের শেয়ারিং পারমিশন ঠিক না থাকলে বা ID বদলে গেলে lh3.googleusercontent.com
  // 404/403 দেয় - তখন ব্রাউজারের ডিফল্ট ভাঙা-ছবি আইকন না দেখিয়ে placeholder gradient-এ
  // গ্রেসফুলি ফলব্যাক করা হয়।
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <div className={`project-row${reversed ? ' reversed' : ''}`}>
      <div className="project-card-pill">
        <div className="project-image">
          {project.cover && !imgBroken ? (
            <img loading="lazy" src={project.cover} alt={project.title} onError={() => setImgBroken(true)} />
          ) : (
            <div className="project-image-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="project-content">
          <div className="project-content-top">
            {project.category && <span className="project-category">{project.category}</span>}
            <div className="project-text">
              <h3 className="project-title">{project.title}</h3>
              {summary && <p className="project-summary">{summary}</p>}
            </div>
            {project.tags && project.tags.length > 0 && (
              <div className="project-tags-row">
                {project.tags.map((t) => (
                  <span className="project-tag-pill" key={t}>{t}</span>
                ))}
              </div>
            )}
          </div>
          <Link href={`/work/${project.slug}`} className="project-details-btn">
            <SlideSwapLabel text="See More Details" />
            <img loading="lazy" src="/projects/arrow-details.svg" alt="" />
          </Link>
        </div>
      </div>
      <span className="project-number" aria-hidden="true">{number}</span>
    </div>
  );
}

const PAGE_SIZE = 2;

export default function ProjectsCarousel({ projects }: { projects: ProjectCard[] }) {
  const [page, setPage] = useState(0);
  // মোবাইলে (≤860px) desktop-এর fixed-pair pagination (PAGE_SIZE=2) থেকে
  // আলাদা, নিজস্ব state - প্রতি পেজে ১টা প্রজেক্ট, সবগুলো প্রজেক্ট একে একে
  // cycle করে। desktop-এর PAGE_SIZE=2 দিয়ে mobile-এ চালালে শুধু জোড়-ইনডেক্সের
  // (0,2,4...) প্রজেক্টই "front" হিসেবে দেখা যেত (বিজোড়-ইনডেক্স কখনো একা front
  // হতো না, কারণ ওরা সবসময় কোনো না কোনো পেজের "back" - যেটা মোবাইলে hidden),
  // তাই অর্ধেক প্রজেক্ট দেখাই যেত না।
  const [mobilePage, setMobilePage] = useState(0);
  const reduceMotion = useReducedMotion();

  if (projects.length === 0) return null;

  const total = projects.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  // Non-overlapping pairs: page 0 -> projects 1&2, page 1 -> 3&4, and so on - not a
  // sliding window (which would show 2&3 after 1&2). The last page may have only one
  // project if total is odd, in which case the back slot just doesn't render.
  const index = page * PAGE_SIZE;
  const current = projects[index];
  const nextIndex = index + 1;
  const next = nextIndex < total ? projects[nextIndex] : null;

  const mobileCurrent = projects[mobilePage];

  function go(delta: number) {
    setPage((p) => (p + delta + totalPages) % totalPages);
  }

  function goMobile(delta: number) {
    setMobilePage((p) => (p + delta + total) % total);
  }

  return (
    <div className="projects-carousel">
      {/* মোবাইলে (≤860px) desktop-এর stacked-pair + peek-behind ডিজাইনটা অর্থহীন
          (back card আগে থেকেই ওই breakpoint-এ hidden), আর desktop-এর PAGE_SIZE=2
          pagination ব্যবহার করলে বিজোড়-ইনডেক্সের প্রজেক্টগুলো কখনো একা দেখাই
          যেত না। তাই মোবাইলে আলাদা, নিজস্ব ১-প্রজেক্ট-প্রতি-পেজ pagination
          (mobilePage state) - একই .project-stack-slot.front কার্ড পুনর্ব্যবহার
          করে, শুধু নিচের নেভিগেশন (arrow/dots) mobilePage নিয়ন্ত্রণ করে। CSS
          দিয়ে টগল করা - দুটোই DOM-এ থাকে, hydration mismatch এড়াতে। */}
      <div className="project-stack-mobile mobile-only">
        <AnimatePresence mode="wait">
          <motion.div
            key={mobileCurrent.slug}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <ProjectMiniCard project={mobileCurrent} reversed={false} number={String(mobilePage + 1).padStart(2, '0')} />
          </motion.div>
        </AnimatePresence>
        {total > 1 && (
          <div className="project-nav">
            <button type="button" className="project-nav-arrow" onClick={() => goMobile(-1)} aria-label="Previous project">
              <span className="project-nav-icon prev" aria-hidden="true" />
            </button>
            <div className="project-dots">
              {Array.from({ length: total }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`project-dot${i === mobilePage ? ' active' : ''}`}
                  onClick={() => setMobilePage(i)}
                  aria-label={`Go to project ${i + 1}`}
                  aria-current={i === mobilePage}
                >
                  <span />
                </button>
              ))}
            </div>
            <button type="button" className="project-nav-arrow" onClick={() => goMobile(1)} aria-label="Next project">
              <span className="project-nav-icon next" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="project-stack desktop-only">
        {/* এই দুটো whileInView entrance সেকশনে স্ক্রল করে ঢোকার নিজস্ব অ্যানিমেশন -
            ভেতরের AnimatePresence-চালিত pagination transition (page বদলালে
            fade/slide) থেকে আলাদা, তাই একে অপরের সাথে কনফ্লিক্ট করে না। প্রথম
            (front/current) প্রজেক্ট বাঁ দিক থেকে, দ্বিতীয় (back/next, পেছনে উঁকি
            দেওয়া কার্ড) ডান দিক থেকে আসে। once:false - উপর থেকে স্ক্রল করে নামলে
            বা নিচ থেকে স্ক্রল করে উপরে উঠলে, দুই দিক থেকেই সেকশনে ঢুকলে অ্যানিমেশন
            চলবে। Services কার্ডে once:false + বড় VERTICAL offset মিলিয়ে বারবার
            re-trigger হয়ে "ভাইব্রেট" করেছিল - এখানে offset HORIZONTAL (x), যেটা
            vertical স্ক্রল-পজিশনের সাথে সরাসরি না লড়াই করায় সেই ফিডব্যাক-লুপ হয়
            না। */}
        {next && (
          <motion.div
            className="project-stack-slot back"
            initial={reduceMotion ? undefined : { opacity: 0, x: 260 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={next.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              >
                <ProjectMiniCard project={next} reversed={nextIndex % 2 === 1} number={String(nextIndex + 1).padStart(2, '0')} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
        <motion.div
          className="project-stack-slot front"
          initial={reduceMotion ? undefined : { opacity: 0, x: -260 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.slug}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <ProjectMiniCard project={current} reversed={index % 2 === 1} number={String(index + 1).padStart(2, '0')} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {totalPages > 1 && (
        <div className="project-nav desktop-only">
          <button type="button" className="project-nav-arrow" onClick={() => go(-1)} aria-label="Previous projects">
            <span className="project-nav-icon prev" aria-hidden="true" />
          </button>
          <div className="project-dots">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                type="button"
                key={i}
                className={`project-dot${i === page ? ' active' : ''}`}
                onClick={() => setPage(i)}
                aria-label={`Go to projects ${i * PAGE_SIZE + 1}${i * PAGE_SIZE + 2 <= total ? `-${i * PAGE_SIZE + 2}` : ''}`}
                aria-current={i === page}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" className="project-nav-arrow" onClick={() => go(1)} aria-label="Next projects">
            <span className="project-nav-icon next" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
