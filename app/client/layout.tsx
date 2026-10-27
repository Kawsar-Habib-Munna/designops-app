import type { Metadata } from 'next';

// ক্লায়েন্ট পোর্টালের কোনো পেজ সার্চ ইঞ্জিনে ইনডেক্স হবে না। robots.txt-এ ইচ্ছে করে
// /client ব্লক করা হয়নি — ব্লক করলে ক্রলার এই noindex ট্যাগ দেখতেই পেত না।
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return children;
}
