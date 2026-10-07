'use client';

import { useState } from 'react';

// FAQ প্রশ্নগুলো Figma ফাইলে যেভাবে আছে ঠিক সেভাবে (node 931:3646) - প্রথমটা
// ডিফল্ট খোলা, বাকিগুলো বন্ধ। Figma-তে শুধু প্রথম প্রশ্নের answer টেক্সট ছিল;
// বাকি ৫টার answer সাইটের বিদ্যমান কনটেন্ট (Services/Process সেকশন ইত্যাদি)-এর
// সাথে মিলিয়ে লেখা হয়েছে।

const FAQS = [
  {
    q: 'What services does Flow 53 offer?',
    a: 'We offer UI/UX Design, Web App Design, Web Development, Brand Identity Design, and SEO & Digital Growth to help businesses create meaningful digital experiences.',
  },
  {
    q: 'What types of projects do you work on?',
    a: 'We work on web apps, mobile apps, SaaS platforms, e-commerce stores, dashboards, and brand identity projects — for startups building their first product as well as established businesses redesigning an existing one.',
  },
  {
    q: 'Can you redesign an existing product?',
    a: 'Yes. We audit your current product, identify where users or business goals are falling short, and redesign it with the same care as a brand-new build — without losing what already works.',
  },
  {
    q: 'How does your design process work?',
    a: 'We follow five steps: Discover (understand the business, users and problem), Define (find opportunities and set direction), Design (flows, wireframes and high-fidelity interfaces), Develop (turn designs into a working product), and Launch (test, refine and ship with confidence).',
  },
  {
    q: 'How long does a project usually take?',
    a: 'It depends on scope — a focused redesign can take a few weeks, while a full product build usually takes a couple of months. We always share a clear timeline before work begins, once we understand your project.',
  },
  {
    q: 'How can I start a project with Flow 53?',
    a: 'Just hit "Start A Project" or "Book A Call" on this page. We’ll set up a quick call to understand your goals, then follow up with a proposal and timeline.',
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq-card">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <div className={`faq-item${isOpen ? ' open' : ''}`}>
              <button type="button" className="faq-item-head" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                <span className="faq-item-q">{item.q}</span>
                <span className="faq-item-icon">
                  <img src={isOpen ? '/faq/chevron-up.svg' : '/faq/chevron-down.svg'} alt="" />
                </span>
              </button>
              {isOpen && item.a && <p className="faq-item-a">{item.a}</p>}
            </div>
            {i < FAQS.length - 1 && <span className={`faq-divider${i === open ? ' active' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
