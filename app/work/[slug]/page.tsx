import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../home.css';
import '../work.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveFullImageUrl, driveEmbedUrl } from '@/lib/driveUpload';
import LandingFooter from '@/app/components/LandingFooter';

const WHATSAPP_URL = 'https://chat.whatsapp.com/E8RvWQSXPPp691V7odTwwl';

// পাবলিক কেস স্টাডি পেজ — /portfolio (app-এর ভেতরের admin পেজ) থেকে টিম যেই
// কেস স্টাডি publish করে, সেটাই এখানে Overview থেকে Team পর্যন্ত ১৬টা সেকশন
// ক্রমে দেখানো হয় — প্রতিটা সেকশনে লেখা + ছবি/ভিডিও/লিংক মিডিয়া। published
// না থাকলে বা slug না মিললে 404।
export const dynamic = 'force-dynamic';

type SectionKey =
  | 'overview' | 'problem_solution' | 'user_persona' | 'empathy_map' | 'competitive_analysis'
  | 'moscow' | 'kano' | 'ia_sitemap' | 'user_flow' | 'wireframe' | 'screens_brief' | 'mockups'
  | 'prototype' | 'usability_testing' | 'ai_help' | 'team';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'problem_solution', label: 'Problem & Solution' },
  { key: 'user_persona', label: 'User Persona' },
  { key: 'empathy_map', label: 'Empathy Map' },
  { key: 'competitive_analysis', label: 'Competitive Analysis' },
  { key: 'moscow', label: 'MoSCoW Model' },
  { key: 'kano', label: 'Kano Model' },
  { key: 'ia_sitemap', label: 'Information Architecture / Site Map' },
  { key: 'user_flow', label: 'User Flow' },
  { key: 'wireframe', label: 'Wireframe' },
  { key: 'screens_brief', label: 'Screens Brief' },
  { key: 'mockups', label: 'Mockups' },
  { key: 'prototype', label: 'Prototype' },
  { key: 'usability_testing', label: 'Usability Testing' },
  { key: 'ai_help', label: 'AI Help' },
  { key: 'team', label: 'Team' },
];

type CaseStudy = {
  id: string;
  slug: string;
  title: string;
  client_name: string | null;
  summary: string | null;
  tags: string[] | null;
  cover_image: string | null;
  figma_prototype_url: string | null;
};

type CSSection = { section_key: SectionKey; content: string | null };
type CSMedia = { id: string; section_key: SectionKey; media_type: 'image' | 'video' | 'link'; url: string; caption: string | null; order_index: number };

function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function fetchCaseStudy(slug: string) {
  try {
    const admin = getSupabaseAdmin();
    const { data: cs } = await admin
      .from('case_studies')
      .select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (!cs) return null;

    const [{ data: sections }, { data: media }] = await Promise.all([
      admin.from('case_study_sections').select('section_key, content').eq('case_study_id', (cs as CaseStudy).id),
      admin.from('case_study_media').select('id, section_key, media_type, url, caption, order_index').eq('case_study_id', (cs as CaseStudy).id).order('order_index'),
    ]);

    return { caseStudy: cs as CaseStudy, sections: (sections as CSSection[]) ?? [], media: (media as CSMedia[]) ?? [] };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await fetchCaseStudy(slug);
  if (!result) return { title: 'FLOW 53' };
  return {
    title: `${result.caseStudy.title} — FLOW 53`,
    description: result.caseStudy.summary ?? undefined,
  };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await fetchCaseStudy(slug);
  if (!result) notFound();
  const { caseStudy, sections, media } = result;

  const cover = caseStudy.cover_image ? driveFullImageUrl(caseStudy.cover_image) : null;
  const embedUrl = caseStudy.figma_prototype_url ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(caseStudy.figma_prototype_url)}` : null;

  const contentByKey = new Map(sections.map((s) => [s.section_key, s.content] as const));
  const mediaByKey = new Map<SectionKey, CSMedia[]>();
  for (const m of media) {
    const arr = mediaByKey.get(m.section_key) ?? [];
    arr.push(m);
    mediaByKey.set(m.section_key, arr);
  }

  const visibleSections = SECTIONS.filter((sec) => {
    const content = contentByKey.get(sec.key);
    const hasMedia = (mediaByKey.get(sec.key) ?? []).length > 0;
    return (content && content.trim()) || hasMedia;
  });

  return (
    <div className="home-root">
      <nav className="nav scrolled">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo"><span className="nav-logo-mark"></span>FLOW<span className="stroke-53">53</span></Link>
          <div className="nav-links">
            <Link href="/#work" className="nav-link">Work</Link>
            <Link href="/#services" className="nav-link">Services</Link>
            <Link href="/#team" className="nav-link">Team</Link>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">Book a call</a>
        </div>
      </nav>

      <div className="home-body">
      <header className="work-hero">
        <div className="container">
          <Link href="/#work" className="work-back">← All projects</Link>
          <h1 className="work-title">{caseStudy.title}</h1>
          <div className="work-meta-row">
            {caseStudy.client_name && <span className="work-client">{caseStudy.client_name}</span>}
            {caseStudy.tags && caseStudy.tags.length > 0 && (
              <div className="work-tags">{caseStudy.tags.map((t) => <span className="work-tag" key={t}>{t}</span>)}</div>
            )}
          </div>
          {caseStudy.summary && <p className="work-summary">{caseStudy.summary}</p>}
          {cover && (
            <div className="work-cover"><img src={cover} alt={caseStudy.title} /></div>
          )}
        </div>
      </header>

      <main className="work-body">
        <div className="container">
          {embedUrl && (
            <section className="work-section">
              <div className="work-section-title">Live Prototype</div>
              <div className="work-proto-frame"><iframe src={embedUrl} allowFullScreen title={`${caseStudy.title} prototype`} /></div>
              <a className="work-proto-link" href={caseStudy.figma_prototype_url ?? '#'} target="_blank" rel="noopener noreferrer">Open in Figma ↗</a>
            </section>
          )}

          {visibleSections.map((sec) => {
            const content = contentByKey.get(sec.key);
            const items = (mediaByKey.get(sec.key) ?? []).sort((a, b) => a.order_index - b.order_index);
            return (
              <section className="work-section" key={sec.key}>
                <div className="work-section-title">{sec.label}</div>
                {content && content.trim() && <p className="work-section-text">{content}</p>}
                {items.length > 0 && (
                  <div className="work-gallery">
                    {items.map((m) => {
                      if (m.media_type === 'image') {
                        return <img className="work-gallery-img" key={m.id} src={driveFullImageUrl(m.url)} alt={m.caption ?? sec.label} />;
                      }
                      if (m.media_type === 'video') {
                        const embed = driveEmbedUrl(m.url);
                        return embed ? (
                          <div className="work-video-frame" key={m.id}><iframe src={embed} allowFullScreen title={m.caption ?? sec.label} /></div>
                        ) : (
                          <a className="work-link-chip" key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">▶ {m.caption ?? linkLabel(m.url)}</a>
                        );
                      }
                      return (
                        <a className="work-link-chip" key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">🔗 {m.caption ?? linkLabel(m.url)}</a>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {!embedUrl && visibleSections.length === 0 && (
            <p className="work-empty">এই কেস স্টাডিতে এখনো কোনো কনটেন্ট যোগ করা হয়নি।</p>
          )}
        </div>
      </main>

      <section className="cta-band" id="contact">
        <div className="container">
          <h2 className="cta-band-title">Got a product that deserves better design?</h2>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hero-book-btn">Book a call</a>
        </div>
      </section>

      <LandingFooter />
      </div>
    </div>
  );
}
