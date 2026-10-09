'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

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

function ProjectMiniCard({ project, reversed, number }: { project: ProjectCard; reversed: boolean; number: string }) {
  // Guards a real data-entry slip (a project's Summary field got set to its own slug,
  // e.g. "crypto-trading-web-app-ui-ux-design-case-study-concept") rather than a real
  // description - render nothing instead of that raw slug text. Length is no longer
  // capped here - .project-title/.project-summary (home.css) truncate to a single
  // line with CSS text-overflow:ellipsis instead.
  const summary = project.summary && project.summary.trim() !== project.slug ? project.summary : null;

  return (
    <div className={`project-row${reversed ? ' reversed' : ''}`}>
      <div className="project-card-pill">
        <div className="project-image">
          {project.cover ? (
            <img src={project.cover} alt={project.title} />
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
            <span>See More Details</span>
            <img src="/projects/arrow-details.svg" alt="" />
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

  function go(delta: number) {
    setPage((p) => (p + delta + totalPages) % totalPages);
  }

  return (
    <div className="projects-carousel">
      <div className="project-stack">
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
        <div className="project-nav">
          <button type="button" className="project-nav-arrow" onClick={() => go(-1)} aria-label="Previous projects">
            <img src="/projects/arrow-prev.svg" alt="" />
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
            <img src="/projects/arrow-next.svg" alt="" />
          </button>
        </div>
      )}
    </div>
  );
}
