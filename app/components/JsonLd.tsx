import { SITE_URL } from '@/lib/siteUrl';
import { formatPhoneDisplay, type SiteSettings } from '@/lib/siteSettings';

// হোমপেজের Organization + WebSite structured data (JSON-LD)। ব্র্যান্ড নাম "Flow53",
// বাকি লেখার ধরনগুলো alternateName — যাতে Google সবগুলোকে একই ব্র্যান্ড হিসেবে চেনে।
// ফোন/ইমেইল/ঠিকানা/সোশ্যাল লিংক site_settings থেকে আসে (/portfolio-তে এডিটযোগ্য)।
const BRAND_NAME = 'Flow53';
const ALTERNATE_NAMES = ['Flow53 Design', 'Flow 53 Design', 'flow53', 'Flow 53'];

export default function JsonLd({ settings }: { settings: SiteSettings }) {
  const sameAs = [
    settings.socialBehance,
    settings.socialDribbble,
    settings.socialLinkedin,
    settings.socialFacebook,
    settings.socialInstagram,
    settings.socialX,
  ].filter(Boolean);

  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    alternateName: ALTERNATE_NAMES,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description:
      'Flow53 is a UI/UX design and development agency helping ambitious businesses turn ideas into intuitive, scalable digital products.',
    email: settings.contactEmail,
    telephone: formatPhoneDisplay(settings.contactPhone),
    address: {
      '@type': 'PostalAddress',
      addressLocality: settings.addressLine1,
      addressCountry: settings.addressLine2,
    },
    ...(sameAs.length > 0 && { sameAs }),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: BRAND_NAME,
    alternateName: ALTERNATE_NAMES,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': [organization, website] }).replace(/</g, '\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
