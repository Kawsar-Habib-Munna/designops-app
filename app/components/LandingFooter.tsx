import Link from 'next/link';

// পাবলিক ল্যান্ডিং পেজ ও প্রতিটা কেস স্টাডি ডিটেইল পেজ (/work/[slug]) — দুটোতেই
// একই ফুটার শেয়ার করা হয় যাতে ডুপ্লিকেট না হয়। শুধু আসল, কার্যকর লিংকই রাখা
// হয়েছে (Instagram/LinkedIn-এর মতো ভুয়া "#" লিংক বাদ) — WhatsApp গ্রুপই এখন
// পর্যন্ত টিমের একমাত্র real পাবলিক কন্টাক্ট চ্যানেল।
const WHATSAPP_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20interested%20in%20your%20UI%2FUX%20design%20services.%20I%27d%20like%20to%20discuss%20my%20project';

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" className="nav-logo footer-logo">
              <img src="/Navbar logo.png" alt="FLOW 53" className="nav-logo-img footer-logo-img" />
            </Link>
            <p className="footer-tagline">We design digital products people actually love to use.</p>
          </div>

          <div className="footer-col">
            <div className="footer-col-title">Explore</div>
            <Link href="/#work" className="footer-link">Work</Link>
            <Link href="/#process" className="footer-link">Process</Link>
            <Link href="/#services" className="footer-link">Services</Link>
            <Link href="/#team" className="footer-link">Team</Link>
          </div>

          <div className="footer-col">
            <div className="footer-col-title">Get in touch</div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="footer-link">WhatsApp</a>
            <Link href="/dashboard" className="footer-link">Team Login</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span className="footer-copy">© {new Date().getFullYear()} FLOW 53 Studio. Dhaka, Bangladesh.</span>
        </div>
      </div>
    </footer>
  );
}
