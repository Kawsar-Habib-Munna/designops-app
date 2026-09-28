'use client';

// ল্যান্ডিং পেজ ও প্রতিটা কেস স্টাডি ডিটেইল পেজ (/work/[slug]) — দুটোতেই একই ফুটার
// শেয়ার করা হয়। Figma "Flow 53 Web" (node 1037:4585 / 1037:4587) অনুযায়ী রিবিল্ড:
// Newsletter + সোশ্যাল আইকন, Quick Links/Services/Contact তিন কলাম, তারপর
// কপিরাইট + পেমেন্ট কার্ড বার। ফোন/ইমেইল/ঠিকানা FAQ সেকশনের (app/page.tsx) সাথে
// মেলানো real তথ্য। সোশ্যাল আইকনগুলো এখনো non-clickable — company-র real
// Behance/Dribbble/LinkedIn/Facebook/Instagram/X প্রোফাইল লিংক না থাকা পর্যন্ত
// ভুয়া "#" href বসানো হয়নি (আগের ফুটারেও এই একই নীতি মানা হয়েছিল)। Newsletter
// সাবস্ক্রাইব ফর্মেরও এখনো কোনো ব্যাকএন্ড নেই (কোনো /api/newsletter route এই
// রিপোতে নেই) — তাই সাবমিটে শুধু রিলোড আটকানো হয়, fake success দেখানো হয় না।
import Link from 'next/link';
import { useState } from 'react';

const WHATSAPP_CALL_URL = 'https://wa.me/8801979291001';
const CONTACT_EMAIL = 'flow53@gmail.com';
const CONTACT_ADDRESS = '5/A, Dhaka, Bangladesh';

const QUICK_LINKS = [
  { label: 'Project', href: '/#work' },
  { label: 'About', href: '/#about' },
  { label: 'Process', href: '/#process' },
  { label: 'Review', href: '/#reviews' },
  { label: 'Contact', href: '/#contact' },
];

const SERVICES = ['UI UX Design', 'Web & App Design', 'Web Development', 'Logo & Branding', 'Digital Marketing'];

function ArrowIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="footer-subscribe-icon">
      <path
        d="M12.45 3.2c.27-.27.72-.27 1 0l8.35 8.3c.13.13.2.3.2.5s-.07.36-.2.5l-8.35 8.3c-.28.27-.72.27-1 0-.27-.27-.27-.7 0-.97l7.15-7.11H2a.71.71 0 010-1.42h17.4l-7.15-7.1c-.27-.28-.27-.71 0-.99z"
        fill="#EFE6FD"
      />
    </svg>
  );
}

function BehanceIcon() {
  return <img src="/footer/social-be.svg" alt="" className="footer-social-icon" />;
}
function DribbbleIcon() {
  return <img src="/footer/social-dribbble.svg" alt="" className="footer-social-icon" />;
}
function FacebookIcon() {
  return <img src="/footer/social-facebook.svg" alt="" className="footer-social-icon" />;
}
function TwitterIcon() {
  return <img src="/footer/social-twitter.svg" alt="" className="footer-social-icon" />;
}
function LinkedinIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="footer-social-icon">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#ADA8B4" strokeWidth="1.5" />
      <circle cx="8" cy="8.5" r="1.15" fill="#ADA8B4" />
      <path d="M8 11v6" stroke="#ADA8B4" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 17v-3.6c0-1.32 1-2.4 2.25-2.4S16.5 12.08 16.5 13.4V17" stroke="#ADA8B4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17v-6" stroke="#ADA8B4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="footer-social-icon">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#ADA8B4" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4.2" stroke="#ADA8B4" strokeWidth="1.5" />
      <circle cx="17.1" cy="6.9" r="1.05" fill="#ADA8B4" />
    </svg>
  );
}

const SOCIALS = [
  { name: 'Behance', Icon: BehanceIcon },
  { name: 'Dribbble', Icon: DribbbleIcon },
  { name: 'LinkedIn', Icon: LinkedinIcon },
  { name: 'Facebook', Icon: FacebookIcon },
  { name: 'Instagram', Icon: InstagramIcon },
  { name: 'X (Twitter)', Icon: TwitterIcon },
];

export default function LandingFooter() {
  const [email, setEmail] = useState('');

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-divider" />

        <div className="footer-main-wrap">
          <div className="footer-gutter-line" aria-hidden="true" />
          <button type="button" className="footer-scroll-top" onClick={scrollToTop} aria-label="উপরে যান">
            <img src="/footer/icon-scroll-top.svg" alt="" />
          </button>

          <div className="footer-main reveal">
            <div className="footer-brand-col">
            <div className="footer-newsletter-block">
              <div className="footer-newsletter-copy">
                <p className="footer-heading">
                  Join Our <em>Newsletter</em>
                </p>
                <p className="footer-desc">Flow 53 is a UI/UX design and development agency helping ambitious businesses transform ideas into intuitive, scalable digital products.</p>
              </div>
              <form className="footer-subscribe" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  required
                  placeholder="Your valid email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="footer-subscribe-input"
                  aria-label="আপনার ইমেইল ঠিকানা"
                />
                <button type="submit" className="footer-subscribe-btn">
                  <span className="footer-subscribe-label">Subscribe</span>
                  <ArrowIcon />
                </button>
              </form>
            </div>

            <div className="footer-socials">
              {SOCIALS.map(({ name, Icon }) => (
                <span key={name} className="footer-social-btn" role="img" aria-label={name}>
                  <Icon />
                </span>
              ))}
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-link-col">
              <p className="footer-col-heading">Quick Links</p>
              <div className="footer-col-items">
                {QUICK_LINKS.map((l) => (
                  <Link key={l.label} href={l.href} className="footer-col-link">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="footer-link-col">
              <p className="footer-col-heading">Services</p>
              <div className="footer-col-items">
                {SERVICES.map((s) => (
                  <span key={s} className="footer-col-item">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="footer-link-col footer-contact-col">
              <p className="footer-col-heading">Contact and Notice</p>
              <div className="footer-contact-rows">
                <a href={WHATSAPP_CALL_URL} target="_blank" rel="noopener noreferrer" className="footer-contact-row">
                  <span className="footer-contact-icon">
                    <img src="/footer/icon-call.svg" alt="" />
                  </span>
                  <span className="footer-contact-text">+088 01979 291 001</span>
                </a>
                <a href={`mailto:${CONTACT_EMAIL}`} className="footer-contact-row">
                  <span className="footer-contact-icon">
                    <img src="/footer/icon-mail.svg" alt="" />
                  </span>
                  <span className="footer-contact-text">{CONTACT_EMAIL}</span>
                </a>
                <div className="footer-contact-row">
                  <span className="footer-contact-icon">
                    <img src="/footer/icon-pin.svg" alt="" />
                  </span>
                  <span className="footer-contact-text">{CONTACT_ADDRESS}</span>
                </div>
                <div className="footer-notice-links">
                  <span className="footer-notice-text">Privacy Policy</span>
                  <span className="footer-notice-text">Terms &amp; Conditions</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div className="footer-bottom-wrap">
          <div className="footer-divider" />

          <div className="footer-bottom">
            <span className="footer-copyright">
              <img src="/footer/copyright-dot.svg" alt="©" /> {new Date().getFullYear()} Flow 53. All Rights Reserved.
            </span>
            <div className="footer-payment-cards" role="img" aria-label="আমরা bKash, PayPal, Visa, MasterCard এবং American Express গ্রহণ করি">
              <img src="/footer/payment/bkash.svg" alt="" className="footer-payment-icon footer-payment-bkash" />
              <img src="/footer/payment/paypal.svg" alt="" className="footer-payment-icon" />
              <img src="/footer/payment/visa.svg" alt="" className="footer-payment-icon" />
              <img src="/footer/payment/mastercard.svg" alt="" className="footer-payment-icon" />
              <img src="/footer/payment/amex.svg" alt="" className="footer-payment-icon" />
            </div>
          </div>

          <div className="footer-divider" />
        </div>
      </div>
    </footer>
  );
}
