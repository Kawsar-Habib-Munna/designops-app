import { Fragment } from "react";
import { pageMeta } from "@/lib/seo";
import "../home.css";
import "./about.css";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { driveThumbnailUrl } from "@/lib/driveUpload";
import { fetchSiteSettings, buildWhatsappUrl, BOOK_CALL_MESSAGE } from "@/lib/siteSettings";
import { interStats, nunito, playfair } from "@/app/fonts";
import LandingNav from "@/app/components/LandingNav";
import LandingFooter from "@/app/components/LandingFooter";
import RevealOnScroll from "@/app/components/RevealOnScroll";
import SlideSwapLabel from "@/app/components/SlideSwapLabel";
import BouncyStat from "@/app/components/BouncyStat";

// পাবলিক About পেজ — Figma "Flow 53 Web" (node 2497:2041, "About") অনুযায়ী
// বানানো। হোমপেজেরই "So, Who Are We?"/stats/about/mission-vision কনটেন্টের
// একটা পূর্ণাঙ্গ ডেডিকেটেড ভার্সন (হোমপেজে শুধু একটা সংক্ষিপ্ত teaser থাকে)। Stats
// সেকশনটা app/page.tsx-এর সাথে হুবহু মিলিয়ে কপি করা (একই ক্লাস/ডেটা), CTA
// band/brand-band/footer-ও app/services/page.tsx-এর মতোই হোমপেজ থেকে হুবহু
// কপি — সাইটজুড়ে সামঞ্জস্যপূর্ণ রাখতে। Team সেকশন app/page.tsx-এর (আপাতত hidden)
// team-section থেকে আলাদা, নতুন কার্ড ডিজাইন (ছবি+৪টা সোশ্যাল আইকন+নাম/রোল/বায়ো)
// — কিন্তু একই ডেটা সোর্স (profiles টেবিল, ProfileMenu থেকে প্রতিটা মেম্বার নিজের
// bio/facebook_url/instagram_url/behance_url/linkedin_url বসায়)।
// force-dynamic-এর বদলে ISR (homepage-এর মতোই) - ৬০ সেকেন্ড ক্যাশড HTML সার্ভ
// করে, Team প্রোফাইল এডিট সর্বোচ্চ ৬০ সেকেন্ড পরে লাইভ হয়।
export const revalidate = 60;

export const metadata = pageMeta(
  "About — FLOW 53",
  "We're a design and development team passionate about solving complex problems, creating better experiences, and turning ideas into digital products people enjoy using.",
  "/about",
);

// হোমপেজের 2-top/3-bottom circular-badge লেআউটের থেকে ভিন্ন — এই পেজের Figma
// ডিজাইনে stats সাজানো 3-then-2 সারিতে, প্লেইন label+number+arrow (কোনো সার্কেল
// না)।
const STATS_ROW_1 = [
  { label: "Experience", value: "02+" },
  { label: "Satisfied Clients", value: "12+" },
  { label: "Countries Reached", value: "04+" },
];
const STATS_ROW_2 = [
  { label: "Project Complete", value: "19+" },
  { label: "Achievements", value: "03+" },
];

type TeamMember = {
  id: string;
  full_name: string;
  role: string | null;
  bio: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  behance_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

async function fetchTeam(): Promise<TeamMember[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, role, bio, avatar_color, avatar_url, behance_url, linkedin_url, facebook_url, instagram_url")
      .order("order_index");
    // bio/facebook_url/instagram_url কলাম তিনটা sql/schema.sql-এ যোগ হয়েছে কিন্তু
    // Supabase-এ migration না চালালে এই select ভেঙে যাবে (column does not
    // exist) - আগে এই এরর নিঃশব্দে গিলে ফেলা হতো, টিম সেকশন কোনো কারণ ছাড়াই
    // খালি দেখাত। এখন সার্ভার লগে দেখা যাবে কেন।
    if (error) {
      console.error("fetchTeam failed:", error.message);
      return [];
    }
    return (data as TeamMember[]) ?? [];
  } catch {
    return [];
  }
}

export default async function AboutPage() {
  const [team, settings] = await Promise.all([fetchTeam(), fetchSiteSettings()]);
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav bookCallUrl={bookCallUrl} />

      <div className="home-body">
        <header className="abt-hero">
          <div className="abt-hero-inner">
            <div className="abt-hero-card reveal">
              <span className="abt-breadcrumb">
                <span className="abt-breadcrumb-icon">
                  <img src="/about/icon-breadcrumb-case.svg" alt="" />
                </span>
                <span className="abt-breadcrumb-label">
                  <span className="dim">Home</span>
                  <span className="bright">/About</span>
                </span>
              </span>
              <h1 className="abt-hero-title">So, Who Are We?</h1>
              <p className="abt-hero-desc">
                We&rsquo;re a design and development team passionate about solving complex problems, creating better experiences, and turning ideas into
                digital products people enjoy using.
              </p>
            </div>
          </div>
        </header>

        <section className="abt-section abt-stats" id="numbers">
          <div className="abt-inner">
            <div className="abt-stats-heading reveal">
              <span className="abt-eyebrow">TRUSTED GLOBALLY</span>
              <h2 className="abt-stats-title">Numbers That Speak!</h2>
            </div>

            <div className="abt-stats-row reveal">
              {STATS_ROW_1.map((s, i) => (
                <Fragment key={s.label}>
                  {i > 0 && <span className="abt-stats-divider" aria-hidden="true" />}
                  <BouncyStat {...s} index={i} variant="plain" />
                </Fragment>
              ))}
            </div>
            <div className="abt-stats-row abt-stats-row-2 reveal">
              {STATS_ROW_2.map((s, i) => (
                <Fragment key={s.label}>
                  {i > 0 && <span className="abt-stats-divider" aria-hidden="true" />}
                  <BouncyStat {...s} index={i + STATS_ROW_1.length} variant="plain" />
                </Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="abt-section">
          <div className="abt-inner">
            <div className="abt-about-row reveal">
              <div className="abt-about-image">
                <div className="abt-about-image-inner">
                  <img loading="lazy" src="/about/about-office-photo.jpg" alt="The Flow 53 team collaborating around a whiteboard session" />
                </div>
                <img loading="lazy" src="/about/about-logo-overlay.png" alt="" className="abt-about-logo" aria-hidden="true" />
              </div>

              <div className="abt-about-text">
                <div className="abt-about-heading">
                  <span className="abt-eyebrow">About</span>
                  <h2 className="abt-about-title">About Us At A Glance!</h2>
                </div>
                <div className="abt-about-copy">
                  <p>
                    <span className="abt-about-brand">Flow 53</span> Flow 53 is a design agency creating meaningful digital experiences that connect people
                    and businesses. We combine user-centered design, technology, and creative problem-solving to transform ideas into intuitive applications
                    and products. We work collaboratively to understand challenges and build purposeful solutions.
                  </p>
                  <p>
                    From early ideas to final experiences, we focus on every detail that shapes how people interact with a product. Our approach blends
                    strategy, research, visual design, and technology to create solutions that are not only visually engaging but also functional and
                    impactful.
                  </p>
                </div>
              </div>

              <div className="abt-mv-card mission">
                <div className="abt-mv-text">
                  <h3 className="abt-mv-title">Our Mission</h3>
                  <p className="abt-mv-desc">
                    We create meaningful digital experiences that transform businesses and lives. Our goal is to make technology more human, intuitive, and
                    accessible. Through thoughtful design and innovation, we simplify experiences, inspire connections, and drive growth. Together, we turn
                    ideas into purposeful digital solutions that make a difference.
                  </p>
                </div>
                <div className="abt-mv-image">
                  <img loading="lazy" src="/about/mission-compass.png" alt="" />
                </div>
              </div>

              <div className="abt-mv-card vision">
                <div className="abt-mv-text">
                  <h3 className="abt-mv-title">Our Vision</h3>
                  <p className="abt-mv-desc">
                    We shape meaningful digital experiences that transform businesses and lives. We make technology more human, intuitive, and accessible.
                    We create innovative solutions that inspire connection, simplify experiences, and drive growth. Together, we turn ideas into purposeful
                    digital experiences that make a lasting difference.
                  </p>
                </div>
                <div className="abt-mv-image">
                  <img loading="lazy" src="/about/vision-ladder.png" alt="" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="abt-section" id="team" style={{ paddingTop: 0 }}>
          <div className="abt-inner">
            {/* Figma-তে heading (eyebrow+title+desc) আর প্রথম টিম কার্ড (Tofael)
                একই সারিতে পাশাপাশি বসে - heading বাঁ কলামে, Tofael ডান কলামে,
                দুটোই একই y-তে। তাই এখানে heading-টাও গ্রিডের প্রথম আইটেম হিসেবে
                বসানো হলো (প্লেইন stacked block-এর বদলে) - CSS গ্রিডের ডিফল্ট
                auto-flow নিজে থেকেই প্রথম টিম কার্ডকে heading-এর পাশের
                (col2/row1) সেলে বসিয়ে দেয়, বাকি কার্ডগুলো পরের সারিগুলোতে
                স্বাভাবিকভাবে চলে যায় - কোনো ম্যানুয়াল blank-cell হ্যাক ছাড়াই,
                যেকোনো টিম সাইজের জন্য কাজ করে। */}
            <div className="abt-team-grid reveal">
              <div className="abt-team-heading">
                <span className="abt-eyebrow solid">Our Team</span>
                <h2 className="abt-team-title">Meet The Co-Founders And Team Behind Flow 53</h2>
                <p className="abt-team-desc">Meet the creative minds behind Flow 53, bringing together ideas, expertise, and passion to create meaningful digital experiences.</p>
              </div>

              {team.length === 0 ? (
                <p className="abt-team-empty">Team information isn&rsquo;t available right now.</p>
              ) : (
                <>
                {team.map((m) => {
                  const img = m.avatar_url ? driveThumbnailUrl(m.avatar_url) : null;
                  const initial = Array.from(m.full_name.trim())[0]?.toUpperCase() ?? "?";
                  const socials = [
                    { url: m.facebook_url, icon: "/about/icon-facebook.svg", label: "Facebook" },
                    { url: m.linkedin_url, icon: "/about/icon-linkedin.svg", label: "LinkedIn" },
                    { url: m.instagram_url, icon: "/about/icon-instagram.svg", label: "Instagram" },
                    { url: m.behance_url, icon: "/about/icon-behance.svg", label: "Behance" },
                  ].filter((s) => s.url);

                  return (
                    <div className="abt-team-card" key={m.id}>
                      <div className="abt-team-photo-wrap">
                        <div
                          className="abt-team-photo"
                          style={img ? { backgroundImage: `url(${img})` } : { background: m.avatar_color ?? "var(--ink-faint, #6e6e7a)" }}
                        >
                          {!img && initial}
                        </div>
                        {socials.length > 0 && (
                          <div className="abt-team-socials">
                            {socials.map((s) => (
                              <a key={s.label} className="abt-team-social-btn" href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={`${m.full_name}-এর ${s.label}`}>
                                <img loading="lazy" src={s.icon} alt="" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="abt-team-info">
                        <div className="abt-team-namerole">
                          <div className="abt-team-name">{m.full_name}</div>
                          <div className="abt-team-role">{m.role ?? "Team Member"}</div>
                        </div>
                        {m.bio && <p className="abt-team-bio">{m.bio}</p>}
                      </div>
                    </div>
                  );
                })}
                {/* Figma: শেষ মেম্বার (বিজোড় স্লটে একা) পাশে একটা সাজসজ্জামূলক
                    ছবি (ফুলের তোড়া + ডিজাইন টুল আইকন) - হেডিং (১টা) + মেম্বার
                    সংখ্যা জোড় হলেই গ্রিডে এই শেষ সেলটা খালি থাকে। */}
                {team.length % 2 === 0 && (
                  <div className="abt-team-card-deco" aria-hidden="true">
                    <img loading="lazy" src="/about/team-deco-bouquet.png" alt="" />
                  </div>
                )}
                </>
              )}
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
