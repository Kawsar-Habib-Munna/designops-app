import "../home.css";
import { pageMeta } from "@/lib/seo";
import "./work-list.css";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { driveFullImageUrl } from "@/lib/driveUpload";
import { fetchSiteSettings, buildWhatsappUrl, BOOK_CALL_MESSAGE } from "@/lib/siteSettings";
import { interStats, nunito, playfair } from "@/app/fonts";
import LandingNav from "@/app/components/LandingNav";
import LandingFooter from "@/app/components/LandingFooter";
import RevealOnScroll from "@/app/components/RevealOnScroll";
import SlideSwapLabel from "@/app/components/SlideSwapLabel";
import { type ProjectCard } from "@/app/components/ProjectsCarousel";
import WorkProjectList from "./WorkProjectList";

// পাবলিক Project লিস্টিং পেজ — Figma "Flow 53 Web" (node 2718:5073, "Project
// Section") অনুযায়ী। প্রজেক্ট কার্ড হোমপেজের ProjectsCarousel.tsx-এর
// ProjectMiniCard হুবহু রিইউজ করে (আগে থেকেই light-themed, এই পেজের সাথে
// পিক্সেল-ম্যাচ) - এখানে শুধু carousel-এর জোড়া-কার্ড স্ট্যাকিং-এর বদলে
// category-ট্যাব + সাধারণ পেজিনেটেড লিস্ট (WorkProjectList.tsx)। একই
// case_studies ডেটা, হোমপেজের fetchCaseStudies()-এর সাথে হুবহু মেলানো কুয়েরি।
// force-dynamic-এর বদলে ISR (homepage-এর মতোই) - ৬০ সেকেন্ড ক্যাশড HTML সার্ভ
// করে, নতুন/এডিট করা case study সর্বোচ্চ ৬০ সেকেন্ড পরে লাইভ হয়।
export const revalidate = 60;

export const metadata = pageMeta(
  "Projects — Flow53",
  "Explore our selected projects where strategy, creativity, and user-centered design come together to solve real-world problems.",
  "/work",
);

type CaseStudyRow = {
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  tags: string[] | null;
  cover_image: string | null;
};

async function fetchCaseStudies(): Promise<CaseStudyRow[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("case_studies")
      .select("slug, title, category, summary, tags, cover_image")
      .eq("published", true)
      .order("order_index");
    return (data as CaseStudyRow[]) ?? [];
  } catch {
    return [];
  }
}

export default async function WorkPage() {
  const [caseStudies, settings] = await Promise.all([fetchCaseStudies(), fetchSiteSettings()]);
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  const projects: ProjectCard[] = caseStudies.map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    summary: p.summary,
    tags: p.tags,
    cover: p.cover_image ? driveFullImageUrl(p.cover_image, 960) : null,
  }));

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav bookCallUrl={bookCallUrl} />

      <div className="home-body">
        <header className="wp-hero">
          <div className="wp-hero-inner">
            <div className="wp-hero-card reveal">
              <span className="wp-breadcrumb">
                <span className="wp-breadcrumb-icon">
                  <img src="/work/icon-breadcrumb-case.svg" alt="" />
                </span>
                <span className="wp-breadcrumb-label">
                  <span className="dim">Home</span>
                  <span className="bright">/Project</span>
                </span>
              </span>
              <h1 className="wp-hero-title">Ideas Into Impactful Digital Experiences</h1>
              <p className="wp-hero-desc">Explore our selected projects where strategy, creativity, and user-centered design come together to solve real-world problems.</p>
            </div>
          </div>
        </header>

        <section className="section" style={{ background: "#ffffff" }}>
          <div className="wp-inner">
            <div className="wp-heading-row reveal">
              <div className="wp-heading">
                <span className="wp-eyebrow">PROJECTS</span>
                <h2 className="wp-title">Let&rsquo;s Look At What We&rsquo;ve Built!</h2>
              </div>
              <p className="wp-heading-desc">Discover digital products that transform challenges into engaging solutions.</p>
            </div>

            <WorkProjectList projects={projects} />
          </div>
        </section>

        <section className="section cta-final-section" id="contact">
          <div className="cta-final-inner reveal">
            <div className="cta-final-card">
              <div className="cta-final-deco" aria-hidden="true">
                <span className="cta-deco-badge cta-deco-figma">
                  <img loading="lazy" src="/cta/icon-figma.svg" alt="" />
                </span>
                <img loading="lazy" src="/cta/icon-xd-a.svg" alt="" className="cta-deco-plain cta-deco-xd" />
                <img loading="lazy" src="/cta/icon-spiral.svg" alt="" className="cta-deco-plain cta-deco-spiral" />
                <img loading="lazy" src="/cta/icon-sunburst.svg" alt="" className="cta-deco-plain cta-deco-sunburst" />
                <img loading="lazy" src="/cta/icon-framer.svg" alt="" className="cta-deco-plain cta-deco-framer" />
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
                  <h2 className="cta-final-title">Have Something Worth Building?</h2>
                  <p className="cta-final-lead">
                    Tell us what you&rsquo;re thinking, where you&rsquo;re stuck, or what you want to improve. We&rsquo;ll help you turn the next idea into
                    something worth experiencing.
                  </p>
                </div>
              </div>

              <div className="cta-final-buttons">
                <a href="/client/register" className="cta-final-btn primary">
                  <span className="cta-final-btn-inner">
                    <SlideSwapLabel text="Start A Project" />
                  </span>
                  <img loading="lazy" src="/cta/icon-arrow.svg" alt="" className="cta-final-btn-icon" />
                </a>
                <a href={bookCallUrl} target="_blank" rel="noopener noreferrer" className="cta-final-btn secondary">
                  <span className="cta-final-btn-inner">
                    <SlideSwapLabel text="Book A Call" />
                  </span>
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
          <img loading="lazy" src="/brand/logo-band.webp" alt="" className="brand-band-img" />
        </section>

        <LandingFooter settings={settings} />
      </div>

      <RevealOnScroll />
    </div>
  );
}
