'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Figma: Flow 53 Web · "What Can We Build Together?" (429:2152 heading, 496:3499 list,
// 500:3595…3689 the five numbered cards). Figma lays the 5 cards out stacked down the
// canvas since it's static; here they occupy one slot and swap on click, which is what
// "card swapping animation" means for an interactive tab like this.

type Service = {
  number: string;
  name: string;
  subtitle: string;
  tags: string[];
};

const SERVICES: Service[] = [
  {
    number: '01',
    name: 'UI UX Design',
    subtitle: 'User focused intuitive digital experiences',
    tags: ['Research', 'Wireframing', 'UI Design', 'Prototyping', 'Testing', 'Design Systems'],
  },
  {
    number: '02',
    name: 'Web And App Design',
    subtitle: 'Modern responsive web and mobile interfaces',
    tags: ['Websites', 'Mobile App', 'Landing Page', 'Dashboards', 'AI Web & App', 'Redesign'],
  },
  {
    number: '03',
    name: 'Web Development',
    subtitle: 'Fast secure scalable web solutions',
    tags: ['Frontend', 'Backend', 'CMS & APIs', 'Optimization', 'Deployment', 'Database'],
  },
  {
    number: '04',
    name: 'Brand Identity Design',
    subtitle: 'Memorable brands with consistent visual identity',
    tags: ['Logos', 'Colors', 'Social', 'Stationery', 'Business Card', 'Packaging'],
  },
  {
    number: '05',
    name: 'Digital Marketing',
    subtitle: 'Grow traffic and boost online visibility',
    tags: ['SEO', 'Keywords', 'Content', 'Analytics', 'Backlinks', 'Campaigns'],
  },
];

// Figma cropped one shared AI-generated sprite sheet (all 5 illustrations in a 3+2
// grid) per card via a scaled + offset <img>, instead of exporting 5 separate images.
// Reproduced here with the same percentages so the exact asset is reused unedited.
const ILLUSTRATION_CROPS = [
  { width: '351.6%', height: '276.36%', left: '-13.91%', top: '-15.57%' },
  { width: '358.56%', height: '276.36%', left: '-127.44%', top: '-15.57%' },
  { width: '350.16%', height: '276.36%', left: '-236.8%', top: '-17.02%' },
  { width: '387.96%', height: '347.01%', left: '-72.46%', top: '-190.75%' },
  { width: '362.85%', height: '326%', left: '-200.9%', top: '-176.83%' },
];

export default function ServicesShowcase() {
  const [active, setActive] = useState(0);
  const service = SERVICES[active];
  const crop = ILLUSTRATION_CROPS[active];

  return (
    <div className="services-tabs">
      <div className="services-tabs-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="services-card-inner"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="services-card-top">
              <span className="services-card-number">{service.number}</span>
              <div className="services-card-copy-tags">
                <div className="services-card-head">
                  <h3 className="services-card-title">{service.name}</h3>
                  <p className="services-card-subtitle">{service.subtitle}</p>
                </div>
                <div className="services-card-tags">
                  {service.tags.map((tag) => (
                    <span className="services-tag" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="services-card-illustration">
              <div className="services-card-illustration-inner">
                <img
                  src="/services/illustration-sprite.png"
                  alt={service.name}
                  style={{ width: crop.width, height: crop.height, left: crop.left, top: crop.top }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="services-tabs-list">
        {SERVICES.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              type="button"
              key={s.number}
              className={`services-list-item${isActive ? ' active' : ''}`}
              onClick={() => setActive(i)}
              aria-pressed={isActive}
            >
              <span className="services-list-row">
                <span className="services-list-name">{s.name}</span>
                <span className="services-list-icon">
                  <img src={isActive ? '/services/arrow-corner-active.svg' : '/services/arrow-corner.svg'} alt="" />
                </span>
              </span>
              <img
                className="services-list-divider"
                src={isActive ? '/services/divider-active.svg' : '/services/divider.svg'}
                alt=""
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
