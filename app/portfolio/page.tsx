'use client';

// Portfolio — পাবলিক ল্যান্ডিং পেজের Work সেকশনে দেখানো কেস স্টাডিগুলো আগে
// app/page.tsx-এ হার্ডকোড করা ছিল। এখন টিম এই পেজ থেকে নিজেই real কেস স্টাডি
// যোগ/এডিট/ডিলিট/পাবলিশ করতে পারবে — কোনো কোড পরিবর্তন ছাড়াই। প্রতিটা কেস
// স্টাডিতে ১৬টা নির্দিষ্ট সেকশন থাকে (Overview থেকে Team পর্যন্ত), প্রতিটা
// সেকশনে নিজস্ব লেখা + একাধিক মিডিয়া (ছবি/ভিডিও Drive-এ আপলোড, অথবা বাইরের
// যেকোনো লিংক — Figma/YouTube ইত্যাদি) থাকতে পারে। published না করা পর্যন্ত
// পাবলিক সাইটে দেখা যায় না।

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
  video: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
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
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
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

type SectionKey =
  | 'overview' | 'problem_solution' | 'user_persona' | 'empathy_map' | 'competitive_analysis'
  | 'moscow' | 'kano' | 'ia_sitemap' | 'user_flow' | 'wireframe' | 'screens_brief' | 'mockups'
  | 'prototype' | 'usability_testing' | 'ai_help' | 'team';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'problem_solution', label: 'Problem & Solution' },
  { key: 'user_persona', label: 'User Persona' },
  { key: 'empathy_map', label: 'Empathy Map' },
  { key: 'competitive_analysis', label: 'Competitive Analysis' },
  { key: 'moscow', label: 'MoSCoW Model' },
  { key: 'kano', label: 'Kano Model' },
  { key: 'ia_sitemap', label: 'Information Architecture / Site Map' },
  { key: 'user_flow', label: 'User Flow' },
  { key: 'wireframe', label: 'Wireframe' },
  { key: 'screens_brief', label: 'Screens Brief' },
  { key: 'mockups', label: 'Mockups' },
  { key: 'prototype', label: 'Prototype' },
  { key: 'usability_testing', label: 'Usability Testing' },
  { key: 'ai_help', label: 'AI Help' },
  { key: 'team', label: 'Team' },
];

type MediaType = 'image' | 'video' | 'link';

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

type CSSection = { id: string; case_study_id: string; section_key: SectionKey; content: string | null };
type CSMedia = { id: string; case_study_id: string; section_key: SectionKey; media_type: MediaType; url: string; caption: string | null; order_index: number };

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'লিংক';
  }
}

async function fetchAll() {
  const [csRes, secRes, medRes] = await Promise.all([
    supabase.from('case_studies').select('id, slug, title, client_name, summary, tags, cover_image, figma_prototype_url, order_index, published').order('order_index'),
    supabase.from('case_study_sections').select('id, case_study_id, section_key, content'),
    supabase.from('case_study_media').select('id, case_study_id, section_key, media_type, url, caption, order_index').order('order_index'),
  ]);
  return {
    errorMessage: csRes.error?.message ?? secRes.error?.message ?? medRes.error?.message ?? null,
    caseStudies: (csRes.data as CaseStudy[]) ?? [],
    sections: (secRes.data as CSSection[]) ?? [],
    media: (medRes.data as CSMedia[]) ?? [],
  };
}

export default function PortfolioPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [sections, setSections] = useState<CSSection[]>([]);
  const [media, setMedia] = useState<CSMedia[]>([]);
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
  const [deleting, setDeleting] = useState(false);

  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [sectionDraft, setSectionDraft] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [uploadingSection, setUploadingSection] = useState<SectionKey | null>(null);
  const [uploadInfo, setUploadInfo] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  async function reload() {
    const result = await fetchAll();
    setError(result.errorMessage);
    setCaseStudies(result.caseStudies);
    setSections(result.sections);
    setMedia(result.media);
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
      setSections(result.sections);
      setMedia(result.media);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }
    run();
  }, [user]);

  const kpis = useMemo(() => ({
    total: caseStudies.length,
    published: caseStudies.filter((c) => c.published).length,
    draft: caseStudies.filter((c) => !c.published).length,
    media: media.length,
  }), [caseStudies, media]);

  const sectionsByCS = useMemo(() => {
    const map = new Map<string, CSSection[]>();
    for (const s of sections) {
      const arr = map.get(s.case_study_id) ?? [];
      arr.push(s);
      map.set(s.case_study_id, arr);
    }
    return map;
  }, [sections]);

  const mediaByCS = useMemo(() => {
    const map = new Map<string, CSMedia[]>();
    for (const m of media) {
      const arr = map.get(m.case_study_id) ?? [];
      arr.push(m);
      map.set(m.case_study_id, arr);
    }
    return map;
  }, [media]);

  function csStatsText(csId: string) {
    const secRows = sectionsByCS.get(csId) ?? [];
    const medRows = mediaByCS.get(csId) ?? [];
    const filledKeys = new Set<string>();
    for (const s of secRows) if (s.content && s.content.trim()) filledKeys.add(s.section_key);
    for (const m of medRows) filledKeys.add(m.section_key);
    return `${filledKeys.size}/${SECTIONS.length} সেকশন পূরণ · ${medRows.length}টা মিডিয়া`;
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
    setOpenSection(null);
    setNewLinkUrl('');

    const draft: Record<string, string> = {};
    for (const sec of SECTIONS) {
      const row = sections.find((s) => s.case_study_id === cs.id && s.section_key === sec.key);
      draft[sec.key] = row?.content ?? '';
    }
    setSectionDraft(draft);
  }

  function closeEditor() {
    setEditingId(null);
  }

  function toggleSection(key: SectionKey) {
    setOpenSection((prev) => (prev === key ? null : key));
    setNewLinkUrl('');
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

  async function handleSaveSectionContent(key: SectionKey) {
    if (!editingId) return;
    setSavingSection(key);
    setSaveError(null);
    const { data, error: err } = await supabase
      .from('case_study_sections')
      .upsert({ case_study_id: editingId, section_key: key, content: sectionDraft[key]?.trim() || null }, { onConflict: 'case_study_id,section_key' })
      .select('id, case_study_id, section_key, content')
      .single();
    setSavingSection(null);

    if (err || !data) {
      setSaveError(err?.message ?? 'সেকশনের লেখা সেভ করা যায়নি।');
      return;
    }
    setSections((prev) => {
      const row = data as CSSection;
      return prev.some((s) => s.id === row.id) ? prev.map((s) => (s.id === row.id ? row : s)) : [...prev, row];
    });
  }

  async function handleAddMedia(key: SectionKey, files: FileList | null) {
    if (!editingId || !files || files.length === 0) return;
    // input-এর value পরে রিসেট করা হয় (একই ফাইল আবার বাছাই করা যায় সেজন্য) —
    // FileList টা লাইভ, input.value='' করলেই এটাও খালি হয়ে যায়। তাই await-এর
    // আগেই, সিঙ্ক্রোনাসলি একটা আসল কপি (File[]) বানিয়ে রাখা হচ্ছে।
    const fileArr = Array.from(files);
    setUploadingSection(key);
    setSaveError(null);
    const existing = media.filter((m) => m.case_study_id === editingId && m.section_key === key);
    let nextOrder = existing.reduce((m, i) => Math.max(m, i.order_index), -1) + 1;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSaveError('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      setUploadingSection(null);
      return;
    }

    for (let i = 0; i < fileArr.length; i++) {
      setUploadInfo(`আপলোড হচ্ছে (${i + 1}/${fileArr.length})…`);
      try {
        const result = await uploadFileToDrive(fileArr[i], session.access_token);
        const mediaType: MediaType = fileArr[i].type.startsWith('video/') ? 'video' : 'image';
        const { data, error: err } = await supabase
          .from('case_study_media')
          .insert({ case_study_id: editingId, section_key: key, media_type: mediaType, url: result.webViewLink, order_index: nextOrder })
          .select('id, case_study_id, section_key, media_type, url, caption, order_index')
          .single();
        if (err || !data) throw new Error(err?.message ?? 'মিডিয়া সেভ করা যায়নি।');
        setMedia((prev) => [...prev, data as CSMedia]);
        nextOrder += 1;
      } catch (err) {
        setSaveError(err instanceof Error ? `"${fileArr[i].name}" সেভ করা যায়নি: ${err.message}` : 'একটা ফাইল আপলোড ব্যর্থ হয়েছে।');
      }
    }
    setUploadingSection(null);
    setUploadInfo('');
  }

  async function handleAddLink(key: SectionKey) {
    if (!editingId) return;
    const raw = newLinkUrl.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const existing = media.filter((m) => m.case_study_id === editingId && m.section_key === key);
    const nextOrder = existing.reduce((m, i) => Math.max(m, i.order_index), -1) + 1;

    const { data, error: err } = await supabase
      .from('case_study_media')
      .insert({ case_study_id: editingId, section_key: key, media_type: 'link', url, order_index: nextOrder })
      .select('id, case_study_id, section_key, media_type, url, caption, order_index')
      .single();

    if (err || !data) {
      setSaveError(err?.message ?? 'লিংক সেভ করা যায়নি।');
      return;
    }
    setMedia((prev) => [...prev, data as CSMedia]);
    setNewLinkUrl('');
  }

  async function handleRemoveMedia(id: string) {
    const { error: err } = await supabase.from('case_study_media').delete().eq('id', id);
    if (err) return;
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleMoveMedia(key: SectionKey, id: string, dir: -1 | 1) {
    if (!editingId) return;
    const list = media.filter((m) => m.case_study_id === editingId && m.section_key === key).sort((a, b) => a.order_index - b.order_index);
    const idx = list.findIndex((m) => m.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    setMedia((prev) => prev.map((m) => (m.id === a.id ? { ...m, order_index: b.order_index } : m.id === b.id ? { ...m, order_index: a.order_index } : m)));
    await Promise.all([
      supabase.from('case_study_media').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('case_study_media').update({ order_index: a.order_index }).eq('id', b.id),
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
    if (!window.confirm(`"${title}" কেস স্টাডিটা মুছে ফেলতে চান? এর সব সেকশন ও মিডিয়াও মুছে যাবে — এই অ্যাকশন ফেরানো যাবে না।`)) return;
    setDeleting(true);
    const { error: err } = await supabase.from('case_studies').delete().eq('id', id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCaseStudies((prev) => prev.filter((c) => c.id !== id));
    setSections((prev) => prev.filter((s) => s.case_study_id !== id));
    setMedia((prev) => prev.filter((m) => m.case_study_id !== id));
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
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="image" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.media}</div><div className="kpi-label">Total Media</div><div className="kpi-deco"><Icon name="image" size={56} /></div></div>
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
                          <div className="cs-section-counts">{csStatsText(cs.id)}</div>
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
              <p className="field-hint">তৈরি হওয়ার পর ডিটেইলস (স্লাগ, ছবি, ট্যাগ, সব সেকশন) এডিট করতে পারবেন।</p>
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

              <label className="field-label">Figma প্রোটোটাইপ লিংক (ঐচ্ছিক — /work পেজে উপরে লাইভ embed হিসেবে দেখাবে)</label>
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

            {saveError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 14, padding: '8px 10px', background: 'var(--danger-soft)', borderRadius: 'var(--radius-sm)' }}>{saveError}</p>}

            <div className="modal-section-title"><Icon name="layers" size={14} /> কেস স্টাডি সেকশন ({SECTIONS.length})</div>

            <div className="acc-list">
              {SECTIONS.map((sec) => {
                const isOpen = openSection === sec.key;
                const sectionMedia = media.filter((m) => m.case_study_id === editing.id && m.section_key === sec.key).sort((a, b) => a.order_index - b.order_index);
                const hasContent = !!(sectionDraft[sec.key] && sectionDraft[sec.key].trim());
                return (
                  <div className={`acc-item${isOpen ? ' open' : ''}`} key={sec.key}>
                    <button type="button" className="acc-head" onClick={() => toggleSection(sec.key)}>
                      <span className="acc-head-label">{sec.label}</span>
                      <span className="acc-head-meta">
                        {hasContent && <span className="acc-dot" title="লেখা যোগ করা হয়েছে"></span>}
                        {sectionMedia.length > 0 && <span className="acc-count">{sectionMedia.length}</span>}
                        <span className="acc-chevron"><Icon name="chevron-down" size={14} /></span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="acc-body">
                        <textarea
                          className="field-input"
                          rows={4}
                          value={sectionDraft[sec.key] ?? ''}
                          onChange={(e) => setSectionDraft((prev) => ({ ...prev, [sec.key]: e.target.value }))}
                          placeholder={`${sec.label} নিয়ে লিখুন...`}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                          <button type="button" className="btn btn-accent btn-xs" disabled={savingSection === sec.key} onClick={() => handleSaveSectionContent(sec.key)}>
                            {savingSection === sec.key ? 'সেভ হচ্ছে…' : 'লেখা সেভ করুন'}
                          </button>
                        </div>

                        <div className="img-thumb-grid">
                          {sectionMedia.map((m, i) => (
                            <div className="img-thumb" key={m.id}>
                              {m.media_type === 'link' ? (
                                <a href={m.url} target="_blank" rel="noopener noreferrer" className="media-link-tile">
                                  <Icon name="link" size={16} />
                                  <span>{linkLabel(m.url)}</span>
                                </a>
                              ) : (
                                <img src={driveThumbnailUrl(m.url)} alt="" />
                              )}
                              {m.media_type === 'video' && <span className="media-type-badge"><Icon name="video" size={11} color="#fff" /></span>}
                              <button className="img-thumb-remove" onClick={() => handleRemoveMedia(m.id)} aria-label="মুছে ফেলুন">✕</button>
                              <div className="img-thumb-move">
                                <button onClick={() => handleMoveMedia(sec.key, m.id, -1)} disabled={i === 0} aria-label="আগে সরান">◀</button>
                                <button onClick={() => handleMoveMedia(sec.key, m.id, 1)} disabled={i === sectionMedia.length - 1} aria-label="পরে সরান">▶</button>
                              </div>
                            </div>
                          ))}
                          <input
                            id={`media-input-${sec.key}`}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => { handleAddMedia(sec.key, e.target.files); e.target.value = ''; }}
                          />
                          <button type="button" className="img-add-tile" disabled={uploadingSection === sec.key} onClick={() => document.getElementById(`media-input-${sec.key}`)?.click()}>
                            <Icon name="plus" size={16} />
                            {uploadingSection === sec.key ? uploadInfo : 'ছবি/ভিডিও যোগ করুন'}
                          </button>
                        </div>

                        <div className="link-add-row">
                          <input
                            className="field-input"
                            style={{ marginBottom: 0 }}
                            type="url"
                            placeholder="https://... (Figma/YouTube/অন্য যেকোনো লিংক পেস্ট করুন)"
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" disabled={!newLinkUrl.trim()} onClick={() => handleAddLink(sec.key)}>লিংক যোগ করুন</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
