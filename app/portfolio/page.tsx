'use client';

// Portfolio — পাবলিক ল্যান্ডিং পেজের Work সেকশনে দেখানো কেস স্টাডিগুলো আগে
// app/page.tsx-এ হার্ডকোড করা ছিল (Aarambho/Nilkantha/Prantik Bank placeholder)।
// এখন টিম এই পেজ থেকে নিজেই real কেস স্টাডি (wireframe/prototype/final UI
// ছবি + Figma prototype লিংক) যোগ/এডিট/ডিলিট/পাবলিশ করতে পারবে — কোনো কোড
// পরিবর্তন ছাড়াই। published না করা পর্যন্ত পাবলিক সাইটে দেখা যায় না।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './portfolio.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';
import Avatar from '@/app/components/Avatar';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
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
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  up: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'layers', label: 'Portfolio', href: '/portfolio', active: true },
  { icon: 'bar', label: 'Reports', href: '#' },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };

type Section = 'wireframe' | 'prototype' | 'final_ui';

const SECTION_ORDER: Section[] = ['wireframe', 'prototype', 'final_ui'];
const SECTION_LABEL: Record<Section, string> = { wireframe: 'ওয়্যারফ্রেম', prototype: 'প্রোটোটাইপ', final_ui: 'ফাইনাল UI' };

type CaseStudy = {
  id: string;
  slug: string;
  title: string;
  client_name: string | null;
  summary: string | null;
  tags: string[] | null;
  cover_image: string | null;
  figma_prototype_url: string | null;
  order_index: number;
  published: boolean;
};

type CSImage = { id: string; case_study_id: string; section: Section; image_url: string; caption: string | null; order_index: number };

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchAll() {
  const [csRes, imgRes] = await Promise.all([
    supabase.from('case_studies').select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published').order('order_index'),
    supabase.from('case_study_images').select('id, case_study_id, section, image_url, caption, order_index').order('order_index'),
  ]);
  return {
    errorMessage: csRes.error?.message ?? imgRes.error?.message ?? null,
    caseStudies: (csRes.data as CaseStudy[]) ?? [],
    images: (imgRes.data as CSImage[]) ?? [],
  };
}

export default function PortfolioPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [images, setImages] = useState<CSImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eSlug, setESlug] = useState('');
  const [eClient, setEClient] = useState('');
  const [eSummary, setESummary] = useState('');
  const [eTags, setETags] = useState('');
  const [eFigma, setEFigma] = useState('');
  const [ePublished, setEPublished] = useState(false);
  const [eCover, setECover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [uploadingSection, setUploadingSection] = useState<Section | null>(null);
  const [uploadInfo, setUploadInfo] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const result = await fetchAll();
    setError(result.errorMessage);
    setCaseStudies(result.caseStudies);
    setImages(result.images);
  }

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchAll(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setCaseStudies(result.caseStudies);
      setImages(result.images);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }
    run();
  }, [user]);

  const kpis = useMemo(() => ({
    total: caseStudies.length,
    published: caseStudies.filter((c) => c.published).length,
    draft: caseStudies.filter((c) => !c.published).length,
    images: images.length,
  }), [caseStudies, images]);

  const imagesByCS = useMemo(() => {
    const map = new Map<string, CSImage[]>();
    for (const img of images) {
      const arr = map.get(img.case_study_id) ?? [];
      arr.push(img);
      map.set(img.case_study_id, arr);
    }
    return map;
  }, [images]);

  function sectionCountsText(csId: string) {
    const imgs = imagesByCS.get(csId) ?? [];
    return SECTION_ORDER.map((s) => `${imgs.filter((i) => i.section === s).length} ${SECTION_LABEL[s]}`).join(' · ');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    let slug = slugify(newTitle);
    if (!slug) slug = `case-study-${Date.now().toString(36)}`;
    if (caseStudies.some((c) => c.slug === slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const maxOrder = caseStudies.reduce((m, c) => Math.max(m, c.order_index), 0);
    const { data, error: err } = await supabase
      .from('case_studies')
      .insert({ title: newTitle.trim(), slug, order_index: maxOrder + 1, published: false, created_by: profile?.id ?? null })
      .select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published')
      .single();
    setCreating(false);

    if (err || !data) {
      setCreateError(err?.message ?? 'কেস স্টাডি তৈরি করা যায়নি।');
      return;
    }

    setNewTitle('');
    setShowCreate(false);
    setCaseStudies((prev) => [...prev, data as CaseStudy]);
    openEditor(data as CaseStudy);
  }

  function openEditor(cs: CaseStudy) {
    setEditingId(cs.id);
    setETitle(cs.title);
    setESlug(cs.slug);
    setEClient(cs.client_name ?? '');
    setESummary(cs.summary ?? '');
    setETags((cs.tags ?? []).join(', '));
    setEFigma(cs.figma_prototype_url ?? '');
    setEPublished(cs.published);
    setECover(cs.cover_image);
    setSaveError(null);
  }

  function closeEditor() {
    setEditingId(null);
  }

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const slug = slugify(eSlug);
    if (!slug) {
      setSaveError('স্লাগ খালি রাখা যাবে না।');
      return;
    }
    setSaving(true);
    setSaveError(null);

    const tags = eTags.split(',').map((t) => t.trim()).filter(Boolean);
    const { data, error: err } = await supabase
      .from('case_studies')
      .update({
        title: eTitle.trim(),
        slug,
        client_name: eClient.trim() || null,
        summary: eSummary.trim() || null,
        tags,
        figma_prototype_url: eFigma.trim() || null,
        published: ePublished,
      })
      .eq('id', editingId)
      .select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published')
      .single();
    setSaving(false);

    if (err || !data) {
      setSaveError(err?.code === '23505' ? 'এই স্লাগ আগে থেকে ব্যবহৃত হয়েছে — অন্য একটা দিন।' : (err?.message ?? 'সেভ করা যায়নি।'));
      return;
    }

    setESlug(slug);
    setCaseStudies((prev) => prev.map((c) => (c.id === editingId ? (data as CaseStudy) : c)));
  }

  async function handleCoverFile(file: File) {
    if (!editingId) return;
    setCoverUploading(true);
    setCoverProgress(0);
    setSaveError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setCoverProgress);
      const { data, error: err } = await supabase
        .from('case_studies')
        .update({ cover_image: result.webViewLink })
        .eq('id', editingId)
        .select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published')
        .single();
      if (err || !data) throw new Error(err?.message ?? 'কভার ছবি সেভ করা যায়নি।');
      setECover(data.cover_image);
      setCaseStudies((prev) => prev.map((c) => (c.id === editingId ? (data as CaseStudy) : c)));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setCoverUploading(false);
      setCoverProgress(0);
    }
  }

  async function handleRemoveCover() {
    if (!editingId) return;
    const { data, error: err } = await supabase
      .from('case_studies')
      .update({ cover_image: null })
      .eq('id', editingId)
      .select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published')
      .single();
    if (err || !data) return;
    setECover(null);
    setCaseStudies((prev) => prev.map((c) => (c.id === editingId ? (data as CaseStudy) : c)));
  }

  async function handleAddImages(section: Section, files: FileList | null) {
    if (!editingId || !files || files.length === 0) return;
    setUploadingSection(section);
    setSaveError(null);
    const existing = images.filter((i) => i.case_study_id === editingId && i.section === section);
    let nextOrder = existing.reduce((m, i) => Math.max(m, i.order_index), -1) + 1;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSaveError('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      setUploadingSection(null);
      return;
    }

    const fileArr = Array.from(files);
    for (let i = 0; i < fileArr.length; i++) {
      setUploadInfo(`আপলোড হচ্ছে (${i + 1}/${fileArr.length})…`);
      try {
        const result = await uploadFileToDrive(fileArr[i], session.access_token);
        const { data, error: err } = await supabase
          .from('case_study_images')
          .insert({ case_study_id: editingId, section, image_url: result.webViewLink, order_index: nextOrder })
          .select('id, case_study_id, section, image_url, caption, order_index')
          .single();
        if (err || !data) throw new Error(err?.message ?? 'ছবি সেভ করা যায়নি।');
        setImages((prev) => [...prev, data as CSImage]);
        nextOrder += 1;
      } catch (err) {
        setSaveError(err instanceof Error ? `"${fileArr[i].name}" সেভ করা যায়নি: ${err.message}` : 'একটা ছবি আপলোড ব্যর্থ হয়েছে।');
      }
    }
    setUploadingSection(null);
    setUploadInfo('');
  }

  async function handleRemoveImage(id: string) {
    const { error: err } = await supabase.from('case_study_images').delete().eq('id', id);
    if (err) return;
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleMoveImage(section: Section, id: string, dir: -1 | 1) {
    if (!editingId) return;
    const list = images.filter((i) => i.case_study_id === editingId && i.section === section).sort((a, b) => a.order_index - b.order_index);
    const idx = list.findIndex((i) => i.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    setImages((prev) => prev.map((i) => (i.id === a.id ? { ...i, order_index: b.order_index } : i.id === b.id ? { ...i, order_index: a.order_index } : i)));
    await Promise.all([
      supabase.from('case_study_images').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('case_study_images').update({ order_index: a.order_index }).eq('id', b.id),
    ]);
  }

  async function handleMoveCaseStudy(id: string, dir: -1 | 1) {
    const sorted = [...caseStudies].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setCaseStudies((prev) => prev.map((c) => (c.id === a.id ? { ...c, order_index: b.order_index } : c.id === b.id ? { ...c, order_index: a.order_index } : c)));
    await Promise.all([
      supabase.from('case_studies').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('case_studies').update({ order_index: a.order_index }).eq('id', b.id),
    ]);
  }

  async function handleDeleteCaseStudy(id: string, title: string) {
    if (!window.confirm(`"${title}" কেস স্টাডিটা মুছে ফেলতে চান? এর সব ছবিও মুছে যাবে — এই অ্যাকশন ফেরানো যাবে না।`)) return;
    setDeleting(true);
    const { error: err } = await supabase.from('case_studies').delete().eq('id', id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCaseStudies((prev) => prev.filter((c) => c.id !== id));
    setImages((prev) => prev.filter((i) => i.case_study_id !== id));
    if (editingId === id) closeEditor();
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const sortedCaseStudies = [...caseStudies].sort((a, b) => a.order_index - b.order_index);
  const editing = caseStudies.find((c) => c.id === editingId) ?? null;

  return (
    <div className={`portfolio-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        {/* ============ SIDEBAR ============ */}
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div><div className="brand-name">FLOW 53</div><div className="brand-sub">Innovate · Design · Elevate</div></div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন"><Icon name="close" size={16} /></button>
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

        {/* ============ MAIN ============ */}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <button className="search-box">
              <Icon name="search" />
              <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — কেস স্টাডি...</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <a className="btn btn-ghost" href="/" target="_blank" rel="noopener noreferrer"><Icon name="globe" size={14} /> পাবলিক সাইট দেখুন</a>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}><Icon name={dark ? 'moon' : 'sun'} /></button>
            <Avatar person={profile} size={30} />
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">Portfolio</h1>
                <p className="page-sub">পাবলিক ল্যান্ডিং পেজের Work সেকশনে দেখানো কেস স্টাডি ম্যানেজ করুন — publish না করা পর্যন্ত এটা শুধু draft হিসেবে এখানেই থাকবে।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" size={13} /> রিলোড</button>
                <button className="btn btn-accent" onClick={() => { setNewTitle(''); setCreateError(null); setShowCreate(true); }}><Icon name="plus" /> নতুন কেস স্টাডি</button>
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="layers" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.total}</div><div className="kpi-label">Total Case Studies</div><div className="kpi-deco"><Icon name="layers" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="globe" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : kpis.published}</div><div className="kpi-label">Published</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="globe" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="edit" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>{loading ? '—' : kpis.draft}</div><div className="kpi-label">Draft</div><div className="kpi-deco" style={{ color: 'var(--warning)' }}><Icon name="edit" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="image" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.images}</div><div className="kpi-label">Total Images</div><div className="kpi-deco"><Icon name="image" size={56} /></div></div>
            </div>

            <section className="block">
              <div className="section-title-row"><span className="section-title">সব কেস স্টাডি</span></div>
              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
              ) : sortedCaseStudies.length === 0 ? (
                <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="layers" /></div><div className="empty-title">এখনো কোনো কেস স্টাডি নেই</div><div className="empty-sub">&ldquo;নতুন কেস স্টাডি&rdquo; চেপে প্রথমটা তৈরি করুন।</div></div></div>
              ) : (
                <div className="cs-grid">
                  {sortedCaseStudies.map((cs, i) => {
                    const cover = cs.cover_image ? driveThumbnailUrl(cs.cover_image) : null;
                    return (
                      <div className="cs-card" key={cs.id}>
                        <div className="cs-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
                          {!cover && <Icon name="image" size={28} />}
                          <div className="cs-order-btns">
                            <button onClick={() => handleMoveCaseStudy(cs.id, -1)} disabled={i === 0} aria-label="উপরে সরান"><Icon name="up" size={12} /></button>
                            <button onClick={() => handleMoveCaseStudy(cs.id, 1)} disabled={i === sortedCaseStudies.length - 1} aria-label="নিচে সরান"><Icon name="down" size={12} /></button>
                          </div>
                          <span className={`cs-badge ${cs.published ? 'pub' : 'draft'}`}>{cs.published ? 'Published' : 'Draft'}</span>
                        </div>
                        <div className="cs-body">
                          <div className="cs-title">{cs.title}</div>
                          {cs.client_name && <div className="cs-client">{cs.client_name}</div>}
                          {cs.summary && <div className="cs-summary">{cs.summary}</div>}
                          {cs.tags && cs.tags.length > 0 && (
                            <div className="cs-tags">{cs.tags.map((t) => <span className="cs-tag" key={t}>{t}</span>)}</div>
                          )}
                          <div className="cs-section-counts">{sectionCountsText(cs.id)}</div>
                          <div className="cs-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditor(cs)}><Icon name="edit" size={13} /> এডিট</button>
                            {cs.published && <a className="btn btn-ghost btn-sm" href={`/work/${cs.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={13} /> দেখুন</a>}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCaseStudy(cs.id, cs.title)}><Icon name="trash" size={13} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-box">
            <div className="modal-head-row"><span className="modal-title">নতুন কেস স্টাডি</span><button className="modal-close-btn" onClick={() => setShowCreate(false)}><Icon name="close" size={14} /></button></div>
            <form onSubmit={handleCreate}>
              <label className="field-label">টাইটেল</label>
              <input className="field-input" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="যেমন: Aarambho" autoFocus required />
              <p className="field-hint">তৈরি হওয়ার পর ডিটেইলস (স্লাগ, ছবি, ট্যাগ ইত্যাদি) এডিট করতে পারবেন।</p>
              {createError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{createError}</p>}
              <div className="modal-foot" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !newTitle.trim()}>{creating ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}>
          <div className="modal-box modal-box-lg">
            <div className="modal-head-row">
              <span className="modal-title">কেস স্টাডি এডিট করুন</span>
              <button className="modal-close-btn" onClick={closeEditor}><Icon name="close" size={14} /></button>
            </div>

            <form onSubmit={handleSaveMeta}>
              <div className="cover-row">
                <div className="cover-preview" style={eCover ? { backgroundImage: `url(${driveThumbnailUrl(eCover)})` } : undefined}>
                  {!eCover && <Icon name="image" size={22} />}
                </div>
                <div className="cover-actions">
                  <div className="cover-actions-row">
                    <input id="cover-file-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); }} />
                    <button type="button" className="btn btn-ghost btn-sm" disabled={coverUploading} onClick={() => document.getElementById('cover-file-input')?.click()}>{coverUploading ? `আপলোড হচ্ছে ${coverProgress}%` : 'কভার ছবি আপলোড'}</button>
                    {eCover && <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveCover}>সরান</button>}
                  </div>
                  <span className="field-hint" style={{ margin: 0 }}>কার্ডের থাম্বনেইল হিসেবে ব্যবহার হবে</span>
                </div>
              </div>

              <div className="field-row-2" style={{ marginBottom: 12 }}>
                <div>
                  <label className="field-label">টাইটেল</label>
                  <input className="field-input" style={{ marginBottom: 0 }} type="text" value={eTitle} onChange={(e) => setETitle(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label">স্লাগ (পাবলিক লিংক: /work/{eSlug || '...'})</label>
                  <input className="field-input" style={{ marginBottom: 0 }} type="text" value={eSlug} onChange={(e) => setESlug(e.target.value)} required />
                </div>
              </div>

              <label className="field-label">ক্লায়েন্ট (ঐচ্ছিক)</label>
              <input className="field-input" type="text" value={eClient} onChange={(e) => setEClient(e.target.value)} />

              <label className="field-label">সংক্ষিপ্ত বিবরণ (কার্ডে দেখাবে)</label>
              <textarea className="field-input" value={eSummary} onChange={(e) => setESummary(e.target.value)} rows={2} />

              <label className="field-label">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
              <input className="field-input" type="text" value={eTags} onChange={(e) => setETags(e.target.value)} placeholder="UI/UX design, Mobile App" />

              <label className="field-label">Figma প্রোটোটাইপ লিংক (ঐচ্ছিক)</label>
              <input className="field-input" type="url" value={eFigma} onChange={(e) => setEFigma(e.target.value)} placeholder="https://www.figma.com/proto/..." />

              <label className="field-check-row">
                <input type="checkbox" checked={ePublished} onChange={(e) => setEPublished(e.target.checked)} />
                পাবলিশ করুন (চালু থাকলে এটা পাবলিক ল্যান্ডিং পেজে দেখা যাবে)
              </label>

              {saveError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{saveError}</p>}

              <div className="modal-foot">
                <button type="button" className="btn btn-danger btn-sm" disabled={deleting} onClick={() => handleDeleteCaseStudy(editing.id, editing.title)}><Icon name="trash" size={13} /> ডিলিট করুন</button>
                <div className="modal-foot-right">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={closeEditor}>বন্ধ করুন</button>
                  <button type="submit" className="btn btn-accent btn-sm" disabled={saving}>{saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
                </div>
              </div>
            </form>

            {SECTION_ORDER.map((section) => {
              const sectionImages = images.filter((i) => i.case_study_id === editing.id && i.section === section).sort((a, b) => a.order_index - b.order_index);
              return (
                <div key={section}>
                  <div className="modal-section-title"><Icon name="image" size={14} /> {SECTION_LABEL[section]} ({sectionImages.length})</div>
                  <div className="img-thumb-grid">
                    {sectionImages.map((img, i) => (
                      <div className="img-thumb" key={img.id}>
                        <img src={driveThumbnailUrl(img.image_url)} alt="" />
                        <button className="img-thumb-remove" onClick={() => handleRemoveImage(img.id)} aria-label="মুছে ফেলুন">✕</button>
                        <div className="img-thumb-move">
                          <button onClick={() => handleMoveImage(section, img.id, -1)} disabled={i === 0} aria-label="আগে সরান">◀</button>
                          <button onClick={() => handleMoveImage(section, img.id, 1)} disabled={i === sectionImages.length - 1} aria-label="পরে সরান">▶</button>
                        </div>
                      </div>
                    ))}
                    <input id={`img-input-${section}`} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { handleAddImages(section, e.target.files); e.target.value = ''; }} />
                    <button type="button" className="img-add-tile" disabled={uploadingSection === section} onClick={() => document.getElementById(`img-input-${section}`)?.click()}>
                      <Icon name="plus" size={16} />
                      {uploadingSection === section ? uploadInfo : 'ছবি যোগ করুন'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
