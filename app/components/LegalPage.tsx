import "../home.css";
import "./legal.css";
import { fetchSiteSettings, buildWhatsappUrl, BOOK_CALL_MESSAGE } from "@/lib/siteSettings";
import { interStats, nunito, playfair } from "@/app/fonts";
import LandingNav from "@/app/components/LandingNav";
import LandingFooter from "@/app/components/LandingFooter";

// Privacy/Terms — দুটো পেজই একই লেআউট শেয়ার করে। Google OAuth consent screen-এ
// এই দুটো পাবলিক URL লাগে।
export type LegalSection = { heading: string; body: string[] };

export default async function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const settings = await fetchSiteSettings();
  const bookCallUrl = buildWhatsappUrl(settings.bookCallPhone, BOOK_CALL_MESSAGE);

  return (
    <div className={`home-root ${nunito.variable} ${playfair.variable} ${interStats.variable}`}>
      <LandingNav bookCallUrl={bookCallUrl} />
      <div className="home-body">
        <main className="legal-main">
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
          <p className="legal-text">{intro}</p>
          {sections.map((s) => (
            <section key={s.heading} className="legal-section">
              <h2 className="legal-heading">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="legal-text">{p}</p>
              ))}
            </section>
          ))}
          <p className="legal-text">
            Questions? Contact us at <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.
          </p>
        </main>
      </div>
      <LandingFooter settings={settings} />
    </div>
  );
}
