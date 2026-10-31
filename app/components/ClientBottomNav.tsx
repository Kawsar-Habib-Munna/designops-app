// Mobile tab bar for the client portal: the five places a client goes most, always one thumb-tap away.
// Hidden on desktop (the sidebar does the job there) via client-bottom-nav.css.
import Link from 'next/link';
import './client-bottom-nav.css';

const ICONS: Record<string, string> = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  project: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="6" width="20" height="14" rx="2"/>',
  files: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  chats: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  sow: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
};

export type ClientTab = 'overview' | 'project' | 'messages' | 'sow' | 'payments' | 'files';

// (messages are still reachable from the menu and the Overview; `unread` is accepted so existing pages keep working)
export default function ClientBottomNav({ projectId, active }: { projectId: string | null; active: ClientTab; unread?: number }) {
  const base = projectId ? `/client/project/${projectId}` : null;
  const items: { key: ClientTab; label: string; icon: string; href: string | null }[] = [
    { key: 'overview', label: 'Home', icon: 'home', href: '/client/dashboard' },
    { key: 'project', label: 'Project', icon: 'project', href: base },
    { key: 'files', label: 'Files', icon: 'files', href: base && `${base}/files` },
    { key: 'sow', label: 'SOW', icon: 'sow', href: base && `${base}/sow` },
    { key: 'payments', label: 'Payments', icon: 'wallet', href: base && `${base}/payments` },
  ];
  return (
    <nav className="cbn" aria-label="Main navigation">
      {items.map((it) => {
        const inner = (
          <>
            <span className="cbn-icon">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[it.icon] }} />
            </span>
            <span className="cbn-label">{it.label}</span>
          </>
        );
        return it.href ? (
          <Link key={it.key} href={it.href} className={`cbn-item${it.key === active ? ' active' : ''}`} aria-current={it.key === active ? 'page' : undefined}>
            {inner}
          </Link>
        ) : (
          <span key={it.key} className="cbn-item disabled" aria-disabled="true">
            {inner}
          </span>
        );
      })}
    </nav>
  );
}
