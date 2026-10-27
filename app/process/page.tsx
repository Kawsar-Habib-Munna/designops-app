import '../home.css';
import '../services/services.css';
import './process.css';
import { pageMeta } from '@/lib/seo';
import { fetchSiteSettings, buildWhatsappUrl, BOOK_CALL_MESSAGE } from '@/lib/siteSettings';
import { interStats, nunito, nunitoBold, playfair } from '@/app/fonts';
import LandingNav from '@/app/components/LandingNav';
import LandingFooter from '@/app/components/LandingFooter';
import RevealOnScroll from '@/app/components/RevealOnScroll';
import SlideSwapLabel from '@/app/components/SlideSwapLabel';

// পাবলিক Process পেজ — Figma "Flow 53 Web" (node 2787:2536, "Flow 53 Web App")
// অনুযায়ী বানানো। হিরো, CTA band, brand-band ও footer /services পেজ থেকে হুবহু রিইউজ
// (একই ক্লাস/কম্পোনেন্ট); নতুন অংশ শুধু "How we work" টাইমলাইন — ৫টা স্টেপ, ছবি
// বাঁ/ডান alternate করে। টেক্সট Figma থেকে যেমন আছে তেমনই (হিরোর "Home/Service"
// ব্রেডক্রাম্ব ও হেডিংও Figma-তে Services পেজ থেকেই কপি করা)।
export const metadata = pageMeta(
  'Process — Flow53',
  'Discover, define, design, develop and launch: a simple five-step process built for better results.',
  '/process',
);

export const revalidate = 60;

type Bullet = { label: string; text: string };
type Step = { title: string; sprint: string; image: string; imageAlt: string; bullets: Bullet[] };

const STEPS: Step[] = [
  {
    title: 'Discover',
    sprint: '01 Sprint',
    image: '/process/step-1-discover.webp',
    imageAlt: 'Discovery and user research illustration',
    bullets: [
      { label: 'Discovery summary:', text: "Understand the client's vision, business goals, and target audience." },
      { label: 'Problem statement:', text: 'Identify user pain points and business challenges.' },
      { label: 'Business discovery:', text: 'Explore the market, competitors, and opportunities.' },
      { label: 'User research:', text: 'Understand user needs, behaviors, and expectations.' },
    ],
  },
  {
    title: 'Define',
    sprint: '02 Sprint',
    image: '/process/step-2-define.webp',
    imageAlt: 'Defining the product strategy illustration',
    bullets: [
      { label: 'User research:', text: 'Understand user needs, behaviors, and expectations.' },
      { label: 'User journey:', text: 'Map the complete user experience to uncover pain points and improvement opportunities.' },
      { label: 'Problem framing:', text: 'Identify core user problems and prioritize the challenges that matter most.' },
      { label: 'Product strategy:', text: 'Define product goals, project scope, and measurable success criteria.' },
    ],
  },
  {
    title: 'Design',
    sprint: '03 Sprint',
    image: '/process/step-3-design.webp',
    imageAlt: 'UI design and prototyping illustration',
    bullets: [
      { label: 'Information architecture:', text: 'Structure content and navigation to help users find what they need.' },
      { label: 'Wireframing :', text: "Create clear layouts and user flows to establish the product's structure." },
      { label: 'UI design:', text: 'Design visually engaging interfaces with consistent components and accessible layouts.' },
      { label: 'Prototyping:', text: 'Build interactive prototypes to demonstrate user flows and validate design decisions.' },
    ],
  },
  {
    title: 'Develop',
    sprint: '04 Sprint',
    image: '/process/step-4-develop.webp',
    imageAlt: 'Frontend development illustration',
    bullets: [
      { label: 'Design hand-off:', text: 'Prepare organized design files, specifications, and assets for developers.' },
      { label: 'Frontend development:', text: 'Build responsive interfaces that work smoothly across different devices.' },
      { label: 'Design implementation:', text: 'Translate approved designs into consistent and functional user interfaces.' },
      { label: 'Quality assurance:', text: 'Test functionality, responsiveness, and usability to identify issues before launch.' },
    ],
  },
  {
    title: 'Launch',
    sprint: '05 Sprint',
    image: '/process/step-5-launch.webp',
    imageAlt: 'Product launch illustration',
    bullets: [
      { label: 'Usability testing:', text: 'Evaluate real user interactions to identify friction and improve the experience.' },
      { label: 'Performance testing:', text: 'Check loading speed, responsiveness, and reliability across different devices.' },
      { label: 'Final refinements:', text: 'Resolve usability issues and polish visual details before the final release.' },
      { label: 'Launch support:', text: 'Support deployment and identify opportunities for continuous product improvement.' },
    ],
  },
];

export default async function ProcessPage() {
  const settings = await fetchSiteSettings();
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div className={`home-root ${nunito.variable} ${nunitoBold.variable} ${playfair.variable} ${interStats.variable}`}>
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

        <section className="prc-section" id="process">
          <div className="prc-heading reveal">
            <span className="prc-pill">
              <img loading="lazy" src="/stats/line.svg" alt="" />
              <span>How we work</span>
            </span>
            <h2 className="prc-title">A Simple Process.Built for Better Results.</h2>
          </div>

          <div className="prc-steps">
            <img loading="lazy" src="/process/timeline.svg" alt="" className="prc-timeline" aria-hidden="true" />
            {STEPS.map((s, i) => (
              <div className={`prc-step${i % 2 === 1 ? ' reverse' : ''} reveal`} key={s.title}>
                <div className="prc-step-text">
                  <div className="prc-step-head">
                    <h3 className="prc-step-title">{s.title}</h3>
                    <span className="prc-step-sprint">{s.sprint}</span>
                  </div>
                  <ul className="prc-bullets">
                    {s.bullets.map((b) => (
                      <li key={b.label}>
                        <strong>{b.label}</strong> {b.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="prc-step-image">
                  <img loading="lazy" src={s.image} alt={s.imageAlt} />
                </div>
              </div>
            ))}
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
                    Tell us what you&rsquo;re thinking, where you&rsquo;re stuck, or what you want to improve. We&rsquo;ll help you
                    turn the next idea into something worth experiencing.
                  </p>
                </div>
              </div>

              <div className="cta-final-buttons">
                <a href="/client/register" className="cta-final-btn primary">
                  <span className="cta-final-btn-inner"><SlideSwapLabel text="Start A Project" /></span>
                  <img loading="lazy" src="/cta/icon-arrow.svg" alt="" className="cta-final-btn-icon" />
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
          <img loading="lazy" src="/brand/logo-band.webp" alt="" className="brand-band-img" />
        </section>

        <LandingFooter settings={settings} />
      </div>

      <RevealOnScroll />
    </div>
  );
}
