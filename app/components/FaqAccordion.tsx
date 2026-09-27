'use client';

import { useState } from 'react';

// FAQ items ও কনটেন্ট Figma ফাইলে যেভাবে আছে ঠিক সেভাবে (node 931:3646) - প্রথমটা
// ডিফল্ট খোলা, বাকিগুলো বন্ধ। এখানে useState দিয়ে টগল করা - Figma-তে শুধু প্রথম
// আইটেমের "খোলা" ভিজ্যুয়াল স্টেট দেখানো ছিল, বাকি ৫টার answer টেক্সট ফাইলে নেই,
// তাই সেগুলো একবার খোলা হলে শুধু প্রশ্নটাই দেখা যায় (কোনো ভুল answer বানিয়ে বসানো হয়নি)।

const FAQS = [
  {
    q: 'What services does Flow 53 offer?',
    a: 'We offer UI/UX Design, Web App Design, Web Development, Brand Identity Design, and SEO & Digital Growth to help businesses create meaningful digital experiences.',
  },
  { q: 'What types of projects do you work on?', a: null },
  { q: 'Can you redesign an existing product?', a: null },
  { q: 'How does your design process work?', a: null },
  { q: 'How long does a project usually take?', a: null },
  { q: 'How can I start a project with Flow 53?', a: null },
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
            {i < FAQS.length - 1 && <span className="faq-divider" />}
          </div>
        );
      })}
    </div>
  );
}
