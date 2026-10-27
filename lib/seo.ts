// পেজ-ভিত্তিক Open Graph/Twitter মেটাডেটা — না দিলে সাব-পেজ হোমপেজের og:title/description
// ইনহেরিট করে। কিন্তু পেজ নিজে openGraph দিলে রুটের শেয়ার ইমেজ আর ইনহেরিট হয় না, তাই
// app/opengraph-image.tsx-এর ইমেজ এখানে স্পষ্টভাবে বসানো হয়েছে।
const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'FLOW 53 — UI/UX Design & Development Agency',
};

export function pageMeta(title: string, description: string | undefined, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website' as const, siteName: 'FLOW 53', locale: 'en_US', title, description, url: path, images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image' as const, title, description, images: [SHARE_IMAGE.url] },
  };
}
