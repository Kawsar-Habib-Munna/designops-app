'use client';

// The landing page's scroll animations. This component renders nothing; after it mounts it watches the page:
//  - `.reveal` sections fade up once when they come into view (as before).
//  - the cards, stats and labels listed in ITEMS rise in with a soft blur and a small stagger, and play AGAIN every time they
//    scroll back into view (they reset once they leave the screen). They use the individual `translate` / `scale`
//    properties inside a CSS animation, so the components' own transforms and hover transitions are left untouched.
// With "reduce motion" on, none of the item animation is applied. The landing page is a Server Component, so this effect
// lives in its own client component.

import { useEffect } from 'react';

const ITEMS = [
  '.stats-eyebrow',
  '.stats-top > *',
  '.stats-bottom > *',
  '.services-eyebrow',
  '.about-eyebrow',
  '.about-photo-card',
  '.about-lead',
  '.about-mission',
  '.about-vision',
  '.about-know-more',
  '.why-eyebrow',
  '.why-card',
  '.process-mobile-item',
  '.faq-card',
  '.faq-contact-card',
  '.cta-final-eyebrow',
  '.cta-final-lead',
  '.cta-final-buttons > *',
].join(', ');

export default function RevealOnScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sections = document.querySelectorAll('.home-root .reveal');
    const sectionIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.1 }
    );
    sections.forEach((el) => sectionIo.observe(el));

    let itemIo: IntersectionObserver | null = null;
    if (!reduce) {
      const items = Array.from(document.querySelectorAll<HTMLElement>(`.home-root :is(${ITEMS})`));
      // the position among its siblings sets the stagger, so a row of cards arrives one after another
      items.forEach((el) => {
        const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((c) => items.includes(c as HTMLElement)) : [];
        el.style.setProperty('--rv-i', String(Math.max(0, siblings.indexOf(el))));
        el.classList.add('rv-item');
      });
      itemIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            e.target.classList.toggle('rv-in', e.isIntersecting);
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
      );
      items.forEach((el) => itemIo!.observe(el));
    }

    return () => {
      sectionIo.disconnect();
      itemIo?.disconnect();
      document.querySelectorAll('.rv-item').forEach((el) => el.classList.remove('rv-item', 'rv-in'));
    };
  }, []);

  return null;
}
