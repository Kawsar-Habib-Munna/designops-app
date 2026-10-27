import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AuthHashRedirect from "./components/AuthHashRedirect";
import { SITE_URL } from "@/lib/siteUrl";
import { INTRO_SEEN_KEY } from "@/lib/introSeen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Flow53 — UI/UX Design & Development Agency",
  description:
    "Flow53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Flow53",
    locale: "en_US",
    title: "Flow53 — UI/UX Design & Development Agency",
    description:
      "Flow53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flow53 — UI/UX Design & Development Agency",
    description:
      "Flow53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* repeat visit: mark <html> before first paint so the hero loader never flashes (see HeroIntro.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem('${INTRO_SEEN_KEY}')==='1')document.documentElement.classList.add('intro-seen')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <AuthHashRedirect />
        {children}
      </body>
    </html>
  );
}
