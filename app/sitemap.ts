import type { MetadataRoute } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SITE_URL } from '@/lib/siteUrl';

// প্রতি ঘণ্টায় রিজেনারেট — নতুন published কেস স্টাডি সর্বোচ্চ ১ ঘণ্টায় সাইটম্যাপে আসে।
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/services', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/work', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // শুধু published কেস স্টাডি; DB ফেইল করলে স্ট্যাটিক পেজগুলো নিয়েই সাইটম্যাপ চলবে।
  try {
    const { data } = await getSupabaseAdmin()
      .from('case_studies')
      .select('slug, updated_at')
      .eq('published', true)
      .order('order_index');
    for (const cs of (data as { slug: string; updated_at: string | null }[]) ?? []) {
      entries.push({
        url: `${SITE_URL}/work/${encodeURIComponent(cs.slug)}`,
        lastModified: cs.updated_at ? new Date(cs.updated_at) : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('sitemap: case studies fetch failed', e);
  }

  return entries;
}
