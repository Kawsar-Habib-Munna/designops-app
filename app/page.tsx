import Link from "next/link";
import "./home.css";

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  columns:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M15 4v16"/>',
};

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}

const FEATURES: {
  icon: keyof typeof ICON_PATHS;
  title: string;
  desc: string;
  href: string;
}[] = [
  {
    icon: "grid",
    title: "ড্যাশবোর্ড",
    desc: "প্রজেক্ট, ডেডলাইন ও টিমের এক নজরে ওভারভিউ।",
    href: "/dashboard",
  },
  {
    icon: "folder",
    title: "প্রজেক্টস",
    desc: "ক্লায়েন্ট প্রজেক্ট, মাইলস্টোন ও ফাইল একসাথে।",
    href: "/projects",
  },
  {
    icon: "check",
    title: "টাস্কস",
    desc: "টাস্ক তৈরি, অ্যাসাইন ও স্ট্যাটাস ট্র্যাক করুন।",
    href: "/tasks",
  },
  {
    icon: "columns",
    title: "বোর্ড",
    desc: "কানবান ভিউতে রিয়েল-টাইম ওয়ার্কফ্লো।",
    href: "/board",
  },
  {
    icon: "calendar",
    title: "ক্যালেন্ডার",
    desc: "মিটিং, ডেডলাইন ও মাইলস্টোন এক জায়গায়।",
    href: "/calendar",
  },
  {
    icon: "users",
    title: "টিম",
    desc: "ওয়ার্কলোড ও ক্যাপাসিটি রিয়েল ডেটা দিয়ে।",
    href: "/team",
  },
];

export default function Home() {
  return (
    <div className="home-root">
      <div className="glow"></div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">DS</div>
          <div>
            <div className="brand-name">DesignOps</div>
            <div className="brand-sub">Studio Nine</div>
          </div>
        </div>
        <Link href="/dashboard" className="topbar-cta">
          লগ-ইন করুন
        </Link>
      </header>

      <main className="hero">
        <span className="eyebrow">
          <span className="dot"></span> Studio Nine এর জন্য তৈরি
        </span>
        <h1>
          DesignOps
          <br />
        </h1>
        <p className="lede">
          Supabase-চালিত DesignOps এজেন্সি টুল — ক্লায়েন্ট, প্রজেক্ট, টাস্ক ও
          টিম শিডিউল এক ড্যাশবোর্ড থেকে সামলান।
        </p>
        <div className="cta-row">
          <Link href="/dashboard" className="btn btn-accent">
            ড্যাশবোর্ড দেখুন
          </Link>
          <Link href="/tasks" className="btn btn-ghost">
            টাস্ক লিস্ট দেখুন
          </Link>
        </div>
      </main>

      <section className="features" aria-label="ফিচার">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="feature-card">
            <div className="feature-icon">
              <Icon name={f.icon} />
            </div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </Link>
        ))}
      </section>

      <footer className="foot">
        © {new Date().getFullYear()} DesignOps · Studio Nine
      </footer>
    </div>
  );
}
