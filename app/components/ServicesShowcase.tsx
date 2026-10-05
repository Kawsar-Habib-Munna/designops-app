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
  image: string;
};

const SERVICES: Service[] = [
  {
    number: '01',
    name: 'UI UX Design',
    subtitle: 'User focused intuitive digital experiences',
    tags: ['Research', 'Wireframing', 'UI Design', 'Prototyping', 'Testing', 'Design Systems'],
    image: '/services/illustration-01-ui-ux-design.png',
  },
  {
    number: '02',
    name: 'Web And App Design',
    subtitle: 'Modern responsive web and mobile interfaces',
    tags: ['Websites', 'Mobile App', 'Landing Page', 'Dashboards', 'AI Web & App', 'Redesign'],
    image: '/services/illustration-02-web-app-design.png',
  },
  {
    number: '03',
    name: 'Web Development',
    subtitle: 'Fast secure scalable web solutions',
    tags: ['Frontend', 'Backend', 'CMS & APIs', 'Optimization', 'Deployment', 'Database'],
    image: '/services/illustration-03-web-development.png',
  },
  {
    number: '04',
    name: 'Brand Identity Design',
    subtitle: 'Memorable brands with consistent visual identity',
    tags: ['Logos', 'Colors', 'Social', 'Stationery', 'Business Card', 'Packaging'],
    image: '/services/illustration-04-brand-identity.png',
  },
  {
    number: '05',
    name: 'Digital Marketing',
    subtitle: 'Grow traffic and boost online visibility',
    tags: ['SEO', 'Keywords', 'Content', 'Analytics', 'Backlinks', 'Campaigns'],
    image: '/services/illustration-05-digital-marketing.png',
  },
];

export default function ServicesShowcase() {
  const [active, setActive] = useState(0);
  const service = SERVICES[active];

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
                <img src={service.image} alt={service.name} />
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
