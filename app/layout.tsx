import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AuthHashRedirect from "./components/AuthHashRedirect";
import { SITE_URL } from "@/lib/siteUrl";

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
  title: "FLOW 53 — UI/UX Design & Development Agency",
  description:
    "FLOW 53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "FLOW 53",
    locale: "en_US",
    title: "FLOW 53 — UI/UX Design & Development Agency",
    description:
      "FLOW 53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FLOW 53 — UI/UX Design & Development Agency",
    description:
      "FLOW 53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products your customers will love.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <AuthHashRedirect />
        {children}
      </body>
    </html>
  );
}
