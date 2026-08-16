'use client';

// Screen 8 — Create Project (from a client)। বাম দিকে ফর্ম, ডানে ক্লায়েন্টের
// জমা দেওয়া requirements read-only প্যানেলে (Screen 4-এর onboarding ডেটা) —
// যাতে প্রজেক্ট বানানোর সময় সেগুলো রেফারেন্স হিসেবে চোখের সামনে থাকে। ইনসার্ট
// শেপ /projects পেজের handleCreate-এর সাথে হুবহু মিলিয়ে রাখা হয়েছে (একই
// projects টেবিল, কোনো নতুন কলাম/টেবিল লাগেনি) — "team members" মাল্টি-অ্যাসাইন
// আর "currency" বাদ দেওয়া হয়েছে কারণ বিদ্যমান /projects ফ্লো-তেও এগুলোর কোনো
// কনসেপ্ট নেই (টাস্ক-লেভেলে assignee_id দিয়ে অ্যাসাইনমেন্ট হয়, প্রজেক্ট একটাই
// implicit ৳ কারেন্সি ব্যবহার করে) — না থাকা ফিচারের জন্য নতুন আনইউজড টেবিল
// বানানো এড়ানো হয়েছে।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import '../../clients.css';
import '../client-detail.css';
import './create-project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '/clients', active: true },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'layers', label: 'Portfolio', href: '/portfolio' },
  { icon: 'bar', label: 'Reports', href: '#' },
];
const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

const STATUS_OPTIONS: Record<string, string> = { active: 'চলছে', review: 'রিভিউ', on_hold: 'হোল্ডে' };

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ManagerOption = { id: string; full_name: string };
type ClientBrief = { id: string; company_name: string; status: string };
type Requirements = {
  project_name: string | null;
  project_type: string | null;
  project_description: string | null;
  goals: string | null;
  target_audience: string | null;
  required_features: string | null;
  expected_timeline: string | null;
  budget_range: string | null;
  reference_notes: string | null;
};

export default function CreateProjectPage() {
  const params = useParams();
  const clientId = params.id as string;
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  const [client, setClient] = useState<ClientBrief | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [budget, setBudget] = useState('');
  const [managerId, setManagerId] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user || !clientId) return;

    async function run() {
      const [clientRes, requirementsRes, profileRes, managersRes] = await Promise.all([
        supabase.from('clients').select('id, company_name, status').eq('id', clientId).maybeSingle(),
        supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ]);

      if (!clientRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setClient(clientRes.data as ClientBrief);
      const req = (requirementsRes.data as Requirements) ?? null;
      setRequirements(req);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setManagers((managersRes.data as ManagerOption[]) ?? []);
      setManagerId(user!.id);

      if (req?.project_name) setName(req.project_name);
      if (req?.project_type) setCategory(req.project_type);
      if (req?.project_description) setDescription(req.project_description);

      setLoading(false);
    }

    run();
  }, [user, clientId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !user || !client) return;

    setCreating(true);
    const { data, error: createError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        category: category.trim() || null,
        client_id: client.id,
        status,
        start_date: startDate || null,
        due_date: dueDate || null,
        budget: budget ? Number(budget) : null,
        description: description.trim() || null,
        project_manager_id: managerId || user.id,
        progress: 0,
      })
      .select('id, name')
      .single();

    if (createError) {
      setError(createError.message);
      setCreating(false);
      return;
    }

    await supabase.from('activity_log').insert([
      { actor_id: user.id, action: 'project_created', entity_type: 'project', entity_id: data.id, detail: `"${data.name}" প্রজেক্ট তৈরি করা হয়েছে` },
      { actor_id: user.id, action: 'project_created', entity_type: 'client', entity_id: client.id, detail: `"${data.name}" প্রজেক্ট তৈরি করা হয়েছে` },
    ]);

    if (client.status === 'lead' || client.status === 'submitted' || client.status === 'discussion') {
      await supabase.from('clients').update({ status: 'active' }).eq('id', client.id);
    }

    router.push(`/projects/${data.id}`);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (loading) {
    return (
      <div className={`clientslist-root client-detail-root${dark ? ' dark' : ''}`}>
        <div className="shell">
          <div className="main">
            <p style={{ padding: 40, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className={`clientslist-root client-detail-root${dark ? ' dark' : ''}`}>
        <div className="shell">
          <div className="main">
            <div style={{ padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>এই ক্লায়েন্ট পাওয়া যায়নি।</p>
              <Link href="/clients" className="btn btn-ghost btn-sm">
                Clients-এ ফিরে যান
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`clientslist-root client-detail-root create-project-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div>
                <div className="brand-name">FLOW 53</div>
                <div className="brand-sub">Innovate · Design · Elevate</div>
              </div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <Link key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </Link>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} dark={dark} />
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <div className="topbar-spacer"></div>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? 'moon' : 'sun'} />
            </button>
          </header>

          <main className="content">
            <div className="breadcrumb">
              <Link href="/clients">Clients</Link>
              <span className="sep">/</span>
              <Link href={`/clients/${client.id}`}>{client.company_name}</Link>
              <span className="sep">/</span>
              <span className="current">Create Project</span>
            </div>

            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Create Project for {client.company_name}
            </h1>
            <p className="page-sub" style={{ marginBottom: 20 }}>
              ক্লায়েন্টের জমা দেওয়া রিকোয়ারমেন্ট ডানপাশে দেখা যাবে, ফর্ম পূরণ করে প্রজেক্ট তৈরি করুন।
            </p>

            {error && <div className="error-banner">{error}</div>}

            <div className="detail-two-col create-project-grid">
              <form className="side-card create-form" onSubmit={handleCreate}>
                <div className="modal-field">
                  <label className="modal-label">Project Name</label>
                  <input className="modal-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: Acme Website Redesign" required autoFocus />
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Project Type</label>
                    <input className="modal-input" type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Status</label>
                    <select className="modal-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {Object.entries(STATUS_OPTIONS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Start Date</label>
                    <input className="modal-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Expected End Date</label>
                    <input className="modal-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Budget (৳)</label>
                    <input className="modal-input" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Project Manager</label>
                    <select className="modal-select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Description</label>
                  <textarea className="modal-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="প্রজেক্টের সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)" />
                </div>

                <div className="create-form-foot">
                  <Link href={`/clients/${client.id}`} className="btn btn-ghost btn-sm">
                    বাতিল
                  </Link>
                  <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !name.trim()}>
                    {creating ? 'তৈরি হচ্ছে…' : 'Create Project'}
                  </button>
                </div>
              </form>

              <div className="side-card">
                <div className="side-card-title">Client Requirements</div>
                {requirements ? (
                  <>
                    <div className="client-detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div>
                        <div className="client-detail-label">Timeline</div>
                        <div className="client-detail-value">{requirements.expected_timeline ?? '—'}</div>
                      </div>
                      <div>
                        <div className="client-detail-label">Budget Range</div>
                        <div className="client-detail-value">{requirements.budget_range ?? '—'}</div>
                      </div>
                    </div>
                    {requirements.goals && (
                      <div className="req-block">
                        <div className="client-detail-label">Goals</div>
                        <p className="req-text">{requirements.goals}</p>
                      </div>
                    )}
                    {requirements.target_audience && (
                      <div className="req-block">
                        <div className="client-detail-label">Target Audience</div>
                        <p className="req-text">{requirements.target_audience}</p>
                      </div>
                    )}
                    {requirements.required_features && (
                      <div className="req-block">
                        <div className="client-detail-label">Required Features</div>
                        <p className="req-text">{requirements.required_features}</p>
                      </div>
                    )}
                    {requirements.reference_notes && (
                      <div className="req-block">
                        <div className="client-detail-label">References</div>
                        <p className="req-text">{requirements.reference_notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="side-empty">এই ক্লায়েন্ট এখনো কোনো requirements জমা দেননি।</p>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
