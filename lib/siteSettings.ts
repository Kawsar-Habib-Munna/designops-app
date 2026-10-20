import { getSupabaseAdmin } from './supabaseAdmin';

// পাবলিক সাইটের যোগাযোগের তথ্য (ফোন/ইমেইল/ঠিকানা) + "Book A Call" বাটনগুলোর
// WhatsApp নাম্বার - আগে LandingFooter/app/page.tsx/LandingNav.tsx-এ আলাদা আলাদা
// হার্ডকোড করা ছিল। এখন /portfolio অ্যাডমিন থেকে এডিট করা যায় (site_settings
// টেবিলের একটামাত্র রো, id=1) - case_studies/testimonials-এর মতোই
// getSupabaseAdmin() (service role) দিয়ে পাবলিক পেজে ফেচ হয়।
export type SiteSettings = {
  contactPhone: string; // শুধু ডিজিট, country code সহ - যেমন '8801996925819'
  bookCallPhone: string; // শুধু ডিজিট - "Book A Call"/"Start A Project" বাটন ও কন্টাক্ট ফর্মের নাম্বার
  contactEmail: string;
  contactEmailSecondary: string;
  addressLine1: string;
  addressLine2: string;
  // ফুটারের সোশ্যাল আইকন - ফাঁকা থাকলে ওই প্ল্যাটফর্মের আইকনটা non-clickable
  // থেকে যায় (আগে যেমন ছিল, real প্রোফাইল লিংক না থাকা পর্যন্ত)।
  socialBehance: string;
  socialDribbble: string;
  socialLinkedin: string;
  socialFacebook: string;
  socialInstagram: string;
  socialX: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  contactPhone: '8801996925819',
  bookCallPhone: '8801804409235',
  contactEmail: 'info@flow53design.com',
  contactEmailSecondary: 'flow53design@gmail.com',
  addressLine1: 'Dhaka',
  addressLine2: 'Bangladesh',
  socialBehance: '',
  socialDribbble: '',
  socialLinkedin: '',
  socialFacebook: '',
  socialInstagram: '',
  socialX: '',
};

// "Book A Call" বাটনগুলোর প্রি-ফিলড WhatsApp মেসেজ - সব জায়গায় একই টেক্সট।
export const BOOK_CALL_MESSAGE =
  "Hi FLOW53, I'm interested in your UI/UX design services. I'd like to discuss my project";

// '8801996925819' -> '+88 01996925819' - দেশের কোড হিসেবে প্রথম দুই ডিজিট ধরে
// নেওয়া হয় (এই সাইটের সব নাম্বারই বাংলাদেশি "88" কোডে)।
export function formatPhoneDisplay(digits: string) {
  const clean = digits.replace(/\D/g, '');
  if (clean.length < 3) return digits;
  return `+${clean.slice(0, 2)} ${clean.slice(2)}`;
}

export function buildWhatsappUrl(digits: string, text?: string) {
  const clean = digits.replace(/\D/g, '');
  return text ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}` : `https://wa.me/${clean}`;
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('site_settings')
      .select('contact_phone, book_call_phone, contact_email, contact_email_secondary, contact_address_line1, contact_address_line2, social_behance, social_dribbble, social_linkedin, social_facebook, social_instagram, social_x')
      .eq('id', 1)
      .maybeSingle();
    if (!data) return DEFAULT_SITE_SETTINGS;
    return {
      contactPhone: data.contact_phone || DEFAULT_SITE_SETTINGS.contactPhone,
      bookCallPhone: data.book_call_phone || DEFAULT_SITE_SETTINGS.bookCallPhone,
      contactEmail: data.contact_email || DEFAULT_SITE_SETTINGS.contactEmail,
      contactEmailSecondary: data.contact_email_secondary || DEFAULT_SITE_SETTINGS.contactEmailSecondary,
      addressLine1: data.contact_address_line1 || DEFAULT_SITE_SETTINGS.addressLine1,
      addressLine2: data.contact_address_line2 || DEFAULT_SITE_SETTINGS.addressLine2,
      socialBehance: data.social_behance || '',
      socialDribbble: data.social_dribbble || '',
      socialLinkedin: data.social_linkedin || '',
      socialFacebook: data.social_facebook || '',
      socialInstagram: data.social_instagram || '',
      socialX: data.social_x || '',
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
