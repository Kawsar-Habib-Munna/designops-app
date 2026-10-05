'use client';

// ল্যান্ডিং পেজের নেভবার — Figma "Flow 53 Web" (node 364:9422) অনুযায়ী তিনটা আলাদা
// glass pill (মেনুর active হাইলাইট framer-motion layoutId দিয়ে এক আইটেম থেকে আরেকটায় স্লাইড করে): বামে লোগো, মাঝে মেনু, ডানে "Book A Call"। ১০২০px-এর নিচে মাঝের মেনু
// হ্যামবার্গারে চলে যায়। পঞ্চম আইটেম আগে ছিল "Blog" (কোনো ব্লগ সেকশন/পেজ না থাকায়
// মরা লিংক) — Figma node 309:2845 চেক করে দেখা গেল ডিজাইন আপডেট হয়ে এখন
// "Process" (পেজের বিদ্যমান #process সেকশনে স্ক্রল করে), তাই সেই অনুযায়ী ঠিক
// করা হলো (2026-10-05)।

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { WHATSAPP_URL } from './BookCallButton';

type NavItem = { label: string; target: string | null };

const LINKS: NavItem[] = [
  { label: 'Home', target: '#top' },
  { label: 'Service', target: '#services' },
  { label: 'Project', target: '#work' },
  { label: 'About', target: '#about' },
  { label: 'Process', target: '#process' },
  { label: 'Contact', target: '#contact' },
];

const SPY_IDS = ['services', 'work', 'about', 'process', 'team', 'contact'];

// Figma node I309:2741;304:2069 ("hugeicons:call-ringing-04") — real asset
// path, downloaded and inlined exactly (fill #EFE6FD, no stroke/gradient).
// আগে এখানে একটা হাত-দিয়ে-আঁকা সাধারণ ফোন-হ্যান্ডসেট stroke-icon ছিল, আসল
// Figma asset-টা আসলে রিং-হওয়া ফোনের (ছোট সাউন্ড-ওয়েভ চিহ্নসহ) ভিন্ন filled icon।
function PhoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.1426 3.82025C17.5391 3.82025 17.8659 3.81942 18.1348 3.84076C18.4112 3.86272 18.6609 3.9096 18.9033 4.02044L18.9141 4.0263C19.4488 4.28623 19.8625 4.74236 20.0694 5.29974L20.0733 5.30951C20.2388 5.78802 20.1812 6.27797 20.1153 6.96283C19.7347 10.9061 18.4573 14.0179 16.2364 16.2392C14.0154 18.4604 10.9046 19.7385 6.96194 20.1191C6.27769 20.1851 5.78778 20.2426 5.30862 20.0771L5.29788 20.0732C4.74112 19.8662 4.28524 19.4521 4.02542 18.9179L4.02054 18.9072C3.90984 18.6644 3.86281 18.4143 3.84085 18.1376C3.81952 17.8686 3.81936 17.542 3.81936 17.1454C3.81936 16.6246 3.81498 16.2573 3.91702 15.9238H3.91604C4.03707 15.5267 4.26846 15.1713 4.58206 14.8993C4.84552 14.6708 5.18301 14.5269 5.65725 14.3154H5.65823L6.43167 13.9716C6.94592 13.7433 7.30695 13.5752 7.68557 13.539C8.03002 13.5059 8.37793 13.5546 8.70022 13.6806C8.9656 13.7843 9.20124 13.9557 9.48538 14.1874L9.78909 14.4394C10.2706 14.8403 10.4266 14.9603 10.6055 15.0263C10.7985 15.092 11.0038 15.1133 11.2061 15.0878C11.3942 15.0598 11.5398 14.9887 12.0098 14.7372C13.3271 14.0328 14.0301 13.33 14.7344 12.0126C14.9837 11.5456 15.0568 11.3982 15.086 11.2099C15.112 11.0069 15.0912 10.8001 15.0254 10.6064C14.9594 10.4273 14.8377 10.272 14.4366 9.78997L14.1846 9.48626C13.9531 9.20219 13.7814 8.96653 13.6778 8.70111C13.5521 8.37917 13.5041 8.03087 13.5371 7.68646C13.5733 7.30888 13.7413 6.94717 13.9698 6.43255L14.3125 5.65911V5.65814L14.461 5.32708C14.6014 5.01953 14.726 4.77967 14.8975 4.58197C15.1693 4.26865 15.5242 4.03894 15.9209 3.9179L15.9199 3.91693C16.2537 3.81456 16.6223 3.82025 17.1426 3.82025ZM17.1426 4.82025C16.5569 4.82025 16.369 4.82511 16.2129 4.87298V4.87396C15.9958 4.94017 15.8011 5.06573 15.6524 5.23724V5.23822C15.5451 5.36209 15.4652 5.53029 15.2266 6.06536L14.8838 6.83783C14.6261 7.41846 14.5491 7.6053 14.5323 7.78216C14.5142 7.97018 14.5406 8.16146 14.6094 8.33783C14.6744 8.50414 14.799 8.66289 15.2051 9.15033C15.5644 9.58207 15.8268 9.88538 15.9658 10.2665L15.9688 10.2753C16.0863 10.6166 16.1234 10.9808 16.0772 11.3388L16.0762 11.3476C16.0175 11.7457 15.8472 12.0526 15.6172 12.4833H15.6162C14.8186 13.9754 13.9734 14.8213 12.4815 15.6191C12.0524 15.8487 11.7442 16.0212 11.3457 16.079L11.3379 16.08C10.9792 16.1262 10.6143 16.0879 10.2725 15.9697V15.9706L10.2637 15.9667C9.88396 15.8277 9.58086 15.5679 9.14846 15.2079V15.207C8.66246 14.8011 8.50234 14.6772 8.33596 14.6122L8.2012 14.5683C8.06464 14.5327 7.92248 14.5215 7.78128 14.5351L7.64065 14.5605C7.48645 14.6011 7.27301 14.6921 6.83694 14.8857L6.0635 15.2294V15.2285C5.52848 15.4671 5.36116 15.5477 5.23733 15.6552C5.06587 15.8039 4.93927 15.9986 4.87307 16.2158L4.84475 16.3447C4.82311 16.4904 4.81936 16.7057 4.81936 17.1454C4.81936 17.5575 4.82044 17.8381 4.83792 18.0585C4.85444 18.2666 4.88476 18.3886 4.92776 18.4853C5.07505 18.7849 5.33091 19.0167 5.64358 19.1337C5.86853 19.2092 6.10914 19.197 6.86624 19.124C10.6472 18.759 13.5157 17.546 15.5293 15.5322C17.5429 13.5182 18.7552 10.6488 19.1201 6.86712C19.1929 6.1115 19.2062 5.8707 19.1319 5.6474C19.0151 5.33297 18.7824 5.07537 18.4815 4.92767C18.3854 4.88475 18.2639 4.85437 18.0557 4.83783C17.8354 4.82034 17.5547 4.82025 17.1426 4.82025ZM6.67093 9.30853C6.94691 9.30871 7.17093 9.5325 7.17093 9.80853C7.17073 10.0844 6.94679 10.3083 6.67093 10.3085H4.31936C4.04336 10.3085 3.81956 10.0845 3.81936 9.80853C3.81936 9.5324 4.04324 9.30855 4.31936 9.30853H6.67093ZM5.53323 5.53509C5.72852 5.33986 6.04503 5.3398 6.24026 5.53509L7.80764 7.10247C8.00274 7.29778 8.00289 7.6153 7.80764 7.81048C7.61235 8.00513 7.29568 8.00448 7.10061 7.80951L5.53323 6.24212C5.33814 6.04697 5.33836 5.73036 5.53323 5.53509ZM9.80569 3.82025C10.0818 3.82025 10.3057 4.0441 10.3057 4.32025V6.67279C10.3053 6.94858 10.0816 7.17279 9.80569 7.17279C9.52982 7.17276 9.3061 6.94856 9.30569 6.67279V4.32025C9.30569 4.04412 9.52957 3.82027 9.80569 3.82025Z"
        fill="#EFE6FD"
      />
    </svg>
  );
}

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('Home');
  const [scrolled, setScrolled] = useState(false);
  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
      if (lockRef.current) {
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => { lockRef.current = false; }, 140);
        return;
      }
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
    setActive(item.label);
    lockRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => { lockRef.current = false; }, 900);
    if (item.target === '#top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.querySelector(item.target)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="top">
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
              {active === l.label && (
                <motion.span
                  layoutId="active-nav-item"
                  className="nav-link-bg"
                  style={{ borderRadius: 8 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="nav-link-text">{l.label}</span>
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
