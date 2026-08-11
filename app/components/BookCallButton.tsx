// হিরো ও দুটো CTA-band-এ ব্যবহৃত "Book a call" বাটন — তিন জায়গায় আলাদা করে
// আইকন+লিংক ডুপ্লিকেট না রেখে একটাই শেয়ার্ড কম্পোনেন্ট। কোনো interactivity/hook
// নেই, তাই Server Component-এও (app/page.tsx, app/work/[slug]/page.tsx)
// নিরাপদে সরাসরি ব্যবহার করা যায় — 'use client' লাগে না।
const WHATSAPP_URL = 'https://chat.whatsapp.com/E8RvWQSXPPp691V7odTwwl';

export default function BookCallButton({ className = 'hero-book-btn' }: { className?: string }) {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={className}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="book-call-icon" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      Book a call
    </a>
  );
}
