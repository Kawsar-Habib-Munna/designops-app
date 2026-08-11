import Link from 'next/link';
import './home.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveThumbnailUrl, driveFullImageUrl } from '@/lib/driveUpload';
import LandingNav from '@/app/components/LandingNav';
import RevealOnScroll from '@/app/components/RevealOnScroll';

// পাবলিক ল্যান্ডিং পেজ — লগইন ছাড়াই সবাই দেখে, তাই profiles টেবিলের RLS
// (শুধু authenticated ইউজার read করতে পারে) এই পেজের জন্য প্রযোজ্য না। এটা
// একটা Server Component, তাই service-role client দিয়ে সরাসরি সার্ভারে
// টিমের real ডেটা আনা হয় (Team পেজের মতোই আসল নাম/রোল/ছবি) — কোনো secret
// ব্রাউজারে যায় না। Team সেকশন সম্পূর্ণ dynamic রাখতে (কেউ যোগ/বাদ হলে বা
// প্রোফাইল পাল্টালে সাথে সাথে পরের ভিজিটেই দেখা যায়) ক্যাশ/ISR ছাড়াই প্রতিটা
// রিকোয়েস্টে fresh ডেটা আনা হয়।
export const dynamic = 'force-dynamic';

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
  { name: 'Discover', desc: 'Research & a clear problem statement.', image: '/Discover.png' },
  { name: 'Design', desc: 'Wireframes to high-fidelity UI.', image: '/Design.png' },
  { name: 'Test', desc: 'Real users, real tasks.', image: '/Test.png' },
  { name: 'Deliver', desc: 'Clean specs & a working system.', image: '/Deliver.png' },
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
    <div className="home-root">
      <LandingNav />

      <header className="hero">
        <div className="container">
          <div className="hero-top reveal">
            <h1 className="hero-headline">We design digital products people actually love to use.</h1>
            <a href="#contact" className="hero-book-btn">Book a call</a>
          </div>

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
      </header>

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

      <section className="section" id="process">
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

      <section className="section" id="team">
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
          <a href="mailto:hello@flow53.studio" className="hero-book-btn">Book a call</a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="footer-copy">© {new Date().getFullYear()} FLOW 53 Studio. Dhaka, Bangladesh.</span>
          <div className="footer-links">
            <Link href="/dashboard" className="footer-link">অ্যাপে লগইন করুন</Link>
            <a href="#" className="footer-link">Instagram</a>
            <a href="#" className="footer-link">LinkedIn</a>
          </div>
        </div>
      </footer>

      <RevealOnScroll />
    </div>
  );
}
