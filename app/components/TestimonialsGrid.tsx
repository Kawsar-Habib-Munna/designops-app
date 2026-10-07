'use client';

import { useState } from 'react';

// Figma-র ফিক্সড ৪-স্লট brick লেআউট (row 1: কলাম A+B, row 2: কলাম B+C) —
// top/left % আগে TESTIMONIALS কনস্ট্যান্টে প্রতিটা আইটেমের নিজস্ব ডেটা
// ছিল, এখন এটা স্লট-ইনডেক্স (0-3) ভিত্তিক ফিক্সড টেবিল, যেহেতু real ডেটা
// /portfolio থেকে আসে এবং কোন টেস্টিমোনিয়াল কোন স্লটে বসবে সেটা শুধু তার
// পেজের মধ্যে অবস্থানের উপর নির্ভর করে, ডেটার উপর না।
const SLOT_POSITIONS = [
  { top: 0.18, left: 0 },
  { top: 0.18, left: 33.36 },
  { top: 50.18, left: 33.36 },
  { top: 50.18, left: 66.72 },
];

const PAGE_SIZE = 4;

export type TestimonialCard = {
  name: string;
  role: string;
  quote: string;
  rating: string;
  avatar: string | null;
};

export default function TestimonialsGrid({ testimonials }: { testimonials: TestimonialCard[] }) {
  const [page, setPage] = useState(0);

  if (testimonials.length === 0) return null;

  const totalPages = Math.ceil(testimonials.length / PAGE_SIZE);
  const current = testimonials.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function go(delta: number) {
    setPage((p) => (p + delta + totalPages) % totalPages);
  }

  return (
    <>
      <div className="testimonials-grid">
        <img
          src="/testimonials/grid-lines.svg"
          alt=""
          className="testimonials-grid-lines"
          aria-hidden="true"
        />
        {current.map((t, i) => (
          <div
            className="testimonial-card"
            key={`${page}-${i}`}
            style={{ top: `${SLOT_POSITIONS[i].top}%`, left: `${SLOT_POSITIONS[i].left}%` }}
          >
            <div className="testimonial-top">
              {t.avatar ? (
                <img src={t.avatar} alt="" className="testimonial-avatar" />
              ) : (
                <span className="testimonial-avatar" aria-hidden="true" />
              )}
              <div className="testimonial-who">
                <p className="testimonial-name">{t.name}</p>
                <p className="testimonial-role">{t.role}</p>
              </div>
            </div>
            <p className="testimonial-quote">{t.quote}</p>
            <div className="testimonial-foot">
              <span className="testimonial-rating">
                {t.rating}
                <img src="/testimonials/star-icon.svg" alt="" />
              </span>
              <img
                src="/testimonials/quote-icon.svg"
                alt=""
                className="testimonial-quote-mark"
              />
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="testimonials-pager">
          <button type="button" className="testimonials-pager-btn" onClick={() => go(-1)} aria-label="Previous testimonials">
            <img src="/testimonials/arrow-left.svg" alt="" />
          </button>
          <span className="testimonials-dots">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                type="button"
                key={i}
                className={`testimonials-dot${i === page ? ' active' : ''}`}
                onClick={() => setPage(i)}
                aria-label={`Go to testimonials page ${i + 1}`}
                aria-current={i === page}
              />
            ))}
          </span>
          <button type="button" className="testimonials-pager-btn" onClick={() => go(1)} aria-label="Next testimonials">
            <img src="/testimonials/arrow-right.svg" alt="" />
          </button>
        </div>
      )}
    </>
  );
}
