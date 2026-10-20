import '../home.css';
import './services.css';
import { fetchSiteSettings, buildWhatsappUrl, BOOK_CALL_MESSAGE } from '@/lib/siteSettings';
import { interStats, nunito, playfair } from '@/app/fonts';
import LandingNav from '@/app/components/LandingNav';
import LandingFooter from '@/app/components/LandingFooter';
import RevealOnScroll from '@/app/components/RevealOnScroll';
import SlideSwapLabel from '@/app/components/SlideSwapLabel';

// পাবলিক Services পেজ — Figma "Flow 53 Web" (node 2463:4458, "Service Section")
// অনুযায়ী বানানো। হোমপেজের ServicesShowcase.tsx-এর একই ৫টা সার্ভিস (নাম/ইলাস্ট্রেশন
// অপরিবর্তিত, public/services/*.png রিইউজ করা হয়েছে), কিন্তু এখানে প্রতিটার
// নিজস্ব ডেডিকেটেড সেকশন (হেডিং+বিবরণ+৬টা ফিচার কার্ড+বাটন), zigzag image/text
// পজিশনে, কিন্তু প্রতিটা সেকশনের লেখা সবসময় বাঁ দিকে একই alignment-এ শুরু হয়
// (Figma-র আসল ডিজাইনে left/right alternate করত, কিন্তু সেটায় সেকশন থেকে
// সেকশনে লেখার শুরুর x-position লাফাতো - অনুরোধ অনুযায়ী এখানে consistent রাখা
// হয়েছে, শুধু ছবিটা ডান দিকে স্থির)। CTA band/brand-band/
// footer হোমপেজ (app/page.tsx) থেকে হুবহু কপি - একই কম্পোনেন্ট/ক্লাস, যাতে
// সাইটজুড়ে সামঞ্জস্যপূর্ণ থাকে। Figma-র কিছু বিবরণ টেক্সট আসল ফাইলেই অসম্পূর্ণ/মাঝ
// বাক্যে কাটা ছিল (যেমন "...make every") - সেগুলো এখানে সম্পূর্ণ বাক্য হিসেবে
// লেখা হয়েছে, একই টোন বজায় রেখে।
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Services — FLOW 53',
  description: 'How do we turn ideas into digital experiences? UI/UX design, web & app design, web development, brand identity, and digital marketing.',
};

type Feature = { title: string; desc: string };
type ServiceDetail = {
  eyebrow: string;
  title: string;
  desc: string;
  image: string;
  imageAlt: string;
  features: Feature[];
};

const SERVICES: ServiceDetail[] = [
  {
    eyebrow: 'UI/UX DESIGN',
    title: 'Turning Ideas Into Seamless Digital Experiences.',
    desc: "From mobile apps to web platforms, we create thoughtful UI/UX designs that simplify complexity and make every interaction feel effortless.",
    image: '/services/figma-01-ui-ux-design.png',
    imageAlt: 'UI/UX design work shown across laptop and mobile screens',
    features: [
      { title: 'User Research', desc: 'We analyze user needs to create meaningful experiences.' },
      { title: 'Wireframing', desc: 'We create clear wireframes and navigation.' },
      { title: 'UI Design', desc: 'We create clean, consistent interfaces.' },
      { title: 'Prototyping', desc: 'We create prototypes to refine user experiences.' },
      { title: 'Usability Testing', desc: 'We test designs to improve usability.' },
      { title: 'Design Systems', desc: 'Building components for scalable solutions.' },
    ],
  },
  {
    eyebrow: 'WEB AND APP DESIGN',
    title: 'Turning Ideas Into Stunning Websites.',
    desc: 'We craft responsive websites and apps that balance striking visuals with smooth, intuitive navigation.',
    image: '/services/figma-02-web-app-design.png',
    imageAlt: 'Web and app design mockups on a desktop screen',
    features: [
      { title: 'Website Design', desc: 'We create modern websites with clean designs.' },
      { title: 'Mobile App Design', desc: 'We create mobile apps for seamless use.' },
      { title: 'Landing Page Design', desc: 'We design landing pages for conversions.' },
      { title: 'Dashboard Design', desc: 'We simplify data workflows with dashboards.' },
      { title: 'AI Web & App Design', desc: 'We design AI interfaces for smarter interactions.' },
      { title: 'Website App Redesign', desc: 'We create user-focused digital products.' },
    ],
  },
  {
    eyebrow: 'WEB DEVELOPMENT',
    title: 'Turning Ideas Into Seamless Mobile Experiences.',
    desc: 'We build fast, secure, and scalable web solutions engineered to grow with your business.',
    image: '/services/figma-03-web-development.png',
    imageAlt: 'Web development work shown on a laptop screen',
    features: [
      { title: 'Frontend Development', desc: 'We design clean, responsive interfaces.' },
      { title: 'Backend Development', desc: 'We build secure backends for website reliability.' },
      { title: 'Database Management', desc: 'We manage data for secure web applications.' },
      { title: 'Website Optimization', desc: 'We optimize websites for faster loading.' },
      { title: 'CMS & API Integration', desc: 'We integrate CMS and APIs seamlessly.' },
      { title: 'Website Deployment', desc: 'We launch websites with secure hosting.' },
    ],
  },
  {
    eyebrow: 'LOGO AND BRANDING',
    title: 'Turning Ideas Into Memorable Brand Identities.',
    desc: 'We build cohesive brand identities that help your business stand out and stay memorable.',
    image: '/services/figma-04-brand-identity.png',
    imageAlt: 'Brand identity design work including logo and color palette',
    features: [
      { title: 'Logo Design', desc: "We design logos that reflect your brand's values." },
      { title: 'Brand Color Palette', desc: 'We select colors that enhance brand recognition.' },
      { title: 'Stationery Design', desc: 'We create stationery for brand consistency.' },
      { title: 'Packaging Design', desc: 'We design packaging that highlights your brand.' },
      { title: 'Social Media Branding', desc: 'We create visuals that enhance your brand.' },
      { title: 'Business Card Design', desc: 'We create impactful business cards.' },
    ],
  },
  {
    eyebrow: 'DIGITAL MARKETING',
    title: 'Turning Ideas Into Powerful Digital Marketing.',
    desc: 'We run data-driven marketing campaigns that grow your traffic and boost online visibility.',
    image: '/services/figma-05-digital-marketing.png',
    imageAlt: 'Digital marketing analytics shown on a tablet screen',
    features: [
      { title: 'SEO Optimization', desc: 'We optimize sites to boost rankings.' },
      { title: 'Keyword Research', desc: 'We find keywords to reach your audience.' },
      { title: 'Link Building', desc: 'We create backlinks to boost website authority.' },
      { title: 'Digital Ad Campaigns', desc: 'We create campaigns to boost reach and leads.' },
      { title: 'Marketing Analytics', desc: 'We analyze campaigns to improve results.' },
      { title: 'Social Media Marketing', desc: 'We grow your brand across social platforms.' },
    ],
  },
];

function ServiceButtons({ bookCallUrl }: { bookCallUrl: string }) {
  return (
    <div className="svc-buttons">
      <a href="/client/register" className="cta-final-btn primary">
        <span className="cta-final-btn-inner"><SlideSwapLabel text="Start A Project" /></span>
        <img src="/cta/icon-arrow.svg" alt="" className="cta-final-btn-icon" />
      </a>
      <a href={bookCallUrl} target="_blank" rel="noopener noreferrer" className="cta-final-btn secondary">
        <span className="cta-final-btn-inner"><SlideSwapLabel text="Book A Call" /></span>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="cta-final-btn-icon"
          aria-hidden="true"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
    </div>
  );
}

export default async function ServicesPage() {
  const settings = await fetchSiteSettings();
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav bookCallUrl={bookCallUrl} />

      <div className="home-body">
        <header className="svc-hero">
          <div className="svc-hero-inner">
            <div className="svc-hero-card reveal">
              <span className="svc-breadcrumb">
                <span className="svc-breadcrumb-icon">
                  <img src="/services/icon-breadcrumb-case.svg" alt="" />
                </span>
                <span className="svc-breadcrumb-label">Home/Service</span>
              </span>
              <h1 className="svc-hero-title">How Do We Turn Ideas Into Digital Experiences?</h1>
              <p className="svc-hero-desc">We create user-focused digital experiences through research, design, and development to bring your ideas to life.</p>
            </div>
          </div>
        </header>

        {SERVICES.map((s) => (
          <section className="svc-detail-section" key={s.eyebrow}>
            <div className="svc-detail-inner">
              <div className="svc-detail-row reveal">
                <div className="svc-detail-text">
                  <span className="cta-final-eyebrow">
                    <img src="/stats/line.svg" alt="" />
                    <span>{s.eyebrow}</span>
                  </span>
                  <div className="svc-detail-heading">
                    <h2 className="svc-detail-title">{s.title}</h2>
                    <p className="svc-detail-desc">{s.desc}</p>
                  </div>
                  <span className="svc-trusted-mini">
                    <span className="svc-trusted-mini-label">Trusted By:</span>
                    <span className="svc-trusted-mini-avatars">
                      <img src="/hero/avatar-1.png" alt="" />
                      <img src="/hero/avatar-2.png" alt="" />
                      <img src="/hero/avatar-3.png" alt="" />
                      <img src="/hero/avatar-4.png" alt="" />
                    </span>
                  </span>
                </div>
                <div className="svc-detail-image">
                  <img src={s.image} alt={s.imageAlt} />
                </div>
              </div>

              <div className="svc-feature-grid">
                {s.features.map((f) => (
                  <div className="svc-feature-card" key={f.title}>
                    <h3 className="svc-feature-title">{f.title}</h3>
                    <p className="svc-feature-desc">{f.desc}</p>
                  </div>
                ))}
              </div>

              <ServiceButtons bookCallUrl={bookCallUrl} />
            </div>
          </section>
        ))}

        <section className="section cta-final-section" id="contact">
          <div className="cta-final-inner reveal">
            <div className="cta-final-card">
              <div className="cta-final-deco" aria-hidden="true">
                <span className="cta-deco-badge cta-deco-figma">
                  <img src="/cta/icon-figma.svg" alt="" />
                </span>
                <img src="/cta/icon-xd-a.svg" alt="" className="cta-deco-plain cta-deco-xd" />
                <img src="/cta/icon-spiral.svg" alt="" className="cta-deco-plain cta-deco-spiral" />
                <img src="/cta/icon-sunburst.svg" alt="" className="cta-deco-plain cta-deco-sunburst" />
                <img src="/cta/icon-framer.svg" alt="" className="cta-deco-plain cta-deco-framer" />
                <span className="cta-deco-badge cta-deco-illustrator">
                  <img src="/cta/icon-illustrator.svg" alt="" />
                </span>
              </div>
              <div className="cta-final-heading">
                <span className="cta-final-eyebrow">
                  <img src="/stats/line.svg" alt="" />
                  <span>CALL TO ACTION</span>
                </span>
                <div className="cta-final-heading-copy">
                  <h2 className="cta-final-title">Have Something Worth Building?</h2>
                  <p className="cta-final-lead">
                    Tell us what you&rsquo;re thinking, where you&rsquo;re stuck, or what you want to improve. We&rsquo;ll help you
                    turn the next idea into something worth experiencing.
                  </p>
                </div>
              </div>

              <div className="cta-final-buttons">
                <a href="/client/register" className="cta-final-btn primary">
                  <span className="cta-final-btn-inner"><SlideSwapLabel text="Start A Project" /></span>
                  <img src="/cta/icon-arrow.svg" alt="" className="cta-final-btn-icon" />
                </a>
                <a href={bookCallUrl} target="_blank" rel="noopener noreferrer" className="cta-final-btn secondary">
                  <span className="cta-final-btn-inner"><SlideSwapLabel text="Book A Call" /></span>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="cta-final-btn-icon"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="brand-band" aria-hidden="true">
          <img src="/brand/logo-band.webp" alt="" className="brand-band-img" />
        </section>

        <LandingFooter settings={settings} />
      </div>

      <RevealOnScroll />
    </div>
  );
}
