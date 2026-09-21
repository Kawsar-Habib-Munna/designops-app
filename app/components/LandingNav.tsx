'use client';

// ল্যান্ডিং পেজের নেভবার — Figma "Flow 53 Web" (node 364:9422) অনুযায়ী তিনটা আলাদা
// glass pill: বামে লোগো, মাঝে মেনু, ডানে "Book A Call"। ১০২০px-এর নিচে মাঝের মেনু
// হ্যামবার্গারে চলে যায়। Figma-তে "Blog" মেনু আছে কিন্তু সাইটে এখনো ব্লগ সেকশন/পেজ
// নেই, তাই ওটা ক্লিক করলে কোথাও যায় না (মরা লিংক বানানো হয়নি)।

import { useEffect, useState } from 'react';
import { WHATSAPP_URL } from './BookCallButton';

type NavItem = { label: string; target: string | null };

const LINKS: NavItem[] = [
  { label: 'Home', target: '#top' },
  { label: 'Service', target: '#services' },
  { label: 'Project', target: '#work' },
  { label: 'About', target: '#team' },
  { label: 'Blog', target: null },
  { label: 'Contact', target: '#contact' },
];

const SPY_IDS = ['services', 'work', 'team', 'contact'];

function PhoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nav-phone-grad" x1="22" y1="12" x2="2" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#6200EE" />
        </linearGradient>
      </defs>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="url(#nav-phone-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('Home');

  useEffect(() => {
    function onScroll() {
      let current = 'Home';
      for (const id of SPY_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 180) {
          current = LINKS.find((l) => l.target === `#${id}`)?.label ?? current;
        }
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function goTo(item: NavItem) {
    if (!item.target) return;
    setOpen(false);
    if (item.target === '#top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.querySelector(item.target)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <nav className="nav" id="top">
      <div className="nav-inner">
        <a
          href="#top"
          className="nav-pill nav-logo"
          aria-label="FLOW 53"
          onClick={(e) => { e.preventDefault(); goTo(LINKS[0]); }}
        >
          <span className="nav-logo-art">
            <img src="/nav-logo-mark.svg" alt="" className="nav-logo-mark" />
            <img src="/nav-logo-text.svg" alt="FLOW 53" className="nav-logo-text" />
            <span className="nav-logo-tagline">Innovate-Design-Elevate</span>
          </span>
        </a>

        <div className="nav-pill nav-links">
          {LINKS.map((l) => (
            <button
              key={l.label}
              type="button"
              className={`nav-link${active === l.label ? ' active' : ''}`}
              onClick={() => goTo(l)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="nav-right">
          <div className="nav-pill nav-cta-pill">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">
              <span className="nav-cta-label">Book A Call</span>
              <PhoneIcon />
            </a>
          </div>
          <button
            type="button"
            className="nav-pill nav-menu-btn"
            aria-label="মেনু"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <div className={`nav-mobile-panel${open ? ' open' : ''}`}>
        {LINKS.map((l) => (
          <button
            key={l.label}
            type="button"
            className={`nav-mobile-link${active === l.label ? ' active' : ''}`}
            onClick={() => goTo(l)}
          >
            {l.label}
          </button>
        ))}
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="nav-mobile-link nav-mobile-cta">
          Book A Call
        </a>
      </div>
    </nav>
  );
}
