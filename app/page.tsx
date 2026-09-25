import { Inter, Nunito_Sans, Playfair_Display } from 'next/font/google';
import './home.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveThumbnailUrl, driveFullImageUrl } from '@/lib/driveUpload';
import LandingNav from '@/app/components/LandingNav';
import LandingFooter from '@/app/components/LandingFooter';
import BookCallButton from '@/app/components/BookCallButton';
import RevealOnScroll from '@/app/components/RevealOnScroll';
import ServicesShowcase from '@/app/components/ServicesShowcase';
import ProjectsCarousel from '@/app/components/ProjectsCarousel';

// পাবলিক ল্যান্ডিং পেজ — লগইন ছাড়াই সবাই দেখে, তাই profiles টেবিলের RLS
// (শুধু authenticated ইউজার read করতে পারে) এই পেজের জন্য প্রযোজ্য না। এটা
// একটা Server Component, তাই service-role client দিয়ে সরাসরি সার্ভারে
// টিমের real ডেটা আনা হয় (Team পেজের মতোই আসল নাম/রোল/ছবি) — কোনো secret
// ব্রাউজারে যায় না। Team সেকশন সম্পূর্ণ dynamic রাখতে (কেউ যোগ/বাদ হলে বা
// প্রোফাইল পাল্টালে সাথে সাথে পরের ভিজিটেই দেখা যায়) ক্যাশ/ISR ছাড়াই প্রতিটা
// রিকোয়েস্টে fresh ডেটা আনা হয়।
export const dynamic = 'force-dynamic';

const interStats = Inter({ subsets: ['latin'], weight: ['500'], variable: '--font-inter-stats', display: 'swap' });
const nunito = Nunito_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-nunito', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-playfair', display: 'swap' });

const STATS_TOP = [
  { label: 'Experience', value: '02+' },
  { label: 'Project Complete', value: '19+' },
];
const STATS_BOTTOM = [
  { label: 'Satisfied Clients', value: '12+' },
  { label: 'Countries Reached', value: '04+' },
  { label: 'Achievements', value: '03+' },
];

function StatCircle({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-circle">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <img src="/stats/arrow.svg" alt="" className="stat-arrow" />
    </div>
  );
}

// Work সেকশনের প্রজেক্টগুলো আগে কোডে হার্ডকোড করা placeholder ছিল, এখন
// app-এর ভেতরের /portfolio পেজ থেকে টিম যেই কেস স্টাডি publish করে সেটাই
// এখানে (এবং /work/[slug]-এ ফুল কেস স্টাডি হিসেবে) দেখা যায়।
type CaseStudyCard = { slug: string; title: string; category: string | null; summary: string | null; tags: string[] | null; cover_image: string | null };

async function fetchCaseStudies(): Promise<CaseStudyCard[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('case_studies')
      .select('slug, title, category, summary, tags, cover_image')
      .eq('published', true)
      .order('order_index');
    return (data as CaseStudyCard[]) ?? [];
  } catch {
    return [];
  }
}

const SERVICES_LIST = ['UI / UX Design', 'Frontend Design', 'SaaS Design'];

// Figma (682:677) alternates each icon's tilt and fades exactly two of the seven (not a
// simple first/last pattern) - reproduced as given rather than normalized into a rule.
const ABOUT_TOOLS = [
  { src: '/about/tool-1.svg', rotate: -16, faded: true },
  { src: '/about/tool-2.svg', rotate: 16, faded: false },
  { src: '/about/tool-3.svg', rotate: -16, faded: false },
  { src: '/about/tool-4.svg', rotate: 0, faded: true },
  { src: '/about/tool-5.svg', rotate: 16, faded: false },
  { src: '/about/tool-6.svg', rotate: -16, faded: false },
  { src: '/about/tool-7.svg', rotate: 16, faded: false },
];

const PROCESS_STEPS = [
  { name: 'Discover', desc: 'Research & a clear problem statement.', image: '/Discover.jpg' },
  { name: 'Design', desc: 'Wireframes to high-fidelity UI.', image: '/Design.jpg' },
  { name: 'Test', desc: 'Real users, real tasks.', image: '/Test.jpg' },
  { name: 'Deliver', desc: 'Clean specs & a working system.', image: '/Deliver.jpg' },
];

type TeamMember = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url: string | null; behance_url: string | null; linkedin_url: string | null };

async function fetchTeam(): Promise<TeamMember[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('profiles')
      .select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url')
      .order('created_at');
    return (data as TeamMember[]) ?? [];
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY লোকাল/প্রিভিউ এনভায়রনমেন্টে সেট না থাকলেও
    // পুরো ল্যান্ডিং পেজ যেন ক্র্যাশ না করে
    return [];
  }
}

export default async function Home() {
  const [team, caseStudies] = await Promise.all([fetchTeam(), fetchCaseStudies()]);

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav />

      <div className="home-body">
      <header className="hero">
        <div className="hero-fig">
          <img className="hero-fig-bg" src="/hero/bg.webp" alt="" aria-hidden="true" />

          <div className="hero-fig-inner">
            <div className="hero-trust">
              <span className="hero-trust-label">Trusted By</span>
              <span className="hero-trust-avatars">
                <img src="/hero/avatar-1.png" alt="" />
                <img src="/hero/avatar-2.png" alt="" />
                <img src="/hero/avatar-3.png" alt="" />
                <img src="/hero/avatar-4.png" alt="" />
                <span className="hero-trust-plus"><img src="/hero/plus.svg" alt="" /></span>
              </span>
              <span className="hero-trust-divider"></span>
              <span className="hero-trust-rating">
                <img src="/hero/star.svg" alt="" className="hero-trust-star" />
                <span className="hero-trust-score">4.5</span>
                <span className="hero-trust-word">Rating</span>
              </span>
            </div>

            <h1 className="hero-title">
              We Design And Build Digital Products That <em>Create</em> Impact!
            </h1>

            <p className="hero-sub">
              Flow 53 is a UI/UX design and development agency helping ambitious businesses transform ideas into intuitive, scalable digital products.
            </p>

            <div className="hero-actions">
              <a href="#contact" className="hero-start">
                <span className="hero-start-label">Start A Project</span>
                <img src="/hero/cta-arrows.svg" alt="" className="hero-start-icon" />
              </a>
              <a href="#work" className="hero-view">
                <span className="hero-view-play">
                  <span className="hero-view-ring hero-view-ring-1"></span>
                  <span className="hero-view-ring hero-view-ring-2"></span>
                  <span className="hero-view-ring hero-view-ring-3"></span>
                  <img src="/hero/play.svg" alt="" className="hero-view-play-icon" />
                </span>
                <span className="hero-view-label">
                  View Work
                  <img src="/hero/arrow-ne.svg" alt="" />
                </span>
              </a>
            </div>
          </div>

          <div className="hero-partners">
            <p className="hero-partners-title">Trusted By Partners</p>
            <div className="hero-partners-row">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <span className="hero-partner" key={n}>
                  <img src={`/hero/partner-${n}.svg`} alt="" />
                </span>
              ))}
            </div>
            <div className="hero-partners-fade"></div>
          </div>
        </div>
      </header>

      <section className="stats" id="numbers">
        <div className="stats-inner">
          <span className="stats-eyebrow">
            <img src="/stats/line.svg" alt="" />
            <span>TRUSTED GLOBALLY</span>
          </span>

          <div className="stats-body">
            <div className="stats-top">
              <StatCircle {...STATS_TOP[0]} />
              <div className="stats-heading">
                <h2 className="stats-title">Numbers That Speak!</h2>
                <p className="stats-desc">From thoughtful product decisions to polished digital experiences, here’s a quick look at what we’ve been building and learning along the way.</p>
              </div>
              <StatCircle {...STATS_TOP[1]} />
            </div>
            <div className="stats-bottom">
              {STATS_BOTTOM.map((s) => <StatCircle key={s.label} {...s} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="section services-showcase" id="services">
        <div className="services-inner reveal">
          <div className="services-heading">
            <span className="services-eyebrow">
              <img src="/stats/line.svg" alt="" />
              <span>Services</span>
            </span>
            <div className="services-heading-copy">
              <h2 className="services-title">What Can We Build Together?</h2>
              <p className="services-desc">Whether you&rsquo;re starting from an idea or improving an existing product, we help shape, design, and build experiences from strategy to launch.</p>
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
          <div className="projects-heading">
            <span className="projects-eyebrow">
              <img src="/stats/line.svg" alt="" />
              <span>Projects</span>
            </span>
            <div className="projects-heading-copy">
              <h2 className="projects-title">Let&rsquo;s Look At What We&rsquo;ve built!</h2>
              <p className="projects-desc">Discover digital products that transform challenges into engaging solutions.</p>
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
              cover: p.cover_image ? driveFullImageUrl(p.cover_image, 960) : null,
            }))}
          />
        </div>
      </section>

      <section className="section about-section" id="about">
        <div className="about-inner reveal">
          <div className="about-heading">
            <span className="about-eyebrow">
              <img src="/stats/line.svg" alt="" />
              <span>About Us</span>
            </span>
            <div className="about-heading-copy">
              <h2 className="about-title">So, Who Are We?</h2>
              <p className="about-desc">We&rsquo;re a design and development team passionate about solving complex problems, creating better experiences, and turning ideas into digital products people enjoy using.</p>
            </div>
          </div>

          <div className="about-body">
            <div className="about-photo-card">
              <div className="about-photo">
                <img src="/about/photo.webp" alt="The Flow 53 team collaborating around a whiteboard session" />
              </div>
              <div className="about-tools" aria-hidden="true">
                {ABOUT_TOOLS.map((t, i) => (
                  <span className={`about-tool${t.faded ? ' faded' : ''}`} key={i} style={{ transform: `rotate(${t.rotate}deg)` }}>
                    <img src={t.src} alt="" />
                  </span>
                ))}
              </div>
            </div>

            <div className="about-content">
              <p className="about-lead">
                <span className="about-lead-brand">Flow 53</span> is a design agency creating meaningful digital experiences that connect people and businesses. We combine user-centered design, technology, and creative problem-solving to transform ideas into intuitive applications and products. We work collaboratively to understand challenges and build purposeful solutions. Our goal is to create digital experiences that are thoughtful, seamless, and help businesses progress.
              </p>
              <div className="about-mission">
                <h3 className="about-mv-title">Our Mission</h3>
                <p className="about-mv-desc">To shape meaningful digital experiences that transform businesses and lives.</p>
              </div>
              <div className="about-vision">
                <h3 className="about-mv-title">Our Vision</h3>
                <p className="about-mv-desc">To transform complex ideas into simple, scalable digital solutions.</p>
              </div>
              <a href="#team" className="about-know-more">
                <span className="about-know-more-label">Know More</span>
                <img src="/about/arrow-know-more.svg" alt="" />
              </a>
            </div>
          </div>
        </div>

        <img className="about-deco about-deco-1" src="/about/deco2.svg" alt="" aria-hidden="true" />
        <img className="about-deco about-deco-2" src="/about/deco1.svg" alt="" aria-hidden="true" />
        <img className="about-deco about-deco-3" src="/about/deco4.svg" alt="" aria-hidden="true" />
        <img className="about-deco about-deco-4" src="/about/deco3.svg" alt="" aria-hidden="true" />
      </section>

      <section className="section process-section" id="process">
        <div className="container reveal">
          <h2 className="section-title">How an engagement runs.</h2>
          <div className="process-grid">
            {PROCESS_STEPS.map((s, i) => (
              <div className="process-card" key={s.name} style={{ backgroundImage: `url(${s.image})` }}>
                <div className="process-overlay"></div>
                <span className="process-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="process-name">{s.name}</div>
                <div className="process-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section services-section">
        <div className="container services-split reveal">
          <div className="collage-grid" aria-hidden="true">
            <div className="collage-col" style={{ marginTop: 30 }}>
              <div className="collage-img" style={{ height: 190, backgroundImage: 'url(/1.jpg)' }}></div>
              <div className="collage-img" style={{ height: 130, backgroundImage: 'url(/2.jpg)' }}></div>
            </div>
            <div className="collage-col">
              <div className="collage-img" style={{ height: 150, backgroundImage: 'url(/3.jpg)' }}></div>
              <div className="collage-img" style={{ height: 170, backgroundImage: 'url(/4.jpg)' }}></div>
            </div>
            <div className="collage-col" style={{ marginTop: 50 }}>
              <div className="collage-img" style={{ height: 160, backgroundImage: 'url(/5.jpg)' }}></div>
              <div className="collage-img" style={{ height: 130, backgroundImage: 'url(/6.jpg)' }}></div>
            </div>
          </div>
          <div>
            <div className="collage-services-title">Our Services</div>
            <div className="services-list-plain">
              {SERVICES_LIST.map((s, i) => (
                <div className="service-plain-item" key={s}>
                  <span className="service-plain-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="service-plain-name">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section team-section" id="team">
        <div className="container reveal">
          <h2 className="section-title" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 18 }}>Our Team</h2>
          {team.length === 0 ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: 13, marginTop: 20 }}>টিমের তথ্য এই মুহূর্তে লোড করা যায়নি।</p>
          ) : (
            <div className="team-grid" style={{ marginTop: 20 }}>
              {team.map((m) => {
                const img = m.avatar_url ? driveThumbnailUrl(m.avatar_url) : null;
                const initial = Array.from(m.full_name.trim())[0]?.toUpperCase() ?? '?';
                return (
                  <div className="team-card" key={m.id}>
                    <div
                      className="team-photo"
                      style={img ? { backgroundImage: `url(${img})` } : { background: m.avatar_color ?? 'var(--ink-faint)' }}
                    >
                      {!img && initial}
                    </div>
                    <div className="team-overlay-bar">
                      <div>
                        <div className="team-name">{m.full_name}</div>
                        <div className="team-title">{m.role ?? 'Team Member'}</div>
                      </div>
                      {(m.behance_url || m.linkedin_url) && (
                        <div className="team-socials">
                          {m.behance_url && (
                            <a className="team-social-btn" href={m.behance_url} target="_blank" rel="noopener noreferrer" aria-label={`${m.full_name}-এর Behance`}>
                              Be
                            </a>
                          )}
                          {m.linkedin_url && (
                            <a className="team-social-btn" href={m.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label={`${m.full_name}-এর LinkedIn`}>
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

      <section className="cta-band" id="contact">
        <div className="container reveal">
          <h2 className="cta-band-title">Got a product that deserves better design?</h2>
          <BookCallButton />
        </div>
      </section>

      <LandingFooter />
      </div>

      <RevealOnScroll />
    </div>
  );
}
