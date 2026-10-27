import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

// শুধু পাবলিক মার্কেটিং পেজ ক্রল হবে; ক্লায়েন্ট পোর্টাল, ইন্টারনাল ড্যাশবোর্ড
// ও API বন্ধ। /_next/ ইচ্ছে করে ব্লক করা হয়নি — Google-এর CSS/JS লাগে রেন্ডারিংয়ের জন্য।
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/projects',
        '/clients',
        '/budget',
        '/board',
        '/calendar',
        '/discussions',
        '/files',
        '/notifications',
        '/portfolio',
        '/sows',
        '/tasks',
        '/team',
        '/todos',
        '/whiteboard',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
