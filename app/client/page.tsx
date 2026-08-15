import Link from 'next/link';
import './client.css';

// Screen 1 — Client Portal Entry। কোনো ডেটা ফেচ বা ইন্টারঅ্যাকশন নেই (শুধু দুটো
// লিংক), তাই Server Component হিসেবেই যথেষ্ট। "Sign In" ও "Create Client
// Account" পরের স্ক্রিনে (Screen 2, Screen 3) নিয়ে যাবে — সেগুলো এখনো তৈরি হয়নি,
// এক স্ক্রিন করে বানানোর সিদ্ধান্ত অনুযায়ী পরের ধাপে বানানো হবে।
export default function ClientPortalEntry() {
  return (
    <div className="client-entry-root">
      <div className="entry-card">
        <div className="entry-logo">
          <div className="entry-logo-mark" aria-hidden="true"></div>
          <div className="entry-logo-text">FLOW 53</div>
        </div>

        <span className="entry-eyebrow">Client Portal</span>
        <h1 className="entry-title">Welcome to Your Client Portal</h1>
        <p className="entry-desc">
          Manage your projects, payments, files, feedback and communication — all in one place.
        </p>

        <div className="entry-actions">
          <Link href="/client/sign-in" className="entry-btn entry-btn-primary">
            Sign In
          </Link>
          <Link href="/client/register" className="entry-btn entry-btn-secondary">
            Create Client Account
          </Link>
        </div>
      </div>

      <p className="entry-team-link">
        Part of the FLOW 53 team? <Link href="/dashboard">Sign in here →</Link>
      </p>
    </div>
  );
}
