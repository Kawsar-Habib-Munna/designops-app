import Link from 'next/link';
import { Inter, Nunito_Sans, Playfair_Display } from 'next/font/google';
import './home.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveThumbnailUrl, driveFullImageUrl } from '@/lib/driveUpload';
import LandingNav from '@/app/components/LandingNav';
import LandingFooter from '@/app/components/LandingFooter';
import BookCallButton from '@/app/components/BookCallButton';
import RevealOnScroll from '@/app/components/RevealOnScroll';

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
type CaseStudyCard = { slug: string; title: string; summary: string | null; tags: string[] | null; cover_image: string | null };

async function fetchCaseStudies(): Promise<CaseStudyCard[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('case_studies')
      .select('slug, title, summary, tags, cover_image')
      .eq('published', true)
      .order('order_index');
    return (data as CaseStudyCard[]) ?? [];
  } catch {
    return [];
  }
}

const SERVICES_HIRED = [
  { name: 'UX Research & Discovery', sub: 'Interviews · Journey Mapping', detail: 'User interviews, market research and journey mapping to uncover the real problem before we design a single screen.' },
  { name: 'UI Design', sub: 'Web · Mobile · Dashboards', detail: 'Pixel-perfect, responsive interfaces for web, mobile and dashboard products — built to convert and built to last.' },
  { name: 'Design Systems', sub: 'Tokens · Components', detail: 'Reusable component libraries and design tokens so your product stays consistent as your team and codebase grow.' },
  { name: 'Prototyping & Testing', sub: 'Figma · Usability Testing', detail: 'Interactive Figma prototypes validated with real users, so decisions are backed by evidence before a line of code is written.' },
  { name: 'Brand Identity', sub: 'Naming · Visual Identity', detail: 'Naming, logo, color and typography systems that give your product a voice people recognize and remember.' },
];

const SERVICES_LIST = ['UI / UX Design', 'Frontend Design', 'SaaS Design'];

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

      <section className="work-legacy">
        <div className="container">

          <div className="project-grid reveal" id="work">
            {caseStudies.map((p) => {
              const cover = p.cover_image ? driveFullImageUrl(p.cover_image) : null;
              return (
                <Link className="project-card" href={`/work/${p.slug}`} key={p.slug}>
                  <div className="project-photo" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(150deg,#232323,#050505)' }}></div>
                  <div className="project-info project-info-row">
                    <div>
                      <div className="project-name">{p.title}</div>
                      {p.summary && <div className="project-desc">{p.summary}</div>}
                      {p.tags && p.tags.length > 0 && (
                        <div className="project-tags">
                          {p.tags.map((t) => <span className="project-tag" key={t}>{t}</span>)}
                        </div>
                      )}
                    </div>
                    <span className="arrow-circle" aria-label={`${p.title} সম্পর্কে জানুন`}>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section hired-section" id="services">
        <div className="container reveal">
          <h2 className="section-title">What we are hired for</h2>
          {SERVICES_HIRED.map((s, i) => (
            <details className="hired-item" key={s.name}>
              <summary className="hired-summary">
                <span className="hired-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="hired-name">{s.name}</span>
                <span className="hired-sub">{s.sub}</span>
                <span className="hired-toggle" aria-hidden="true">→</span>
              </summary>
              <div className="hired-body"><p>{s.detail}</p></div>
            </details>
          ))}
        </div>
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
