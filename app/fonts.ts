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

// Nunito Sans Bold (700) — শেয়ার্ড `nunito` শুধু 400/500/600 লোড করে, তাই 700 চাইলে
// ব্রাউজার 600-এ নেমে আসে (500-এর সাথে প্রায় একই দেখায়)। সব পেজে 700 যোগ করলে অন্য
// পেজের টেক্সটও বদলে যেত, তাই আলাদা ভ্যারিয়েবলে — এখন শুধু /process ব্যবহার করে।
export const nunitoBold = Nunito_Sans({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-nunito-bold",
  display: "swap",
});
