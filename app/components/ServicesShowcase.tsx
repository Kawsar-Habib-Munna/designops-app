'use client';

import { useRef, useState, type PointerEvent } from 'react';
import TextEffect from './TextEffect';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from 'framer-motion';

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

const EASE = [0.22, 1, 0.36, 1] as const;

// The card swaps in the direction you moved (down the list = new content comes from the right), and its parts arrive one
// after another: the number, the title, the subtitle, each tag, then the illustration.
const cardVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 56, filter: 'blur(6px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE, when: 'beforeChildren', staggerChildren: 0.07 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -56, filter: 'blur(6px)', transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }),
};
const partVariants: Variants = {
  enter: { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
const numberVariants: Variants = {
  enter: { opacity: 0, scale: 0.6, y: 10 },
  center: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 18 } },
};
const tagsVariants: Variants = { enter: {}, center: { transition: { staggerChildren: 0.05 } } };
const tagVariants: Variants = {
  enter: { opacity: 0, scale: 0.8, y: 8 },
  center: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 20 } },
};
const illustrationVariants: Variants = {
  enter: { opacity: 0, scale: 0.88, y: 24, rotate: -2 },
  center: { opacity: 1, scale: 1, y: 0, rotate: 0, transition: { duration: 0.7, ease: EASE } },
};

export default function ServicesShowcase() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const service = SERVICES[active];
  const reduceMotion = useReducedMotion();

  // the illustration leans toward the pointer (a soft 3D tilt) while it is over the card
  const cardRef = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 16 });
  const sy = useSpring(py, { stiffness: 120, damping: 16 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [7, -7]);
  const shiftX = useTransform(sx, [-0.5, 0.5], [-10, 10]);
  const shiftY = useTransform(sy, [-0.5, 0.5], [-8, 8]);

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || e.pointerType === 'touch') return;
    const box = cardRef.current?.getBoundingClientRect();
    if (!box) return;
    px.set((e.clientX - box.left) / box.width - 0.5);
    py.set((e.clientY - box.top) / box.height - 0.5);
  }
  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  function select(i: number) {
    if (i === active) return;
    setDirection(i > active ? 1 : -1);
    setActive(i);
  }

  return (
    <div className="services-tabs">
      {/* the whole card drops in once when the section scrolls into view (once:true so it does not re-trigger while it moves) */}
      <motion.div
        ref={cardRef}
        className="services-tabs-card"
        initial={reduceMotion ? undefined : { opacity: 0, y: -400 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease: EASE }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={active}
            className="services-card-inner"
            custom={direction}
            variants={reduceMotion ? undefined : cardVariants}
            initial={reduceMotion ? undefined : 'enter'}
            animate={reduceMotion ? undefined : 'center'}
            exit={reduceMotion ? undefined : 'exit'}
          >
            <div className="services-card-top">
              <motion.span className="services-card-number" variants={reduceMotion ? undefined : numberVariants}>{service.number}</motion.span>
              <div className="services-card-copy-tags">
                <div className="services-card-head">
                  <TextEffect as="h3" className="services-card-title" text={service.name} preset="blur" per="char" delay={0.12} />
                  <TextEffect as="p" className="services-card-subtitle" text={service.subtitle} preset="slide" per="word" delay={0.3} />
                </div>
                <motion.div className="services-card-tags" variants={reduceMotion ? undefined : tagsVariants}>
                  {service.tags.map((tag) => (
                    <motion.span className="services-tag" key={tag} variants={reduceMotion ? undefined : tagVariants}>{tag}</motion.span>
                  ))}
                </motion.div>
              </div>
            </div>
            <motion.div className="services-card-illustration" variants={reduceMotion ? undefined : illustrationVariants}>
              <motion.div
                className="services-card-illustration-inner"
                style={reduceMotion ? undefined : { rotateX, rotateY, x: shiftX, y: shiftY, transformPerspective: 900 }}
              >
                <motion.div
                  className="services-float"
                  animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
                >
                  <img loading="lazy" src={service.image} alt={service.name} />
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="services-tabs-list">
        {SERVICES.map((s, i) => {
          const isActive = i === active;
          return (
            <motion.button
              type="button"
              key={s.number}
              className={`services-list-item${isActive ? ' active' : ''}`}
              onClick={() => select(i)}
              aria-pressed={isActive}
              initial={reduceMotion ? undefined : { opacity: 0, x: -28 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: EASE, delay: reduceMotion ? 0 : 0.12 + i * 0.09 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            >
              <span className="services-list-row">
                <span className="services-list-name">{s.name}</span>
                <span className="services-list-icon">
                  <img loading="lazy" src={isActive ? '/services/arrow-corner-active.svg' : '/services/arrow-corner.svg'} alt="" />
                </span>
              </span>
              <img loading="lazy"
                className="services-list-divider"
                src={isActive ? '/services/divider-active.svg' : '/services/divider.svg'}
                alt=""
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
