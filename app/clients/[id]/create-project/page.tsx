'use client';

// Screen 8 — Create Project (from a client)। মূলনীতি: client onboarding-এ যা
// জমা দিয়েছে সেটা আবার টাইপ করানো যাবে না — সবকিছু pre-fill করে "Submitted by
// Client" ট্যাগ দিয়ে দেখানো হয়, admin শুধু রিভিউ/রিফাইন/অ্যাসাইন করে creates করে।
//
// Real-data সিদ্ধান্তসমূহ (fake UI এড়াতে):
// - "Project Team" (multi-select) বাদ দেওয়া হয়েছে — স্কিমাতে single
//   project_manager_id ছাড়া প্রজেক্ট-লেভেল মাল্টি-পারসন টিম অ্যাসাইনমেন্টের কোনো
//   real কনসেপ্ট নেই, আর ইউজার নিজেই বলেছেন নতুন team/member মডেল না বানাতে।
// - Capacity hint real — Team পেজের ঠিক একই ফর্মুলা রিইউজ করা হয়েছে
//   (activeTasks/5 * 100%, tasks.status != 'done')।
// - Scope/Deliverables structured input নেয় কিন্তু ছোট formatted-text কলামে
//   (projects.scope_note/deliverables_note) সেভ হয় — পূর্ণাঙ্গ structured
//   scope/deliverables/payment_terms আসলে sows টেবিলের কাজ (Screen 10-11),
//   এখানে শুধু agency-র প্রাথমিক প্ল্যানিং নোট।
// - Payment Structure শুধু commercial মডেল বেছে নেয় (real কলাম), কোনো ইনভয়েস
//   তৈরি করে না — সেটা Screen 12-এর কাজ।
// - Client Access (client_visible) real — নতুন RLS পলিসিতেই কাজ করে, Screen 5/9
//   কোনো কোড পরিবর্তন ছাড়াই hidden প্রজেক্ট আর দেখাবে না (hidden হলে client-এর
//   কাছে সেই projects row RLS-এই ফিল্টার হয়ে যায়)।
// - Notify Client real WhatsApp মেসেজ পাঠায় (এই কোডবেসে ক্লায়েন্টের জন্য কোনো
//   in-app push channel নেই, established pattern)।
// - Internal Note বিদ্যমান client_notes টেবিল রিইউজ করে (নতুন টেবিল লাগেনি)।
// - Save Draft নতুন কোনো draft architecture বানায়নি — একই insert, শুধু
//   status='draft', client_visible=false, notify বন্ধ।
// - Duplicate-name detection client-side, বিদ্যমান projects ডেটা থেকেই।

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import '../../clients.css';
import '../client-detail.css';
import './create-project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import { formatBnDate } from '@/lib/format';
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
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
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

const CLIENT_STATUS_META: Record<string, string> = {
  lead: 'লিড',
  submitted: 'তথ্য জমা হয়েছে',
  discussion: 'আলোচনা চলছে',
  active: 'সক্রিয়',
  retainer: 'রিটেইনার',
  completed: 'সম্পন্ন',
};

const PROJECT_TYPES = ['Website', 'Mobile App', 'Web App', 'SaaS Product', 'Dashboard', 'E-commerce', 'UI/UX Design', 'Product Design', 'Branding', 'Design System', 'UX Audit', 'Other'];
const STATUS_CREATE_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'on_hold', label: 'On Hold' },
];
const INCLUDED_PRESETS = ['UX Research', 'User Flow', 'Information Architecture', 'Wireframes', 'UI Design', 'Design System', 'Interactive Prototype', 'Developer Handoff', 'Development', 'Documentation'];
const EXCLUDED_PRESETS = ['Backend Development', 'App Store Submission', 'Content Writing', 'Marketing', 'Third-Party Subscription Fees'];
const DELIVERABLE_QUICK_ADD = ['Wireframes', 'High-Fidelity UI', 'Design System', 'Interactive Prototype', 'Developer Handoff'];
const DEFAULT_MILESTONES = ['Discovery', 'UX Design', 'UI Design', 'Client Review', 'Final Delivery'];
const PAYMENT_STRUCTURES: { value: string; title: string; sub: string }[] = [
  { value: 'full', title: 'Full Payment', sub: '100% upfront' },
  { value: 'deposit_final', title: 'Deposit + Final', sub: 'e.g. 50% / 50%' },
  { value: 'milestones', title: 'Milestone Payments', sub: 'Split across milestones' },
  { value: 'custom', title: 'Custom', sub: 'Define later' },
];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ManagerOption = { id: string; full_name: string; role: string | null; capacityPercent: number };
type ClientBrief = { id: string; company_name: string; primary_contact: string | null; contact_email: string | null; contact_phone: string | null; status: string };
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
  priority: string | null;
  competitors: string | null;
  existing_assets: string | null;
};
type FileRow = { id: string; name: string; file_type: string | null; drive_url: string; project_id: string | null };
type ExistingProject = { id: string; name: string };
type Deliverable = { id: string; name: string; description: string; quantity: string; milestone: string };

function formatBytesFileType(t: string | null) {
  return t ? t.toUpperCase() : 'FILE';
}
function waLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '880' + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('1')) digits = '880' + digits;
  return `https://wa.me/${digits}`;
}
function milestoneDateAt(start: string, end: string, index: number, total: number): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const t = s + ((e - s) * (index + 1)) / total;
  return new Date(t).toISOString().slice(0, 10);
}
function matchProjectType(raw: string | null): string {
  if (!raw) return '';
  const found = PROJECT_TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
  return found ?? '';
}
let deliverableSeq = 0;
function newDeliverableId() {
  deliverableSeq += 1;
  return `d${deliverableSeq}`;
}

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
  const [files, setFiles] = useState<FileRow[]>([]);
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // ---- form state ----
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('planning');

  const [scopeObjectives, setScopeObjectives] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [includedWork, setIncludedWork] = useState<string[]>([]);
  const [excludedWork, setExcludedWork] = useState<string[]>([]);
  const [includedCustom, setIncludedCustom] = useState('');
  const [excludedCustom, setExcludedCustom] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [useDefaultMilestones, setUseDefaultMilestones] = useState(true);

  const [budgetValue, setBudgetValue] = useState('');
  const [paymentStructure, setPaymentStructure] = useState('deposit_final');
  const [depositPercent, setDepositPercent] = useState(50);

  const [managerId, setManagerId] = useState('');

  const [clientVisible, setClientVisible] = useState(true);
  const [notifyClient, setNotifyClient] = useState(true);

  const [internalNote, setInternalNote] = useState('');

  const [creating, setCreating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<ExistingProject | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const prefilledRef = useRef(false);

  useEffect(() => {
    if (!user || !clientId) return;

    async function run() {
      const [clientRes, requirementsRes, filesRes, projectsRes, profileRes, profilesRes, tasksRes] = await Promise.all([
        supabase.from('clients').select('id, company_name, primary_contact, contact_email, contact_phone, status').eq('id', clientId).maybeSingle(),
        supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes, priority, competitors, existing_assets')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase.from('client_files').select('id, name, file_type, drive_url, project_id').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name').eq('client_id', clientId),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('tasks').select('assignee_id, status'),
      ]);

      if (!clientRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setClient(clientRes.data as ClientBrief);
      const req = (requirementsRes.data as Requirements) ?? null;
      setRequirements(req);
      setFiles((filesRes.data as FileRow[]) ?? []);
      setExistingProjects((projectsRes.data as ExistingProject[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      const activeCountByAssignee = new Map<string, number>();
      ((tasksRes.data as { assignee_id: string | null; status: string }[]) ?? []).forEach((t) => {
        if (!t.assignee_id || t.status === 'done') return;
        activeCountByAssignee.set(t.assignee_id, (activeCountByAssignee.get(t.assignee_id) ?? 0) + 1);
      });
      const managerRows: ManagerOption[] = ((profilesRes.data as { id: string; full_name: string; role: string | null }[]) ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        capacityPercent: Math.min(100, Math.round(((activeCountByAssignee.get(p.id) ?? 0) / 5) * 100)),
      }));
      setManagers(managerRows);
      setManagerId(user!.id);

      if (!prefilledRef.current && req) {
        prefilledRef.current = true;
        if (req.project_name) setName(req.project_name);
        const matchedType = matchProjectType(req.project_type);
        setProjectType(matchedType || req.project_type || '');
        if (req.project_description) setDescription(req.project_description);
      }

      setLoading(false);
    }

    run();
  }, [user, clientId]);

  const durationText = useMemo(() => {
    if (!startDate || !dueDate) return null;
    const days = (new Date(dueDate).getTime() - new Date(startDate).getTime()) / 86400000;
    if (days <= 0) return null;
    const weeks = Math.round((days / 7) * 10) / 10;
    return `${weeks} সপ্তাহ`;
  }, [startDate, dueDate]);

  const dateError = startDate && dueDate && dueDate <= startDate ? 'Delivery date must be after the start date.' : null;

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function toggleIncluded(item: string) {
    markDirty();
    setIncludedWork((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
    setExcludedWork((prev) => prev.filter((i) => i !== item));
  }
  function toggleExcluded(item: string) {
    markDirty();
    setExcludedWork((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
    setIncludedWork((prev) => prev.filter((i) => i !== item));
  }
  function addCustomIncluded() {
    if (!includedCustom.trim()) return;
    markDirty();
    setIncludedWork((prev) => [...prev, includedCustom.trim()]);
    setIncludedCustom('');
  }
  function addCustomExcluded() {
    if (!excludedCustom.trim()) return;
    markDirty();
    setExcludedWork((prev) => [...prev, excludedCustom.trim()]);
    setExcludedCustom('');
  }

  function addDeliverable(prefillName?: string) {
    markDirty();
    setDeliverables((prev) => [...prev, { id: newDeliverableId(), name: prefillName ?? '', description: '', quantity: '', milestone: '' }]);
  }
  function updateDeliverable(id: string, patch: Partial<Deliverable>) {
    markDirty();
    setDeliverables((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function removeDeliverable(id: string) {
    markDirty();
    setDeliverables((prev) => prev.filter((d) => d.id !== id));
  }

  function buildScopeNote(): string | null {
    const parts: string[] = [];
    if (scopeObjectives.trim()) parts.push(`Objectives:\n${scopeObjectives.trim()}`);
    if (scopeDescription.trim()) parts.push(`Scope:\n${scopeDescription.trim()}`);
    if (includedWork.length > 0) parts.push(`Included Work:\n${includedWork.map((i) => `• ${i}`).join('\n')}`);
    if (excludedWork.length > 0) parts.push(`Out of Scope:\n${excludedWork.map((i) => `• ${i}`).join('\n')}`);
    if (specialRequirements.trim()) parts.push(`Special Requirements:\n${specialRequirements.trim()}`);
    return parts.length > 0 ? parts.join('\n\n') : null;
  }
  function buildDeliverablesNote(): string | null {
    if (deliverables.length === 0) return null;
    const lines = deliverables
      .filter((d) => d.name.trim())
      .map((d) => {
        let line = `• ${d.name.trim()}`;
        if (d.quantity.trim()) line += ` (${d.quantity.trim()})`;
        if (d.description.trim()) line += `\n  ${d.description.trim()}`;
        if (d.milestone.trim()) line += `\n  Milestone: ${d.milestone.trim()}`;
        return line;
      });
    return lines.length > 0 ? lines.join('\n\n') : null;
  }

  function validate(): string | null {
    if (!name.trim()) return 'Project name is required.';
    if (!projectType) return 'Please select a project type.';
    if (!description.trim()) return 'Project description is required.';
    if (!startDate) return 'Start date is required.';
    if (!dueDate) return 'Expected delivery date is required.';
    if (dueDate <= startDate) return 'Delivery date must be after the start date.';
    if (budgetValue && (Number.isNaN(Number(budgetValue)) || Number(budgetValue) <= 0)) return 'Project value must be a valid positive amount.';
    if (!managerId) return 'Select a project manager.';
    return null;
  }

  async function submitProject(asDraft: boolean, force = false) {
    if (!user || !client) return;
    const err = asDraft ? (!name.trim() ? 'Project name is required.' : null) : validate();
    if (err) {
      setError(err);
      return;
    }

    if (!asDraft && !force) {
      const dup = existingProjects.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (dup) {
        setDuplicateMatch(dup);
        setShowDuplicateModal(true);
        return;
      }
    }

    setError(null);
    if (asDraft) setSavingDraft(true);
    else setCreating(true);

    const finalStatus = asDraft ? 'draft' : status;
    const finalVisible = asDraft ? false : clientVisible;

    const { data, error: createError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        client_id: client.id,
        category: projectType || null,
        status: finalStatus,
        progress: 0,
        budget: budgetValue ? Number(budgetValue) : null,
        start_date: startDate || null,
        due_date: dueDate || null,
        project_manager_id: managerId || null,
        description: description.trim() || null,
        scope_note: buildScopeNote(),
        deliverables_note: buildDeliverablesNote(),
        payment_structure: paymentStructure || null,
        client_visible: finalVisible,
      })
      .select('id, name')
      .single();

    if (createError) {
      setError(createError.message);
      setCreating(false);
      setSavingDraft(false);
      return;
    }

    if (!asDraft && useDefaultMilestones) {
      const rows = DEFAULT_MILESTONES.map((title, i) => ({
        project_id: data.id,
        title,
        position: i,
        due_date: startDate && dueDate ? milestoneDateAt(startDate, dueDate, i, DEFAULT_MILESTONES.length) : null,
      }));
      await supabase.from('milestones').insert(rows);
    }

    const unlinkedIds = files.filter((f) => !f.project_id).map((f) => f.id);
    if (unlinkedIds.length > 0) {
      await supabase.from('client_files').update({ project_id: data.id }).in('id', unlinkedIds);
    }

    if (internalNote.trim()) {
      await supabase.from('client_notes').insert({ client_id: client.id, author_id: user.id, body: `[${data.name}] ${internalNote.trim()}` });
    }

    await supabase.from('activity_log').insert([
      {
        actor_id: user.id,
        action: asDraft ? 'project_draft_saved' : 'project_created',
        entity_type: 'project',
        entity_id: data.id,
        detail: asDraft ? `"${data.name}" ড্রাফট হিসেবে সেভ করা হয়েছে` : `"${data.name}" প্রজেক্ট তৈরি করা হয়েছে`,
      },
      {
        actor_id: user.id,
        action: asDraft ? 'project_draft_saved' : 'project_created',
        entity_type: 'client',
        entity_id: client.id,
        detail: asDraft ? `"${data.name}" ড্রাফট হিসেবে সেভ করা হয়েছে` : `"${data.name}" প্রজেক্ট তৈরি করা হয়েছে`,
      },
    ]);

    if (!asDraft && (client.status === 'lead' || client.status === 'submitted' || client.status === 'discussion')) {
      await supabase.from('clients').update({ status: 'active' }).eq('id', client.id);
    }

    if (!asDraft && notifyClient && clientVisible && client.contact_phone) {
      const text = `Hi ${client.primary_contact ?? client.company_name}, your project "${data.name}" has been created and is now available in your client portal.`;
      window.open(`${waLink(client.contact_phone)}?text=${encodeURIComponent(text)}`, '_blank');
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'client_notified', entity_type: 'project', entity_id: data.id, detail: 'ক্লায়েন্টকে WhatsApp-এ প্রজেক্ট তৈরির নোটিফিকেশন পাঠানো হয়েছে' });
    }

    setDirty(false);
    router.push(`/projects/${data.id}`);
  }

  function handleCancel() {
    if (dirty) {
      setShowCancelConfirm(true);
      return;
    }
    router.push(`/clients/${clientId}`);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (loading) {
    return (
      <div className={`clientslist-root client-detail-root create-project-root${dark ? ' dark' : ''}`}>
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
      <div className={`clientslist-root client-detail-root create-project-root${dark ? ' dark' : ''}`}>
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

  const selectedManager = managers.find((m) => m.id === managerId) ?? null;
  const depositAmount = budgetValue ? Math.round((Number(budgetValue) * depositPercent) / 100) : 0;
  const finalAmount = budgetValue ? Number(budgetValue) - depositAmount : 0;
  const unlinkedFilesCount = files.filter((f) => !f.project_id).length;

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
              <Link href={`/clients/${client.id}`}>{client.primary_contact ?? client.company_name}</Link>
              <span className="sep">/</span>
              <span className="current">Create Project</span>
            </div>

            <div className="cp8-header-row">
              <div>
                <h1 className="page-title" style={{ marginBottom: 4 }}>
                  Create Project
                </h1>
                <p className="page-sub">Create the official project using the client&apos;s submitted requirements.</p>
              </div>
              <div className="cp8-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => submitProject(true)} disabled={savingDraft || creating || !name.trim()}>
                  {savingDraft ? 'সেভ হচ্ছে…' : 'Save Draft'}
                </button>
                <button type="button" className="btn btn-accent btn-sm" onClick={() => submitProject(false)} disabled={creating || savingDraft}>
                  {creating ? 'Creating Project…' : 'Create Project'}
                </button>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="client-context-bar">
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {client.company_name.charAt(0).toUpperCase()}
              </div>
              <div className="cc-info">
                <div className="cc-name-row">
                  <span className="cc-name">{client.primary_contact ?? client.company_name}</span>
                  <span className="status-pill s-progress">{CLIENT_STATUS_META[client.status] ?? client.status}</span>
                </div>
                <div className="cc-company">
                  {client.company_name} {client.contact_email ? `· ${client.contact_email}` : ''}
                </div>
                <div className="cc-meta-row">
                  <span className="cc-req-label">Requested Project:</span>
                  <span className="cc-req-value">{requirements?.project_name ?? 'নেই'}</span>
                </div>
              </div>
            </div>

            <div className="cp8-layout">
              <div className="cp8-main">
                {/* ---- Project Information ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">
                      Project Information{requirements?.project_name && <span className="src-tag">Submitted by Client</span>}
                    </span>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Project Name</label>
                    <input
                      className="modal-input"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        markDirty();
                      }}
                      placeholder="যেমন: Fintech Mobile App"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="modal-field-grid">
                    <div className="modal-field">
                      <label className="modal-label">Project Type</label>
                      <select
                        className="modal-select"
                        value={projectType}
                        onChange={(e) => {
                          setProjectType(e.target.value);
                          markDirty();
                        }}
                      >
                        <option value="">নির্বাচন করুন</option>
                        {PROJECT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        {requirements?.project_type && !PROJECT_TYPES.includes(requirements.project_type) && <option value={requirements.project_type}>{requirements.project_type}</option>}
                      </select>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label">Project Status</label>
                      <select className="modal-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUS_CREATE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-field" style={{ marginBottom: 0 }}>
                    <label className="modal-label">Project Description</label>
                    <textarea
                      className="modal-textarea"
                      style={{ minHeight: 100 }}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        markDirty();
                      }}
                      placeholder="প্রজেক্টের সংক্ষিপ্ত বিবরণ"
                    />
                  </div>
                </section>

                {/* ---- Client Requirements Summary ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">
                      Client Requirements <span className="src-tag">Submitted by Client</span>
                    </span>
                  </div>
                  {requirements ? (
                    <>
                      <div className="field-grid" style={{ marginBottom: 14 }}>
                        <div>
                          <div className="field-label">Expected Timeline</div>
                          <div className="field-value">{requirements.expected_timeline ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Budget Range</div>
                          <div className="field-value">{requirements.budget_range ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Priority</div>
                          <div className="field-value" style={{ textTransform: 'capitalize' }}>
                            {requirements.priority ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="field-label">Target Audience</div>
                          <div className="field-value">{requirements.target_audience ?? '—'}</div>
                        </div>
                      </div>
                      {requirements.goals && (
                        <div className="req-block">
                          <div className="field-label">Client Goal</div>
                          <p className="req-text">{requirements.goals}</p>
                        </div>
                      )}
                      {requirements.required_features && (
                        <div className="req-block">
                          <div className="field-label">Requested Features</div>
                          <div className="feature-chips">
                            {requirements.required_features.split(/,\s*/).filter(Boolean).map((f) => (
                              <span className="feature-chip" key={f}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {requirements.existing_assets && (
                        <div className="req-block">
                          <div className="field-label">Existing Assets</div>
                          <p className="req-text">{requirements.existing_assets}</p>
                        </div>
                      )}
                      {requirements.competitors && (
                        <div className="req-block">
                          <div className="field-label">Competitors</div>
                          <p className="req-text">{requirements.competitors}</p>
                        </div>
                      )}
                      {requirements.reference_notes && (
                        <div className="req-block">
                          <div className="field-label">References</div>
                          <p className="req-text">{requirements.reference_notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="side-empty">এই ক্লায়েন্ট এখনো কোনো requirements জমা দেননি।</p>
                  )}
                </section>

                {/* ---- Agency Scope ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Scope</span>
                  </div>
                  <p className="fs-sub">Define the official scope that will be used for project planning and the Statement of Work.</p>
                  <div className="modal-field">
                    <label className="modal-label">Project Objectives</label>
                    <textarea className="modal-textarea" value={scopeObjectives} onChange={(e) => setScopeObjectives(e.target.value)} placeholder="এই প্রজেক্টের মূল উদ্দেশ্য কী?" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Scope Description</label>
                    <textarea className="modal-textarea" value={scopeDescription} onChange={(e) => setScopeDescription(e.target.value)} placeholder="স্কোপের বিস্তারিত বিবরণ" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Included Work</label>
                    <div className="chip-toggle-group">
                      {INCLUDED_PRESETS.map((item) => (
                        <button type="button" key={item} className={`chip-toggle${includedWork.includes(item) ? ' selected' : ''}`} onClick={() => toggleIncluded(item)}>
                          {item}
                        </button>
                      ))}
                      {includedWork.filter((i) => !INCLUDED_PRESETS.includes(i)).map((item) => (
                        <button type="button" key={item} className="chip-toggle selected" onClick={() => toggleIncluded(item)}>
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="chip-add-row">
                      <input
                        className="modal-input"
                        type="text"
                        value={includedCustom}
                        onChange={(e) => setIncludedCustom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomIncluded();
                          }
                        }}
                        placeholder="+ Add Custom Item"
                      />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomIncluded}>
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Out of Scope</label>
                    <div className="chip-toggle-group">
                      {EXCLUDED_PRESETS.map((item) => (
                        <button type="button" key={item} className={`chip-toggle excluded${excludedWork.includes(item) ? ' selected' : ''}`} onClick={() => toggleExcluded(item)}>
                          {item}
                        </button>
                      ))}
                      {excludedWork.filter((i) => !EXCLUDED_PRESETS.includes(i)).map((item) => (
                        <button type="button" key={item} className="chip-toggle excluded selected" onClick={() => toggleExcluded(item)}>
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="chip-add-row">
                      <input
                        className="modal-input"
                        type="text"
                        value={excludedCustom}
                        onChange={(e) => setExcludedCustom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomExcluded();
                          }
                        }}
                        placeholder="+ Add Custom Item"
                      />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomExcluded}>
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="modal-field" style={{ marginBottom: 0 }}>
                    <label className="modal-label">Special Requirements</label>
                    <textarea className="modal-textarea" value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                </section>

                {/* ---- Deliverables ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Deliverables</span>
                  </div>
                  {deliverables.length > 0 && (
                    <div className="deliverable-list">
                      {deliverables.map((d) => (
                        <div className="deliverable-row" key={d.id}>
                          <div className="deliverable-row-head">
                            <input className="modal-input" type="text" value={d.name} onChange={(e) => updateDeliverable(d.id, { name: e.target.value })} placeholder="যেমন: Wireframes" />
                            <button type="button" className="deliverable-remove-btn" onClick={() => removeDeliverable(d.id)} aria-label="বাদ দিন">
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                          <div className="modal-field-grid" style={{ marginBottom: 8 }}>
                            <input className="modal-input" type="text" value={d.quantity} onChange={(e) => updateDeliverable(d.id, { quantity: e.target.value })} placeholder="যেমন: 12–15 screens" />
                            <input className="modal-input" type="text" value={d.milestone} onChange={(e) => updateDeliverable(d.id, { milestone: e.target.value })} placeholder="Milestone (ঐচ্ছিক)" />
                          </div>
                          <textarea className="modal-textarea" style={{ minHeight: 50 }} value={d.description} onChange={(e) => updateDeliverable(d.id, { description: e.target.value })} placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="deliverable-quick-add" style={{ marginBottom: 10 }}>
                    {DELIVERABLE_QUICK_ADD.map((item) => (
                      <button type="button" key={item} className="chip-toggle" onClick={() => addDeliverable(item)}>
                        + {item}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => addDeliverable()}>
                    <Icon name="plus" size={12} /> Add Deliverable
                  </button>
                </section>

                {/* ---- Timeline ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Timeline</span>
                  </div>
                  <div className="modal-field-grid" style={{ marginBottom: 0 }}>
                    <div className="modal-field">
                      <label className="modal-label">Start Date</label>
                      <input
                        className="modal-input"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          markDirty();
                        }}
                      />
                    </div>
                    <div className="modal-field">
                      <label className="modal-label">Expected Delivery Date</label>
                      <input
                        className="modal-input"
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          markDirty();
                        }}
                      />
                    </div>
                  </div>
                  {dateError ? (
                    <div className="date-error">{dateError}</div>
                  ) : (
                    durationText && (
                      <div className="duration-hint">
                        Estimated Duration: <b>{durationText}</b>
                      </div>
                    )
                  )}
                  <div className="milestone-toggle-row">
                    <div>
                      <div className="milestone-toggle-label">Use default milestones</div>
                      <div className="milestone-toggle-sub">Discovery → UX Design → UI Design → Client Review → Final Delivery</div>
                    </div>
                    <button type="button" className={`toggle-switch${useDefaultMilestones ? ' on' : ''}`} onClick={() => setUseDefaultMilestones((v) => !v)} aria-label="ডিফল্ট মাইলস্টোন টগল">
                      <div className="toggle-knob"></div>
                    </button>
                  </div>
                  {useDefaultMilestones && (
                    <div className="milestone-preview-row">
                      {DEFAULT_MILESTONES.map((m) => (
                        <span className="milestone-preview-chip" key={m}>
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* ---- Budget ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Budget &amp; Commercial</span>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Project Value (৳)</label>
                    <input
                      className="modal-input"
                      type="number"
                      min="0"
                      value={budgetValue}
                      onChange={(e) => {
                        setBudgetValue(e.target.value);
                        markDirty();
                      }}
                      placeholder={requirements?.budget_range ?? 'ঐচ্ছিক'}
                    />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Payment Structure</label>
                    <div className="payment-structure-grid">
                      {PAYMENT_STRUCTURES.map((p) => (
                        <button type="button" key={p.value} className={`payment-structure-card${paymentStructure === p.value ? ' selected' : ''}`} onClick={() => setPaymentStructure(p.value)}>
                          <div className="psc-title">{p.title}</div>
                          <div className="psc-sub">{p.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {paymentStructure === 'deposit_final' && budgetValue && (
                    <div className="payment-preview-box">
                      <div className="deposit-slider-row">
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Deposit</span>
                        <input type="range" min={10} max={90} step={5} value={depositPercent} onChange={(e) => setDepositPercent(Number(e.target.value))} />
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{depositPercent}%</span>
                      </div>
                      <div className="payment-preview-row">
                        <span>Deposit — {depositPercent}%</span>
                        <b className="tabular">৳{depositAmount.toLocaleString('en-US')}</b>
                      </div>
                      <div className="payment-preview-row">
                        <span>Final — {100 - depositPercent}%</span>
                        <b className="tabular">৳{finalAmount.toLocaleString('en-US')}</b>
                      </div>
                    </div>
                  )}
                  {paymentStructure === 'full' && budgetValue && (
                    <div className="payment-preview-box">
                      <div className="payment-preview-row">
                        <span>Full Payment</span>
                        <b className="tabular">৳{Number(budgetValue).toLocaleString('en-US')}</b>
                      </div>
                    </div>
                  )}
                  {paymentStructure === 'milestones' && (
                    <p className="side-empty">পেমেন্ট মাইলস্টোন অনুযায়ী ভাগ হবে — সঠিক পরিমাণ পরে পেমেন্ট রিকোয়েস্ট পাঠানোর সময় নির্ধারণ করা যাবে।</p>
                  )}
                </section>

                {/* ---- Project Manager ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Manager</span>
                  </div>
                  <div className="modal-field" style={{ marginBottom: 0 }}>
                    <select
                      className="modal-select"
                      value={managerId}
                      onChange={(e) => {
                        setManagerId(e.target.value);
                        markDirty();
                      }}
                    >
                      <option value="">নির্বাচন করুন</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                          {m.role ? ` — ${m.role}` : ''} · {m.capacityPercent}% capacity
                        </option>
                      ))}
                    </select>
                    {selectedManager && (
                      <p className="capacity-hint">
                        {selectedManager.full_name} বর্তমানে {selectedManager.capacityPercent}% ক্যাপাসিটিতে আছেন।
                      </p>
                    )}
                  </div>
                </section>

                {/* ---- Client Access ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Client Access</span>
                  </div>
                  <p className="fs-sub">Choose when this project becomes visible in the client&apos;s portal.</p>
                  <div className="visibility-options">
                    <label className={`visibility-option${clientVisible ? ' selected' : ''}`}>
                      <input type="radio" name="visibility" checked={clientVisible} onChange={() => setClientVisible(true)} />
                      <div>
                        <div className="vo-title">Visible After Creation</div>
                        <div className="vo-sub">The project appears immediately in the client&apos;s portal.</div>
                      </div>
                    </label>
                    <label className={`visibility-option${!clientVisible ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="visibility"
                        checked={!clientVisible}
                        onChange={() => {
                          setClientVisible(false);
                          setNotifyClient(false);
                        }}
                      />
                      <div>
                        <div className="vo-title">Keep Hidden Until Ready</div>
                        <div className="vo-sub">The project remains internal until you make it visible.</div>
                      </div>
                    </label>
                  </div>
                  <div className="toggle-row" style={{ marginTop: 14 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>Notify Client</span>
                    <button
                      type="button"
                      className={`toggle-switch${notifyClient ? ' on' : ''}`}
                      onClick={() => setNotifyClient((v) => !v)}
                      disabled={!clientVisible || !client.contact_phone}
                      aria-label="ক্লায়েন্ট নোটিফিকেশন টগল"
                    >
                      <div className="toggle-knob"></div>
                    </button>
                  </div>
                  <p className="fs-sub" style={{ marginBottom: 0 }}>
                    {!client.contact_phone ? 'এই ক্লায়েন্টের ফোন নম্বর নেই, তাই নোটিফিকেশন পাঠানো যাবে না।' : 'Send the client a WhatsApp notification when the project is created.'}
                  </p>
                </section>

                {/* ---- Internal Note ---- */}
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Internal Project Note</span>
                  </div>
                  <textarea className="modal-textarea" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="যেমন: Client prefers minimal visual direction and weekly progress updates." />
                  <p className="fs-sub" style={{ marginBottom: 0, marginTop: 6 }}>
                    ইন্টারনাল — ক্লায়েন্ট এটা কখনো দেখতে পাবে না।
                  </p>
                </section>

                {/* ---- Existing Files ---- */}
                {files.length > 0 && (
                  <section className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Client Files{unlinkedFilesCount > 0 && <span className="src-tag">{unlinkedFilesCount} will be linked</span>}</span>
                    </div>
                    {files.map((f) => (
                      <div className="file-row" key={f.id}>
                        <div className="file-icon">
                          <Icon name="file" size={15} />
                        </div>
                        <div className="file-row-main">
                          <div className="file-row-name">{f.name}</div>
                          <div className="file-row-meta">{formatBytesFileType(f.file_type)}</div>
                        </div>
                        <div className="file-actions">
                          <a className="icon-btn" style={{ width: 28, height: 28 }} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer">
                            <Icon name="eye" size={13} />
                          </a>
                          <a className="icon-btn" style={{ width: 28, height: 28 }} href={f.drive_url} target="_blank" rel="noopener noreferrer">
                            <Icon name="download" size={13} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>

              <div className="ps-sidebar">
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Summary</span>
                  </div>
                  <div className="ps-row">
                    <span>Client</span>
                    <span>{client.primary_contact ?? client.company_name}</span>
                  </div>
                  <div className="ps-row">
                    <span>Company</span>
                    <span>{client.company_name}</span>
                  </div>
                  <div className="ps-row">
                    <span>Project</span>
                    <span className={name ? '' : 'muted'}>{name || 'Not set'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Type</span>
                    <span className={projectType ? '' : 'muted'}>{projectType || 'Not set'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Status</span>
                    <span>{STATUS_CREATE_OPTIONS.find((s) => s.value === status)?.label}</span>
                  </div>
                  <div className="ps-row">
                    <span>Timeline</span>
                    <span className={startDate && dueDate ? '' : 'muted'}>{startDate && dueDate ? `${formatBnDate(startDate)} – ${formatBnDate(dueDate)}` : 'Not set'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Budget</span>
                    <span className={`tabular${budgetValue ? '' : ' muted'}`}>{budgetValue ? `৳${Number(budgetValue).toLocaleString('en-US')}` : 'Not set'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Manager</span>
                    <span className={selectedManager ? '' : 'muted'}>{selectedManager?.full_name ?? 'Not set'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Deliverables</span>
                    <span className={deliverables.length > 0 ? '' : 'muted'}>{deliverables.length > 0 ? `${deliverables.length} defined` : 'None'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Client Access</span>
                    <span>{clientVisible ? 'Visible' : 'Hidden'}</span>
                  </div>
                  <div className="ps-row">
                    <span>Notify Client</span>
                    <span>{notifyClient && clientVisible ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="ps-actions">
                    <button type="button" className="btn btn-accent btn-block" onClick={() => submitProject(false)} disabled={creating || savingDraft}>
                      {creating ? 'Creating Project…' : 'Create Project'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={() => submitProject(true)} disabled={savingDraft || creating || !name.trim()}>
                      {savingDraft ? 'সেভ হচ্ছে…' : 'Save Draft'}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showDuplicateModal && duplicateMatch && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDuplicateModal(false); }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="dup-icon">
                <Icon name="alert" size={18} />
              </div>
              <span className="modal-title">Possible duplicate project</span>
              <button type="button" className="modal-close" onClick={() => setShowDuplicateModal(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-warn-text">
                {client.primary_contact ?? client.company_name} already has a project named &quot;{duplicateMatch.name}&quot;.
              </p>
            </div>
            <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
              <Link href={`/projects/${duplicateMatch.id}`} className="btn btn-ghost btn-sm">
                View Existing Project
              </Link>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDuplicateModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    submitProject(false, true);
                  }}
                >
                  Create Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCancelConfirm(false); }}>
          <div className="modal-box">
            <div className="modal-head">
              <span className="modal-title">Discard changes?</span>
              <button type="button" className="modal-close" onClick={() => setShowCancelConfirm(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-warn-text">You have unsaved project information.</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCancelConfirm(false)}>
                Continue Editing
              </button>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => router.push(`/clients/${clientId}`)}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
