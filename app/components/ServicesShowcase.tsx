'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

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
  const reduceMotion = useReducedMotion();

  return (
    <div className="services-tabs">
      {/* এই কার্ডটা সেকশনে ঢোকার সময় উপর থেকে নেমে আসে, smooth ease (কোনো
          bounce/overshoot ছাড়া)। এটা ভেতরের AnimatePresence-চালিত tab-swap
          অ্যানিমেশন থেকে আলাদা - সেটা অক্ষত রাখা হয়েছে, বাইরের এই মোশন শুধু পুরো
          কার্ডটার নিজের স্ক্রল-এন্ট্রান্স। আগে once:false + বড় offset (-400) +
          কম amount (0.1) মিলিয়ে কার্ডটা নিজেই নড়তে নড়তে বারবার 0.1 threshold
          পার হয়ে যাচ্ছিল, ফলে অ্যানিমেশন মাঝপথে বারবার re-trigger হয়ে "ভাইব্রেট"
          করছিল মনে হতো। once:true দিয়ে এই ফিডব্যাক-লুপ বন্ধ করা হলো (এখন শুধু
          প্রথমবার স্ক্রল করে এলেই চলে, বারবার না - BouncyStat-এর ছোট circle-গুলোর
          জন্য once:false নিরাপদ ছিল কারণ offset অনেক কম)। */}
      <motion.div
        className="services-tabs-card"
        initial={reduceMotion ? undefined : { opacity: 0, y: -400 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
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
      </motion.div>

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
