'use client';

// হিরো টাইটেল একবার (page load-এ) কেউ টাইপ করছে এমন effect-এ অক্ষর ধরে ধরে বসে -
// page.tsx একটা Server Component, তাই এই setInterval/state-টুকু আলাদা client
// কম্পোনেন্টে সরানো হয়েছে (RevealOnScroll-এর মতোই প্যাটার্ন)। মাঝের "Create"
// শব্দটা italic <em> স্টাইলে থাকা দরকার, তাই পুরো স্ট্রিংটা তিন ভাগে (আগে/em/পরে)
// ভেঙে total char-count থেকে প্রতিটা অংশ কতটুকু দেখানো হবে তা হিসাব করা হয়।

import { useEffect, useState } from 'react';

const PRE = 'We Design And Build Digital Products That ';
const EM = 'Create';
const POST = ' Impact!';
const FULL_LEN = PRE.length + EM.length + POST.length;
const MS_PER_CHAR = 38;

// reduced-motion প্রেফারেন্স থাকলে effect-এর ভেতর সিঙ্ক্রোনাসভাবে setState কল না
// করে (react-hooks/set-state-in-effect ভাঙে - ProcessStory.tsx-এও আগে একই কারণে
// ভেঙেছিল), useState-এর lazy initializer-এই সরাসরি পুরো দৈর্ঘ্য বসানো হয়।
function initialCount() {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return FULL_LEN;
  }
  return 0;
}

export default function HeroTitleTyped() {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (count >= FULL_LEN) return;
    let i = count;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= FULL_LEN) clearInterval(id);
    }, MS_PER_CHAR);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preShown = PRE.slice(0, Math.min(count, PRE.length));
  const emShown = EM.slice(0, Math.max(0, Math.min(count - PRE.length, EM.length)));
  const postShown = POST.slice(0, Math.max(0, count - PRE.length - EM.length));

  return (
    <h1 className="hero-title" aria-label={`${PRE}${EM}${POST}`}>
      <span aria-hidden="true">
        {preShown}
        <em>{emShown}</em>
        {postShown}
        {count < FULL_LEN && <span className="hero-title-cursor" />}
      </span>
    </h1>
  );
}
