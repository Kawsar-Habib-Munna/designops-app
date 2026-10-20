import { Inter, Nunito_Sans, Playfair_Display } from "next/font/google";

// home.css জুড়ে font-family: var(--font-playfair)/var(--font-nunito)/
// var(--font-inter-stats) রেফারেন্স করা হয় - এই তিনটা CSS ভ্যারিয়েবল Next-এর
// font loader-এর .variable ক্লাসনেম দিয়েই সেট হয়, অন্য কোথাও না। আগে এই তিনটা
// শুধু app/page.tsx-এ লোকালি define হতো, তাই app/work/[slug]/page.tsx আর
// app/services/page.tsx-এ এই ভ্যারিয়েবলগুলো আদৌ সেট হতো না - ওই পেজগুলোতে
// Playfair/Nunito-র বদলে ব্রাউজারের ডিফল্ট ফলব্যাক ফন্ট (serif/sans-serif)
// দেখাত। এখন একটা শেয়ার্ড মডিউল, .home-root ব্যবহার করা প্রতিটা পেজেই ইম্পোর্ট
// করা উচিত।
export const interStats = Inter({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-inter-stats",
  display: "swap",
});
export const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-nunito",
  display: "swap",
});
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
