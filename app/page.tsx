import "./home.css";
import Link from "next/link";
import { interStats, nunito, playfair } from "./fonts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { driveThumbnailUrl, driveFullImageUrl } from "@/lib/driveUpload";
import LandingNav from "@/app/components/LandingNav";
import JsonLd from "@/app/components/JsonLd";
import LandingFooter from "@/app/components/LandingFooter";
import { fetchSiteSettings, formatPhoneDisplay, buildWhatsappUrl, BOOK_CALL_MESSAGE } from "@/lib/siteSettings";
import RevealOnScroll from "@/app/components/RevealOnScroll";
import ServicesShowcase from "@/app/components/ServicesShowcase";
import ProjectsCarousel from "@/app/components/ProjectsCarousel";
import ProcessStory from "@/app/components/ProcessStory";
import FaqAccordion from "@/app/components/FaqAccordion";
import ContactForm from "@/app/components/ContactForm";
import HeroTitleTyped from "@/app/components/HeroTitleTyped";
import BouncyStat from "@/app/components/BouncyStat";
import TestimonialsGrid from "@/app/components/TestimonialsGrid";
import WhyCardsGrid from "@/app/components/WhyCardsGrid";
import HeroIntro from "@/app/components/HeroIntro";
import ScrollRevealText from "@/app/components/ScrollRevealText";
import MouseTrail from "@/app/components/MouseTrail";
import SlideSwapLabel from "@/app/components/SlideSwapLabel";

// পাবলিক ল্যান্ডিং পেজ — লগইন ছাড়াই সবাই দেখে, তাই profiles টেবিলের RLS
// (শুধু authenticated ইউজার read করতে পারে) এই পেজের জন্য প্রযোজ্য না। এটা
// একটা Server Component, তাই service-role client দিয়ে সরাসরি সার্ভারে
// টিমের real ডেটা আনা হয় (Team পেজের মতোই আসল নাম/রোল/ছবি) — কোনো secret
// ব্রাউজারে যায় না। আগে force-dynamic ছিল (প্রতিটা রিকোয়েস্টে fresh DB
// ফেচ+SSR, TTFB ~300-600ms) - এখন ISR: প্রথম ভিজিটর DB ফেচ করে, তারপর
// পরের ৬০ সেকেন্ড বাকি সব ভিজিটর cached HTML পায় (~50-80ms)। Team/
// case-study/testimonial এডিট করলে নতুন ভার্সন সর্বোচ্চ ৬০ সেকেন্ড পরে লাইভ হয়।
export const revalidate = 60;

export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

const STATS_TOP = [
  { label: "Experience", value: "02+" },
  { label: "Project Complete", value: "19+" },
];
const STATS_BOTTOM = [
  { label: "Satisfied Clients", value: "12+" },
  { label: "Countries Reached", value: "04+" },
  { label: "Achievements", value: "03+" },
];

// Work সেকশনের প্রজেক্টগুলো আগে কোডে হার্ডকোড করা placeholder ছিল, এখন
// app-এর ভেতরের /portfolio পেজ থেকে টিম যেই কেস স্টাডি publish করে সেটাই
// এখানে (এবং /work/[slug]-এ ফুল কেস স্টাডি হিসেবে) দেখা যায়।
type CaseStudyCard = {
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  tags: string[] | null;
  cover_image: string | null;
};

async function fetchCaseStudies(): Promise<CaseStudyCard[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("case_studies")
      .select("slug, title, category, summary, tags, cover_image")
      .eq("published", true)
      .order("order_index");
    return (data as CaseStudyCard[]) ?? [];
  } catch {
    return [];
  }
}

const WHY_CARDS = [
  {
    icon: "/why/icon-strategy.png",
    title: "Strategy Before Screens",
    desc: "We understand user and business goals before designing.",
  },
  {
    icon: "/why/icon-user.png",
    title: "User-Centered Thinking",
    desc: "We design around real user needs to create clear, intuitive, and useful experiences.",
    alt: true,
  },
  {
    icon: "/why/icon-dev.png",
    title: "Design Meets Development",
    desc: "Design and development collaborate to create scalable, production-ready products.",
  },
  {
    icon: "/why/icon-purpose.png",
    title: "Purposeful Design",
    desc: "Every design choice serves a purpose, from structure to visuals.",
    alt: true,
  },
  {
    icon: "/why/icon-collab.png",
    title: "Collaborative Partnership",
    desc: "We collaborate with clients and keep projects moving.",
  },
  {
    icon: "/why/icon-grow.png",
    title: "Built to Grow",
    desc: "We create flexible digital systems that evolve with your business.",
    alt: true,
  },
];

const WHY_INDUSTRIES = [
  "FinTech",
  "SaaS",
  "E-commerce",
  "Healthcare",
  "Government",
  "Marketplace",
  "Education",
  "Business",
  "Travel",
  "Real Estate",
  "Foods",
  "Logistics",
];

// টেস্টিমোনিয়াল আগে এই ফাইলে ৪টা হার্ডকোড placeholder ছিল - এখন case_studies-এর
// মতোই /portfolio অ্যাডমিন পেজ থেকে ম্যানেজ করা হয় (TestimonialsGrid কম্পোনেন্ট)।
type TestimonialCard = {
  name: string;
  role: string;
  quote: string;
  rating: string;
  avatar_url: string | null;
};

async function fetchTestimonials(): Promise<TestimonialCard[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("testimonials")
      .select("name, role, quote, rating, avatar_url")
      .eq("published", true)
      .order("order_index");
    return (data as TestimonialCard[]) ?? [];
  } catch {
    return [];
  }
}

// অনুরোধে Team সেকশন সাময়িকভাবে পাবলিক পেজ থেকে hide করা হয়েছে - fetchTeam()
// ডেটা এখনো লোড হয়, শুধু সেকশনটা রেন্ডার হয় না; আবার দেখাতে true করলেই হবে।
const SHOW_TEAM_SECTION = false;

type TeamMember = {
  id: string;
  full_name: string;
  role: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  behance_url: string | null;
  linkedin_url: string | null;
};

async function fetchTeam(): Promise<TeamMember[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("profiles")
      .select(
        "id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url",
      )
      .order("created_at");
    return (data as TeamMember[]) ?? [];
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY লোকাল/প্রিভিউ এনভায়রনমেন্টে সেট না থাকলেও
    // পুরো ল্যান্ডিং পেজ যেন ক্র্যাশ না করে
    return [];
  }
}

export default async function Home() {
  const [team, caseStudies, testimonials, settings] = await Promise.all([
    fetchTeam(),
    fetchCaseStudies(),
    fetchTestimonials(),
    fetchSiteSettings(),
  ]);
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div
      className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}
    >
      <MouseTrail />
      <JsonLd settings={settings} />
      <LandingNav bookCallUrl={bookCallUrl} />

      <div className="home-body">
        <header className="hero">
          <HeroIntro />
          <div className="hero-fig">
            <img
              className="hero-fig-bg"
              src="/hero/bg.webp"
              alt=""
              aria-hidden="true"
            />

            <div className="hero-fig-inner">
              <div className="hero-trust">
                <span className="hero-trust-label">Trusted By</span>
                <span className="hero-trust-avatars">
                  <img src="/hero/avatar-1.png" alt="" />
                  <img src="/hero/avatar-2.png" alt="" />
                  <img src="/hero/avatar-3.png" alt="" />
                  <img src="/hero/avatar-4.png" alt="" />
                  <span className="hero-trust-plus">
                    <img src="/hero/plus.svg" alt="" />
                  </span>
                </span>
                <span className="hero-trust-divider"></span>
                <span className="hero-trust-rating">
                  <img
                    src="/hero/star.svg"
                    alt=""
                    className="hero-trust-star"
                  />
                  <span className="hero-trust-score">4.5</span>
                  <span className="hero-trust-word">Rating</span>
                </span>
              </div>

              <HeroTitleTyped />

              <p className="hero-sub">
                Flow 53 is a UI/UX design and development agency helping
                ambitious businesses transform ideas into intuitive, scalable
                digital products.
              </p>

              <div className="hero-actions">
                <a href="/client/register" className="hero-start">
                  <span className="hero-start-label"><SlideSwapLabel text="Start A Project" /></span>
                  <img
                    src="/hero/cta-arrows.svg"
                    alt=""
                    className="hero-start-icon"
                  />
                </a>
                <a href="#work" className="hero-view">
                  <span className="hero-view-play">
                    <span className="hero-view-ring hero-view-ring-1"></span>
                    <span className="hero-view-ring hero-view-ring-2"></span>
                    <span className="hero-view-ring hero-view-ring-3"></span>
                    <img
                      src="/hero/play.svg"
                      alt=""
                      className="hero-view-play-icon"
                    />
                  </span>
                  <span className="hero-view-label">
                    <SlideSwapLabel text="View Work" />
                    <img src="/hero/arrow-ne.svg" alt="" />
                  </span>
                </a>
              </div>
            </div>

            <div className="hero-partners">
              <p className="hero-partners-title">Trusted By Partners</p>
              <div className="hero-partners-row">
                <div className="hero-partners-track">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
                    <span className="hero-partner" key={i} aria-hidden={i >= 8}>
                      <img src={`/hero/partner-${n}.svg`} alt="" />
                    </span>
                  ))}
                </div>
              </div>
              <div className="hero-partners-fade"></div>
            </div>
          </div>
        </header>

        <section className="stats" id="numbers">
          <div className="stats-inner">
            <span className="stats-eyebrow">
              <img loading="lazy" src="/stats/line.svg" alt="" />
              <span>TRUSTED GLOBALLY</span>
            </span>

            <div className="stats-body">
              <div className="stats-top">
                <BouncyStat {...STATS_TOP[0]} index={0} />
                <div className="stats-heading">
                  <h2 className="stats-title">Numbers That Speak!</h2>
                  <p className="stats-desc">
                    From thoughtful product decisions to polished digital
                    experiences, here’s a quick look at what we’ve been building
                    and learning along the way.
                  </p>
                </div>
                <BouncyStat {...STATS_TOP[1]} index={1} />
              </div>
              <div className="stats-bottom">
                {STATS_BOTTOM.map((s, i) => (
                  <BouncyStat key={s.label} {...s} index={i + 2} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section services-showcase" id="services">
          <div className="services-inner reveal">
            <div className="services-heading">
              <span className="services-eyebrow">
                <img loading="lazy" src="/stats/line.svg" alt="" />
                <span>SERVICES</span>
              </span>
              <div className="services-heading-copy">
                <h2 className="services-title">What Can We Build Together?</h2>
                <ScrollRevealText
                  className="services-desc"
                  text="Whether you’re starting from an idea or improving an existing product, we help shape, design, and build experiences from strategy to launch."
                />
              </div>
            </div>
          </div>
          <div className="services-tabs-bleed reveal">
            <ServicesShowcase />
          </div>
        </section>

        <section className="section projects-section" id="work">
          <div className="projects-grid-lines" aria-hidden="true" />
          <div className="projects-inner reveal">
            <div className="projects-heading-row">
              <div className="projects-heading">
                <span className="projects-eyebrow">
                  <img loading="lazy" src="/stats/line.svg" alt="" />
                  <span>PROJECTS</span>
                </span>
                <div className="projects-heading-copy">
                  <h2 className="projects-title">
                    Let&rsquo;s Look At What We&rsquo;ve Built!
                  </h2>
                </div>
              </div>
              <div className="projects-desc-row">
                <p className="projects-desc">
                  Discover digital products that transform challenges into
                  engaging solutions.
                </p>
                <Link href="/work" className="projects-view-all">
                  <span className="projects-view-all-label">
                    <SlideSwapLabel text="View All Projects" />
                  </span>
                  <span className="projects-view-all-icon" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <ProjectsCarousel
              projects={caseStudies.map((p) => ({
                slug: p.slug,
                title: p.title,
                category: p.category,
                summary: p.summary,
                tags: p.tags,
                // Card displays this at 480px CSS width - 960 covers 2x retina without
                // paying for the full driveFullImageUrl default (sized for wider hero/gallery uses).
                cover: p.cover_image
                  ? driveFullImageUrl(p.cover_image, 960)
                  : null,
              }))}
            />
          </div>
        </section>

        <section className="section about-section" id="about">
          <div className="about-inner reveal">
            <div className="about-heading">
              <img loading="lazy"
                className="about-deco about-deco-1"
                src="/about/deco2.svg"
                alt=""
                aria-hidden="true"
              />
              <img loading="lazy"
                className="about-deco about-deco-3"
                src="/about/deco4.svg"
                alt=""
                aria-hidden="true"
              />
              <span className="about-eyebrow">
                <img loading="lazy" src="/stats/line.svg" alt="" />
                <span>ABOUT US</span>
              </span>
              <div className="about-heading-copy">
                <h2 className="about-title">So, Who Are We?</h2>
                <p className="about-desc">
                  We&rsquo;re a design and development team passionate about
                  solving complex problems, creating better experiences, and
                  turning ideas into digital products people enjoy using.
                </p>
              </div>
            </div>

            <div className="about-body">
              <div className="about-photo-card">
                <div className="about-photo">
                  <img loading="lazy"
                    src="/about/photo.webp"
                    alt="The Flow 53 team collaborating around a whiteboard session"
                  />
                </div>
                <img loading="lazy"
                  src="/about/flow-wordmark.png"
                  alt=""
                  className="about-watermark"
                  aria-hidden="true"
                />
              </div>

              <div className="about-content">
                <p className="about-lead">
                  <span className="about-lead-brand">Flow 53</span> is a design
                  agency creating meaningful digital experiences that connect
                  people and businesses. We combine user-centered design,
                  technology, and creative problem-solving to transform ideas
                  into intuitive applications and products. We work
                  collaboratively to understand challenges and build purposeful
                  solutions. Our goal is to create digital experiences that are
                  thoughtful, seamless, and help businesses progress.
                </p>
                <img loading="lazy"
                  className="about-deco about-deco-2"
                  src="/about/deco1.svg"
                  alt=""
                  aria-hidden="true"
                />
                <img loading="lazy"
                  className="about-deco about-deco-4"
                  src="/about/deco3.svg"
                  alt=""
                  aria-hidden="true"
                />
                <div className="about-mission">
                  <h3 className="about-mv-title">Our Mission</h3>
                  <p className="about-mv-desc">
                    To shape meaningful digital experiences that transform
                    businesses and lives.
                  </p>
                </div>
                <div className="about-vision">
                  <h3 className="about-mv-title">Our Vision</h3>
                  <p className="about-mv-desc">
                    To transform complex ideas into simple, scalable digital
                    solutions.
                  </p>
                </div>
                <a href="#team" className="about-know-more">
                  <span className="about-know-more-label"><SlideSwapLabel text="Know More" /></span>
                  <span className="about-know-more-icon" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section why-section">
          <div className="why-inner reveal">
            <div className="why-heading">
              <span className="why-eyebrow">
                <img loading="lazy" src="/stats/line.svg" alt="" />
                <span>WHY FLOW 53</span>
              </span>
              <div className="why-heading-copy">
                <h2 className="why-title">Why Work With Us?</h2>
                <p className="why-desc">
                  We look beyond the interface to understand the problem, align
                  with your goals, and create solutions that are thoughtful,
                  scalable, and built to make an impact.
                </p>
              </div>
            </div>

            <WhyCardsGrid cards={WHY_CARDS} />

            <div className="why-tailored">
              <div className="why-tailored-head">
                <h3 className="why-tailored-title">
                  Tailored For Various Industries
                </h3>
                <span className="why-tailored-line">
                  <img loading="lazy" src="/why/tailored-line.svg" alt="" />
                </span>
              </div>
              <div className="why-tags" aria-hidden="true">
                <div className="why-tags-track">
                  {[...WHY_INDUSTRIES, ...WHY_INDUSTRIES].map((name, i) => (
                    <span className="why-tag" key={i}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section process-section" id="process">
          <div className="process-inner reveal">
            <div className="process-heading">
              <span className="process-eyebrow">
                <img loading="lazy" src="/stats/line.svg" alt="" />
                <span>PROCESS</span>
              </span>
              <div className="process-heading-copy">
                <h2 className="process-title">
                  How Do We Bring Ideas To Life?
                </h2>
                <p className="process-lead">
                  From problem research to design, build, test and
                  launch&mdash;we follow a clear, collaborative process.
                </p>
              </div>
            </div>

            <ProcessStory />
          </div>
        </section>

        {testimonials.length > 0 && (
          <section className="section testimonials-section" id="reviews">
            <div className="testimonials-inner reveal">
              <div className="testimonials-heading">
                <span className="testimonials-eyebrow">
                  <img loading="lazy" src="/stats/line.svg" alt="" />
                  <span>TESTIMONIALS</span>
                </span>
                <div className="testimonials-heading-copy">
                  <h2 className="testimonials-title">
                    Don&rsquo;t Just Take Our Word For It!
                  </h2>
                  <p className="testimonials-lead">
                    Hear from the people we&rsquo;ve worked with and discover how
                    thoughtful collaboration, clear communication, and purposeful
                    design shaped their experience with us.
                  </p>
                </div>
              </div>

              <TestimonialsGrid
                testimonials={testimonials.map((t) => ({
                  name: t.name,
                  role: t.role,
                  quote: t.quote,
                  rating: t.rating,
                  avatar: t.avatar_url ? driveThumbnailUrl(t.avatar_url) : null,
                }))}
              />
            </div>
          </section>
        )}

        <section className="section faq-section">
          <div className="faq-inner reveal">
            <div className="faq-heading">
              <span className="faq-eyebrow">
                <img loading="lazy" src="/stats/line.svg" alt="" />
                <span>FAQ &amp; CONTACT</span>
              </span>
              <div className="faq-heading-copy">
                <h2 className="faq-title">
                  Got Questions? Let&rsquo;s Find Answers.
                </h2>
                <p className="faq-lead">
                  Whether you&rsquo;re curious about our services, process,
                  pricing, or timelines, you&rsquo;ll find quick answers below.
                  Still have questions? Just reach out&mdash;we&rsquo;re always
                  happy to chat.
                </p>
              </div>
            </div>

            <div className="faq-row">
              <div className="faq-col">
                <div className="faq-pill">Frequently Asked Questions</div>
                <FaqAccordion />
              </div>
              <div className="faq-col">
                <div className="faq-pill faq-pill-stroke">
                  Let&rsquo;s Work Together
                </div>
                <div className="contact-card">
                  <ContactForm whatsappNumber={settings.bookCallPhone} />
                </div>
              </div>
            </div>

            <div className="faq-contact-info">
              <div className="faq-contact-info-head">
                <h3 className="faq-contact-info-title">Feel Free Contact Us</h3>
                <span className="faq-contact-info-line">
                  <img loading="lazy" src="/faq/divider-line.svg" alt="" />
                </span>
              </div>
              <div className="faq-contact-cards">
                <a
                  className="faq-contact-card"
                  href={buildWhatsappUrl(settings.contactPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="faq-contact-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="faq-contact-icon-svg whatsapp"
                    >
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.07-1.32A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.5 8.2c.2-.45.4-.46.6-.47h.5c.17 0 .4-.06.62.48.23.55.78 1.9.85 2.04.07.14.12.3.02.49-.1.19-.15.3-.3.46-.15.16-.31.36-.44.48-.15.14-.3.29-.13.58.17.29.75 1.25 1.62 2.02 1.11.99 2.05 1.3 2.34 1.45.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.38-.24.64-.14.26.1 1.66.79 1.94.93.29.14.48.22.55.34.07.13.07.72-.17 1.41-.24.7-1.4 1.34-1.93 1.42-.5.08-1.12.11-1.81-.11-.42-.14-.95-.31-1.64-.61-2.88-1.25-4.76-4.15-4.9-4.34-.14-.2-1.17-1.56-1.17-2.98 0-1.42.75-2.11 1.02-2.4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span className="faq-contact-lines">
                    <span>{formatPhoneDisplay(settings.contactPhone)}</span>
                    <span>{formatPhoneDisplay(settings.bookCallPhone)}</span>
                  </span>
                </a>
                <a className="faq-contact-card" href={`mailto:${settings.contactEmail}`}>
                  <span className="faq-contact-icon">
                    <img loading="lazy" src="/faq/icon-email.svg" alt="" />
                  </span>
                  <span className="faq-contact-lines">
                    <span>{settings.contactEmail}</span>
                    <span>{settings.contactEmailSecondary}</span>
                  </span>
                </a>
                <div className="faq-contact-card faq-contact-card-wide">
                  <span className="faq-contact-icon">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="faq-contact-icon-svg location"
                    >
                      <path
                        d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="10"
                        r="2.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </span>
                  <span className="faq-contact-lines">
                    <span>{settings.addressLine1}</span>
                    <span>{settings.addressLine2}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section cta-final-section" id="contact">
          <div className="cta-final-inner reveal">
            <div className="cta-final-card">
              <div className="cta-final-deco" aria-hidden="true">
                <span className="cta-deco-badge cta-deco-figma">
                  <img loading="lazy" src="/cta/icon-figma.svg" alt="" />
                </span>
                <img loading="lazy"
                  src="/cta/icon-xd-a.svg"
                  alt=""
                  className="cta-deco-plain cta-deco-xd"
                />
                <img loading="lazy"
                  src="/cta/icon-spiral.svg"
                  alt=""
                  className="cta-deco-plain cta-deco-spiral"
                />
                <img loading="lazy"
                  src="/cta/icon-sunburst.svg"
                  alt=""
                  className="cta-deco-plain cta-deco-sunburst"
                />
                <img loading="lazy"
                  src="/cta/icon-framer.svg"
                  alt=""
                  className="cta-deco-plain cta-deco-framer"
                />
                <span className="cta-deco-badge cta-deco-illustrator">
                  <img loading="lazy" src="/cta/icon-illustrator.svg" alt="" />
                </span>
              </div>
              <div className="cta-final-heading">
                <span className="cta-final-eyebrow">
                  <img loading="lazy" src="/stats/line.svg" alt="" />
                  <span>CALL TO ACTION</span>
                </span>
                <div className="cta-final-heading-copy">
                  <h2 className="cta-final-title">
                    Have Something Worth Building?
                  </h2>
                  <p className="cta-final-lead">
                    Tell us what you&rsquo;re thinking, where you&rsquo;re
                    stuck, or what you want to improve. We&rsquo;ll help you
                    turn the next idea into something worth experiencing.
                  </p>
                </div>
              </div>

              <div className="cta-final-buttons">
                <a href="/client/register" className="cta-final-btn primary">
                  <span className="cta-final-btn-inner"><SlideSwapLabel text="Start A Project" /></span>
                  <img loading="lazy"
                    src="/cta/icon-arrow.svg"
                    alt=""
                    className="cta-final-btn-icon"
                  />
                </a>
                <a
                  href={bookCallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cta-final-btn secondary"
                >
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

        {SHOW_TEAM_SECTION && (
          <section className="section team-section" id="team">
            <div className="container reveal">
              <h2
                className="section-title"
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: 18,
                }}
              >
                Our Team
              </h2>
              {team.length === 0 ? (
                <p
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 13,
                    marginTop: 20,
                  }}
                >
                  টিমের তথ্য এই মুহূর্তে লোড করা যায়নি।
                </p>
              ) : (
                <div className="team-grid" style={{ marginTop: 20 }}>
                  {team.map((m) => {
                    const img = m.avatar_url
                      ? driveThumbnailUrl(m.avatar_url)
                      : null;
                    const initial =
                      Array.from(m.full_name.trim())[0]?.toUpperCase() ?? "?";
                    return (
                      <div className="team-card" key={m.id}>
                        <div
                          className="team-photo"
                          style={
                            img
                              ? { backgroundImage: `url(${img})` }
                              : {
                                  background:
                                    m.avatar_color ?? "var(--ink-faint)",
                                }
                          }
                        >
                          {!img && initial}
                        </div>
                        <div className="team-overlay-bar">
                          <div>
                            <div className="team-name">{m.full_name}</div>
                            <div className="team-title">
                              {m.role ?? "Team Member"}
                            </div>
                          </div>
                          {(m.behance_url || m.linkedin_url) && (
                            <div className="team-socials">
                              {m.behance_url && (
                                <a
                                  className="team-social-btn"
                                  href={m.behance_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`${m.full_name}-এর Behance`}
                                >
                                  Be
                                </a>
                              )}
                              {m.linkedin_url && (
                                <a
                                  className="team-social-btn"
                                  href={m.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`${m.full_name}-এর LinkedIn`}
                                >
                                  in
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="brand-band" aria-hidden="true">
          <img loading="lazy" src="/brand/logo-band.webp" alt="" className="brand-band-img" />
        </section>

        <LandingFooter settings={settings} />
      </div>

      <RevealOnScroll />
    </div>
  );
}
