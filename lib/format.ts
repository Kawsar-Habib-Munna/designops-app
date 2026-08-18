// dashboard, tasks ও project-details পেজ — সবখানে ব্যবহৃত তারিখ/সময় ফরম্যাটিং হেল্পার।

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatBnDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}

export function formatBnDateLong(d: string | null) {
  if (!d) return '';
  const date = new Date(d);
  const dayMonth = date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' });
  const year = date.getFullYear().toLocaleString('bn-BD', { useGrouping: false });
  return `${dayMonth}, ${year}`;
}

export function dueMeta(dueDate: string | null, status: string): { text: string; cls: '' | 'soon' | 'overdue' } {
  if (!dueDate) return { text: '', cls: '' };
  if (status === 'done') return { text: formatBnDate(dueDate), cls: '' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d লেট`, cls: 'overdue' };
  if (diffDays === 0) return { text: 'আজকে', cls: 'soon' };
  return { text: `${diffDays}d বাকি`, cls: '' };
}

// Postgres 'time' কলাম থেকে আসা "HH:MM:SS" স্ট্রিং -> "3:30 PM" ফরম্যাট।
export function formatTimeBn(t: string | null) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${period}`;
}

// Trusted server timestamp (timestamptz) -> "Aug 24, 2026 · 10:42 AM BST" (viewer-এর
// লোকাল টাইমজোনে, ইংরেজি লোকেলে — Signed SOW-এর মতো অফিসিয়াল টাইমস্ট্যাম্প দেখানোর জন্য)।
export function formatDateTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${datePart} · ${timePart}`;
}

export function relativeTimeBn(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return 'এইমাত্র';
  if (diffMin < 60) return `${diffMin} মিনিট আগে`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ঘণ্টা আগে`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} দিন আগে`;
  return formatBnDate(dateStr);
}
