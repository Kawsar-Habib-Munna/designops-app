import Link from 'next/link';
import './home.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveThumbnailUrl } from '@/lib/driveUpload';
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

// Work সেকশনের প্রজেক্টগুলো (Aarambho/Nilkantha/Prantik Bank) — এগুলো কোনো
// real client project না, ডিজাইনের placeholder। আসল case study তৈরি হলে এখানে
// বদলে দিতে হবে।
const COLLAGE_COLORS_A = ['#4285F4', '#EA4335', '#34A853', '#FBBC05', '#7C72FF', '#00C2A8', '#FF6F61', '#3B82F6', '#F472B6', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#0EA5E9', '#A855F7'];
const COLLAGE_COLORS_B = ['#3B82F6', '#F472B6', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#0EA5E9', '#A855F7', '#4285F4', '#EA4335', '#34A853', '#FBBC05', '#7C72FF', '#00C2A8', '#FF6F61'];

const PROJECTS = [
  { name: 'Aarambho', desc: 'Brand app redesign for a consumer tech challenger.', tags: ['UI/UX design', 'Mobile App'], colors: COLLAGE_COLORS_A },
  { name: 'Nilkantha', desc: 'A storefront & app for an FMCG e-commerce brand.', tags: ['UI/UX design', 'Mobile App'], colors: null },
  { name: 'Prantik Bank', desc: 'A banking dashboard built for clarity at speed.', tags: ['UI/UX design', 'Dashboard'], colors: COLLAGE_COLORS_B },
];

const SERVICES_HIRED = [
  { name: 'UX Research & Discovery', sub: 'Interviews · Journey Mapping' },
  { name: 'UI Design', sub: 'Web · Mobile · Dashboards' },
  { name: 'Design Systems', sub: 'Tokens · Components' },
  { name: 'Prototyping & Testing', sub: 'Figma · Usability Testing' },
  { name: 'Brand Identity', sub: 'Naming · Visual Identity' },
];

const PROCESS_STEPS = [
  { name: 'Discover', desc: 'Research & a clear problem statement.' },
  { name: 'Design', desc: 'Wireframes to high-fidelity UI.' },
  { name: 'Test', desc: 'Real users, real tasks.' },
  { name: 'Deliver', desc: 'Clean specs & a working system.' },
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
  const team = await fetchTeam();

  return (
    <div className="home-root">
      <LandingNav />

      <header className="hero">
        <div className="hero-giant-num">53</div>
        <div className="container">
          <div className="hero-top reveal">
            <h1 className="hero-headline">We design digital products people actually love to use.</h1>
            <a href="#contact" className="hero-book-btn">Book a call</a>
          </div>

          <div className="project-grid reveal" id="work">
            <div className="project-card">
              <div className="project-photo teaser-photo">
                <div className="teaser-ring"><div className="teaser-ring-inner"></div></div>
              </div>
              <div className="project-info project-info-row">
                <span className="teaser-text">Got a project<br />in mind?</span>
                <a href="#contact" className="arrow-circle" aria-label="যোগাযোগ করুন">→</a>
              </div>
            </div>

            {PROJECTS.map((p) => (
              <div className="project-card" key={p.name}>
                <div className="project-photo" style={p.colors ? undefined : { background: 'linear-gradient(150deg,#232323,#050505)' }}>
                  {p.colors && (
                    <div className="icon-collage">
                      {p.colors.map((c, ci) => (
                        <div className="icon-sq" style={{ background: c }} key={ci}></div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="project-info project-info-row">
                  <div>
                    <div className="project-name">{p.name}</div>
                    <div className="project-desc">{p.desc}</div>
                    <div className="project-tags">
                      {p.tags.map((t) => <span className="project-tag" key={t}>{t}</span>)}
                    </div>
                  </div>
                  <a href="#contact" className="arrow-circle" aria-label={`${p.name} সম্পর্কে জানুন`}>→</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="section hired-section" id="services">
        <div className="container reveal">
          <h2 className="section-title">What we are hired for</h2>
          {SERVICES_HIRED.map((s, i) => (
            <div className="hired-row" key={s.name}>
              <span className="hired-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="hired-name">{s.name}</span>
              <span className="hired-sub">{s.sub}</span>
              <span className="arrow-circle">→</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="process">
        <div className="container reveal">
          <h2 className="section-title">How an engagement runs.</h2>
          <div className="process-grid">
            {PROCESS_STEPS.map((s, i) => (
              <div className="process-card" key={s.name}>
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
              <div className="collage-img" style={{ height: 190, background: 'linear-gradient(150deg,#3B82F6,#0c1f3d)' }}></div>
              <div className="collage-img" style={{ height: 130, background: 'linear-gradient(150deg,#10B981,#04241a)' }}></div>
            </div>
            <div className="collage-col">
              <div className="collage-img" style={{ height: 150, background: 'linear-gradient(150deg,#6366F1,#150e33)' }}></div>
              <div className="collage-img" style={{ height: 170, background: 'linear-gradient(150deg,#F59E0B,#3a2603)' }}></div>
            </div>
            <div className="collage-col" style={{ marginTop: 50 }}>
              <div className="collage-img" style={{ height: 160, background: 'linear-gradient(150deg,#EF4444,#2c0a0a)' }}></div>
              <div className="collage-img" style={{ height: 130, background: 'linear-gradient(150deg,#A855F7,#210b33)' }}></div>
            </div>
          </div>
          <div>
            <div className="collage-services-title">Our Services</div>
            <div className="services-list-plain">
              <div className="service-plain-item">UI / UX Design</div>
              <div className="service-plain-item">Frontend Design</div>
              <div className="service-plain-item">SaaS Design</div>
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
