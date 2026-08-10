import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../home.css';
import '../work.css';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { driveThumbnailUrl } from '@/lib/driveUpload';

// পাবলিক কেস স্টাডি পেজ — /portfolio (app-এর ভেতরের admin পেজ) থেকে টিম যেই
// কেস স্টাডি publish করে, সেটাই এখানে ওয়্যারফ্রেম → প্রোটোটাইপ → ফাইনাল UI
// ক্রমে দেখানো হয়। published না থাকলে বা slug না মিললে 404।
export const dynamic = 'force-dynamic';

type Section = 'wireframe' | 'prototype' | 'final_ui';
const SECTION_ORDER: Section[] = ['wireframe', 'prototype', 'final_ui'];
const SECTION_LABEL: Record<Section, string> = { wireframe: 'Wireframes', prototype: 'Prototype', final_ui: 'Final UI' };

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

type CSImage = { id: string; section: Section; image_url: string; caption: string | null; order_index: number };

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

    const { data: images } = await admin
      .from('case_study_images')
      .select('id, section, image_url, caption, order_index')
      .eq('case_study_id', (cs as CaseStudy).id)
      .order('order_index');

    return { caseStudy: cs as CaseStudy, images: (images as CSImage[]) ?? [] };
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
  const { caseStudy, images } = result;

  const cover = caseStudy.cover_image ? driveThumbnailUrl(caseStudy.cover_image) : null;
  const embedUrl = caseStudy.figma_prototype_url ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(caseStudy.figma_prototype_url)}` : null;

  return (
    <div className="home-root">
      <nav className="nav scrolled">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">FLOW<span className="stroke-53">53</span></Link>
          <div className="nav-links">
            <Link href="/#work" className="nav-link">Work</Link>
            <Link href="/#services" className="nav-link">Services</Link>
            <Link href="/#team" className="nav-link">Team</Link>
          </div>
          <a href="mailto:hello@flow53.studio" className="nav-cta">Book a call</a>
        </div>
      </nav>

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

          {SECTION_ORDER.map((section) => {
            const sectionImages = images.filter((i) => i.section === section);
            if (sectionImages.length === 0) return null;
            return (
              <section className="work-section" key={section}>
                <div className="work-section-title">{SECTION_LABEL[section]}</div>
                <div className="work-gallery">
                  {sectionImages.map((img) => (
                    <img className="work-gallery-img" key={img.id} src={driveThumbnailUrl(img.image_url)} alt={img.caption ?? caseStudy.title} />
                  ))}
                </div>
              </section>
            );
          })}

          {!embedUrl && images.length === 0 && (
            <p className="work-empty">এই কেস স্টাডিতে এখনো কোনো ছবি যোগ করা হয়নি।</p>
          )}
        </div>
      </main>

      <section className="cta-band" id="contact">
        <div className="container">
          <h2 className="cta-band-title">Got a product that deserves better design?</h2>
          <a href="mailto:hello@flow53.studio" className="hero-book-btn">Book a call</a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="footer-copy">© {new Date().getFullYear()} FLOW 53 Studio. Dhaka, Bangladesh.</span>
          <div className="footer-links">
            <Link href="/dashboard" className="footer-link">অ্যাপে লগইন করুন</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
