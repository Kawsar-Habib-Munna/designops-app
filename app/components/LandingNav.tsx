'use client';

// ল্যান্ডিং পেজের নেভবার — scroll করলে হালকা বর্ডার/শ্যাডো যোগ হয়, আর ৮৬০px-এর
// নিচে (মোবাইল) হ্যামবার্গার মেনু হয়ে যায় (মকআপে এটা ছিল না — শুধু নেভ-লিংক
// হাইড হয়ে যেত, কোনো replacement ছাড়াই, যেটা মোবাইলে লিংকগুলো একেবারে
// অ্যাক্সেসযোগ্য না করে দিত)।

import { useEffect, useState } from 'react';

const LINKS: { href: string; label: string }[] = [
  { href: '#work', label: 'Work' },
  { href: '#process', label: 'Process' },
  { href: '#services', label: 'Services' },
  { href: '#team', label: 'Team' },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function goTo(href: string) {
    setOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#" className="nav-logo">
          FLOW<span className="stroke-53">53</span>
        </a>
        <div className="nav-links">
          {LINKS.map((l) => (
            <button key={l.href} className="nav-link" onClick={() => goTo(l.href)}>
              {l.label}
            </button>
          ))}
        </div>
        <a href="#contact" className="nav-cta" onClick={(e) => { e.preventDefault(); goTo('#contact'); }}>
          Start a project
        </a>
        <button className="nav-menu-btn" aria-label="মেনু" onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>
      </div>
      <div className={`nav-mobile-panel${open ? ' open' : ''}`}>
        {LINKS.map((l) => (
          <button key={l.href} className="nav-mobile-link" onClick={() => goTo(l.href)}>
            {l.label}
          </button>
        ))}
        <a href="#contact" className="nav-cta nav-mobile-cta" onClick={(e) => { e.preventDefault(); goTo('#contact'); }}>
          Start a project
        </a>
      </div>
    </nav>
  );
}
