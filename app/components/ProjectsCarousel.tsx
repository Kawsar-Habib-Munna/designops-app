'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

// Figma: "Let's Look At What We've built!" (533:505 heading, 565:2813 / 565:2814 the two
// example slides, 577:3342 the prev/dots/next controls). Figma lays the slides out
// stacked on the canvas since it's static; here they occupy one slot and crossfade on
// click/arrow, alternating image-left/image-right by index like the two Figma examples.

export type ProjectCard = {
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  tags: string[] | null;
  cover: string | null;
};

export default function ProjectsCarousel({ projects }: { projects: ProjectCard[] }) {
  const [index, setIndex] = useState(0);

  if (projects.length === 0) return null;

  const total = projects.length;
  const current = projects[index];
  const reversed = index % 2 === 1;
  const number = String(index + 1).padStart(2, '0');

  function go(delta: number) {
    setIndex((i) => (i + delta + total) % total);
  }

  return (
    <div className="projects-carousel">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className={`project-row${reversed ? ' reversed' : ''}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="project-card-pill">
            <div className="project-image">
              {current.cover ? (
                <img src={current.cover} alt={current.title} />
              ) : (
                <div className="project-image-placeholder" aria-hidden="true" />
              )}
            </div>
            <div className="project-content">
              <div className="project-content-top">
                {current.category && <span className="project-category">{current.category}</span>}
                <div className="project-text">
                  <h3 className="project-title">{current.title}</h3>
                  {current.summary && <p className="project-summary">{current.summary}</p>}
                </div>
                {current.tags && current.tags.length > 0 && (
                  <div className="project-tags-row">
                    {current.tags.map((t) => (
                      <span className="project-tag-pill" key={t}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link href={`/work/${current.slug}`} className="project-details-btn">
                <span>See More Details</span>
                <img src="/projects/arrow-details.svg" alt="" />
              </Link>
            </div>
          </div>
          <span className="project-number" aria-hidden="true">{number}</span>
        </motion.div>
      </AnimatePresence>

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
