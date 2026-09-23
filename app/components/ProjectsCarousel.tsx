'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

// Figma's own frames (533:505 heading, 565:2813 / 565:2814 the two example slides,
// 577:3342 prev/dots/next) show one full-width slide at a time. The user asked for two
// visible at once instead - the current project up front, the next one peeking out
// behind/below it - so the card itself is shrunk into a compact variant and shown twice
// per view instead of once full-width.

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
  // description - render nothing instead of that raw slug text.
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
              // Capped at 3: the back card must clear the front card's fixed height without
              // overlapping its text (see .project-stack-slot.back's offset in home.css), so
              // this compact card's height needs to stay bounded regardless of tag count.
              <div className="project-tags-row">
                {project.tags.slice(0, 3).map((t) => (
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

export default function ProjectsCarousel({ projects }: { projects: ProjectCard[] }) {
  const [index, setIndex] = useState(0);

  if (projects.length === 0) return null;

  const total = projects.length;
  const current = projects[index];
  const nextIndex = (index + 1) % total;
  const next = projects[nextIndex];

  function go(delta: number) {
    setIndex((i) => (i + delta + total) % total);
  }

  return (
    <div className="projects-carousel">
      <div className="project-stack">
        {total > 1 && (
          <div className="project-stack-slot back">
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
          </div>
        )}
        <div className="project-stack-slot front">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <ProjectMiniCard project={current} reversed={index % 2 === 1} number={String(index + 1).padStart(2, '0')} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {total > 1 && (
        <div className="project-nav">
          <button type="button" className="project-nav-arrow" onClick={() => go(-1)} aria-label="Previous project">
            <img src="/projects/arrow-prev.svg" alt="" />
          </button>
          <div className="project-dots">
            {projects.map((p, i) => (
              <button
                type="button"
                key={p.slug}
                className={`project-dot${i === index ? ' active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to project ${i + 1}`}
                aria-current={i === index}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" className="project-nav-arrow" onClick={() => go(1)} aria-label="Next project">
            <img src="/projects/arrow-next.svg" alt="" />
          </button>
        </div>
      )}
    </div>
  );
}
