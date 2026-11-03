import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';

// Manrope for the whole client dashboard: loaded once here (self-hosted by next/font) and exposed as --font-manrope
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });

// ক্লায়েন্ট পোর্টালের কোনো পেজ সার্চ ইঞ্জিনে ইনডেক্স হবে না। robots.txt-এ ইচ্ছে করে
// /client ব্লক করা হয়নি — ব্লক করলে ক্রলার এই noindex ট্যাগ দেখতেই পেত না।
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className={manrope.variable} style={{ display: 'contents' }}>{children}</div>;
}
