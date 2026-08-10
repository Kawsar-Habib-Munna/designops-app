'use client';

// পেজের `.reveal` ক্লাসধারী সেকশনগুলো স্ক্রল করে ভিউপোর্টে এলে ফেড-ইন হয় —
// এই কম্পোনেন্ট নিজে কিছু রেন্ডার করে না, শুধু mount হওয়ার পর
// IntersectionObserver বসিয়ে দেয় (landing পেজ একটা Server Component, তাই এই
// effect-টুকু আলাদা client কম্পোনেন্টে সরানো হয়েছে)।

import { useEffect } from 'react';

export default function RevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll('.home-root .reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
