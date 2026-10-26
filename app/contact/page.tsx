import "../home.css";
import "./contact.css";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { driveThumbnailUrl } from "@/lib/driveUpload";
import { fetchSiteSettings, formatPhoneDisplay, buildWhatsappUrl, BOOK_CALL_MESSAGE } from "@/lib/siteSettings";
import { interStats, nunito, playfair } from "@/app/fonts";
import LandingNav from "@/app/components/LandingNav";
import LandingFooter from "@/app/components/LandingFooter";
import RevealOnScroll from "@/app/components/RevealOnScroll";
import SlideSwapLabel from "@/app/components/SlideSwapLabel";
import FaqAccordion from "@/app/components/FaqAccordion";
import TestimonialsGrid, { type TestimonialCard } from "@/app/components/TestimonialsGrid";
import ContactPageForm from "./ContactPageForm";

// পাবলিক Contact পেজ — Figma "Flow 53 Web" (node 2718:4745, "Contact Section")
// অনুযায়ী বানানো। Form/FAQ/Testimonials তিনটাই হোমপেজের বিদ্যমান কম্পোনেন্ট আর
// home.css ক্লাস রিইউজ করে (.contact-card/.contact-form*, FaqAccordion-এর
// প্রশ্নগুলো Figma-র সাথে হুবহু মিলে যায়, TestimonialsGrid আগে থেকেই light-themed
// - এই পেজের সাদা টেস্টিমোনিয়াল সেকশনের জন্য ঠিক উপযুক্ত), শুধু ফর্মের ফিল্ড সেট
// (Full Name/Email/Project Budget/Whatsapp Number/Project Details) আলাদা তাই
// ContactPageForm নতুন বানানো হয়েছে। Contact-info কার্ড (ফোন/ইমেইল/ঠিকানা) একই
// আইকন/ডেটা-বাইন্ডিং হোমপেজের faq-contact-card থেকে রিইউজ করে, কিন্তু Figma-তে
// এগুলো একটামাত্র vertically-stacked কার্ড (৩টা আলাদা কার্ড পাশাপাশি না) - তাই
// নতুন .cp-info-card র‍্যাপার।
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact — FLOW 53",
  description: "Have a project in mind? Let's discuss your ideas and create meaningful digital experiences together.",
};

async function fetchTestimonials(): Promise<TestimonialCard[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("testimonials")
      .select("name, role, quote, rating, avatar_url")
      .eq("published", true)
      .order("order_index");
    return (data as TestimonialCard[]) ?? [];
  } catch {
    return [];
  }
}

export default async function ContactPage() {
  const [testimonials, settings] = await Promise.all([fetchTestimonials(), fetchSiteSettings()]);
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav bookCallUrl={bookCallUrl} />

      <div className="home-body">
        <header className="cp-hero">
          <div className="cp-hero-inner">
            <div className="cp-hero-card reveal">
              <span className="cp-breadcrumb">
                <span className="cp-breadcrumb-icon">
                  <img src="/contact/icon-breadcrumb-case.svg" alt="" />
                </span>
                <span className="cp-breadcrumb-label">
                  <span className="dim">Home</span>
                  <span className="bright">/Contact</span>
                </span>
              </span>
              <h1 className="cp-hero-title">Let&rsquo;s Create Something Amazing Together</h1>
              <p className="cp-hero-desc">Have a project in mind? Let&rsquo;s discuss your ideas and create meaningful digital experiences together.</p>
            </div>
          </div>
        </header>

        <section className="cp-section">
          <div className="cp-inner">
            <div className="cp-work-row reveal">
              <div className="cp-work-col">
                <div className="cp-work-heading">
                  <span className="cp-eyebrow">Contact Us</span>
                  <h2 className="cp-work-title">Let&rsquo;s Work Together!</h2>
                  <p className="cp-work-desc">Got a project? We design UI/UX that solves problems, engages users, and supports business growth.</p>
                </div>

                <div className="cp-info-card">
                  <a className="cp-info-row" href={buildWhatsappUrl(settings.contactPhone)} target="_blank" rel="noopener noreferrer">
                    <span className="faq-contact-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="faq-contact-icon-svg whatsapp">
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.07-1.32A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8.5 8.2c.2-.45.4-.46.6-.47h.5c.17 0 .4-.06.62.48.23.55.78 1.9.85 2.04.07.14.12.3.02.49-.1.19-.15.3-.3.46-.15.16-.31.36-.44.48-.15.14-.3.29-.13.58.17.29.75 1.25 1.62 2.02 1.11.99 2.05 1.3 2.34 1.45.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.38-.24.64-.14.26.1 1.66.79 1.94.93.29.14.48.22.55.34.07.13.07.72-.17 1.41-.24.7-1.4 1.34-1.93 1.42-.5.08-1.12.11-1.81-.11-.42-.14-.95-.31-1.64-.61-2.88-1.25-4.76-4.15-4.9-4.34-.14-.2-1.17-1.56-1.17-2.98 0-1.42.75-2.11 1.02-2.4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="cp-info-lines">
                      <span>{formatPhoneDisplay(settings.contactPhone)}</span>
                      <span>{formatPhoneDisplay(settings.bookCallPhone)}</span>
                    </span>
                  </a>
                  <a className="cp-info-row" href={`mailto:${settings.contactEmail}`}>
                    <span className="faq-contact-icon">
                      <img src="/faq/icon-email.svg" alt="" />
                    </span>
                    <span className="cp-info-lines">
                      <span>{settings.contactEmail}</span>
                      <span>{settings.contactEmailSecondary}</span>
                    </span>
                  </a>
                  <div className="cp-info-row">
                    <span className="faq-contact-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="faq-contact-icon-svg location">
                        <path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                    <span className="cp-info-lines">
                      <span>{settings.addressLine1}</span>
                      <span>{settings.addressLine2}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="cp-work-form-col">
                <div className="contact-card">
                  <ContactPageForm whatsappNumber={settings.bookCallPhone} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cp-section" style={{ paddingTop: 0 }}>
          <div className="cp-inner cp-faq-wrap">
            <div className="cp-faq-heading reveal">
              <span className="cp-eyebrow">FLOW53 DESIGN - FAQ</span>
              <h2 className="cp-faq-title">Got questions?</h2>
              <p className="cp-faq-desc">Here&rsquo;s what you need to know before we get started.</p>
            </div>
            <div className="reveal">
              <FaqAccordion />
            </div>
          </div>
        </section>

        {testimonials.length > 0 && (
          <section className="section testimonials-section" id="reviews">
            <div className="cp-collage" aria-hidden="true">
              {[
                { imgs: ["/contact/collage/photo-3.png", "/contact/collage/photo-4.png"], offset: 50 },
                { imgs: ["/contact/collage/photo-5.png", "/contact/collage/photo-6.png"], offset: 0 },
                { imgs: ["/contact/collage/photo-1.png"], tall: true, offset: 54 },
                { imgs: ["/contact/collage/photo-2.png"], offset: 4 },
                { imgs: ["/contact/collage/photo-8.png"], offset: 4, flip: true },
                { imgs: ["/contact/collage/photo-7.png"], tall: true, offset: 54, flip: true },
                { imgs: ["/contact/collage/photo-11.png", "/contact/collage/photo-12.png"], offset: 0, flip: true },
                { imgs: ["/contact/collage/photo-9.png", "/contact/collage/photo-10.png"], offset: 50, flip: true },
              ].map((col, i) => (
                <div key={i} className="cp-collage-col" style={{ marginTop: col.offset }}>
                  {col.imgs.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt=""
                      className={`cp-collage-photo${col.tall ? " tall" : ""}`}
                      style={col.flip ? { transform: "scaleX(-1)" } : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="testimonials-inner reveal">
              <div className="testimonials-heading">
                <span className="testimonials-eyebrow">
                  <img src="/stats/line.svg" alt="" />
                  <span>TESTIMONIALS</span>
                </span>
                <div className="testimonials-heading-copy">
                  <h2 className="testimonials-title">Don&rsquo;t Just Take Our Word For It!</h2>
                  <p className="testimonials-lead">
                    Hear from the people we&rsquo;ve worked with and discover how thoughtful collaboration, clear communication, and purposeful design
                    shaped their experience with us.
                  </p>
                </div>
              </div>

              <TestimonialsGrid
                testimonials={testimonials.map((t) => ({
                  name: t.name,
                  role: t.role,
                  quote: t.quote,
                  rating: t.rating,
                  avatar: t.avatar_url ? driveThumbnailUrl(t.avatar_url) : null,
                }))}
              />
            </div>
          </section>
        )}

        <section className="section cta-final-section" id="contact">
          <div className="cta-final-inner reveal">
            <div className="cta-final-card">
              <div className="cta-final-deco" aria-hidden="true">
                <span className="cta-deco-badge cta-deco-figma">
                  <img src="/cta/icon-figma.svg" alt="" />
                </span>
                <img src="/cta/icon-xd-a.svg" alt="" className="cta-deco-plain cta-deco-xd" />
                <img src="/cta/icon-spiral.svg" alt="" className="cta-deco-plain cta-deco-spiral" />
                <img src="/cta/icon-sunburst.svg" alt="" className="cta-deco-plain cta-deco-sunburst" />
                <img src="/cta/icon-framer.svg" alt="" className="cta-deco-plain cta-deco-framer" />
                <span className="cta-deco-badge cta-deco-illustrator">
                  <img src="/cta/icon-illustrator.svg" alt="" />
                </span>
              </div>
              <div className="cta-final-heading">
                <span className="cta-final-eyebrow">
                  <img src="/stats/line.svg" alt="" />
                  <span>CALL TO ACTION</span>
                </span>
                <div className="cta-final-heading-copy">
                  <h2 className="cta-final-title">Have Something Worth Building?</h2>
                  <p className="cta-final-lead">
                    Tell us what you&rsquo;re thinking, where you&rsquo;re stuck, or what you want to improve. We&rsquo;ll help you turn the next idea into
                    something worth experiencing.
                  </p>
                </div>
              </div>

              <div className="cta-final-buttons">
                <a href="/client/register" className="cta-final-btn primary">
                  <span className="cta-final-btn-inner">
                    <SlideSwapLabel text="Start A Project" />
                  </span>
                  <img src="/cta/icon-arrow.svg" alt="" className="cta-final-btn-icon" />
                </a>
                <a href={bookCallUrl} target="_blank" rel="noopener noreferrer" className="cta-final-btn secondary">
                  <span className="cta-final-btn-inner">
                    <SlideSwapLabel text="Book A Call" />
                  </span>
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
          <img src="/brand/logo-band.webp" alt="" className="brand-band-img" />
        </section>

        <LandingFooter settings={settings} />
      </div>

      <RevealOnScroll />
    </div>
  );
}
