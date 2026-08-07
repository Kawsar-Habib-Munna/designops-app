'use client';

// Discussions & Voting — টিম আলোচনা (থ্রেড + রিপ্লাই + রিঅ্যাকশন) আর ভোট
// (অপশন + রেসপন্স), সম্পূর্ণ রিয়েল Supabase ডেটা। মকআপের কিছু অংশ কোনো
// স্কিমা/ইন্টিগ্রেশন ব্যাকিং না থাকায় honest ভাবে বাদ দেওয়া হয়েছে বা সহজ করা
// হয়েছে:
//   - "Pinned Note" ও "Related Discussions" প্যানেল — কোনো আলাদা স্কিমা নেই,
//     fabricate না করে সরিয়ে দেওয়া হয়েছে।
//   - ক্রিয়েট মোডালের "অ্যাটাচমেন্ট" গ্রিড (ছবি/ভিডিও/PDF/Figma বাটন) মকআপেও
//     কোনো আসল আপলোড হ্যান্ডলার ছিল না — এখন Files পেজের মতোই আসল Google Drive
//     আপলোড (lib/driveUpload.ts, শেয়ার্ড) অথবা সরাসরি Drive/Figma লিংক পেস্ট —
//     দুটো অপশনই আছে।
//   - "Generate Summary" বাটন কোনো আসল AI কল করে না (Files পেজের Figma-connect
//     বাটনের মতোই honest "শীঘ্রই আসছে" প্লেসহোল্ডার); AI Insights অংশটুকু
//     Files পেজের মতোই লোকাল ডেটা থেকে হিসাব করা টেক্সট, fake claim নয়।
//   - Toast নোটিফিকেশন সিস্টেম বাদ — বাকি পেজগুলোর প্যাটার্নের মতোই ইনলাইন
//     error ব্যানার/বাটন-লেবেল ব্যবহার হয়েছে।

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import './discussions.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { relativeTimeBn, formatBnDate } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';
import { canPreviewInline, driveThumbnailUrl, guessFileType, uploadFileToDrive } from '@/lib/driveUpload';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  'bar-chart': '<path d="M3 21h18"/><rect x="6" y="10" width="3" height="8"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  pin: '<path d="M12 2l1.5 5.5L19 9l-4 4 1 6-4-3-4 3 1-6-4-4 5.5-1.5z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  paperclip: '<path d="M21 11.5l-9.2 9.2a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8.2-8.2"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  figma: '<circle cx="12" cy="8" r="3"/><rect x="7" y="11" width="10" height="10" rx="2"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H3a4 4 0 0 0 4 4"/><path d="M17 6h4a4 4 0 0 1-4 4"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions', active: true },
  { icon: 'bar', label: 'Reports', href: '#' },
];
const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '#' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

type LocalView = 'all' | 'votes' | 'mine' | 'pinned' | 'archived' | 'drafts';
const LOCAL_NAV_ITEMS: { key: LocalView; icon: IconName; label: string }[] = [
  { key: 'all', icon: 'message', label: 'Discussions' },
  { key: 'votes', icon: 'bar-chart', label: 'Votes' },
  { key: 'mine', icon: 'user', label: 'My Discussions' },
  { key: 'pinned', icon: 'pin', label: 'Pinned' },
  { key: 'archived', icon: 'archive', label: 'Archived' },
  { key: 'drafts', icon: 'edit', label: 'Drafts' },
];

const CATEGORY_OPTIONS = ['ডিজাইন ফিডব্যাক', 'UX রিভিউ', 'ব্র্যান্ডিং', 'ফিচার আইডিয়া', 'প্রজেক্ট ডিসিশন'];
const REACTION_EMOJIS = ['👍', '❤️'];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null };
type ProjectOption = { id: string; name: string };
type TaskOption = { id: string; project_id: string | null; status: string };
type AuthorRef = { full_name: string; role: string | null; avatar_color: string | null } | null;
type ProjectRef = { id: string; name: string } | null;

type DiscussionRow = {
  id: string; title: string; description: string | null; category: string | null; tags: string | null;
  project_id: string | null; author_id: string | null; status: string;
  is_pinned: boolean; is_draft: boolean; is_archived: boolean; created_at: string;
  profiles: AuthorRef; projects: ProjectRef;
};
type VoteRow = {
  id: string; title: string; description: string | null; project_id: string | null; author_id: string | null;
  allow_multiple: boolean; is_anonymous: boolean; ends_at: string | null; status: string;
  is_pinned: boolean; is_draft: boolean; is_archived: boolean; created_at: string;
  profiles: AuthorRef; projects: ProjectRef;
};
type VoteOptionRow = { id: string; vote_id: string; label: string; position: number };
type VoteResponseRow = { id: string; vote_id: string; option_id: string; voter_id: string };
type ReplyRow = { id: string; discussion_id: string; author_id: string | null; body: string; created_at: string; updated_at: string; profiles: AuthorRef };
type ReplyAttachmentRow = { id: string; reply_id: string; file_name: string; file_type: string | null; url: string };
type ReactionRow = { id: string; reply_id: string; profile_id: string; emoji: string };
type DiscussionAttachmentRow = { id: string; discussion_id: string; file_name: string; file_type: string | null; url: string };
type VoteAttachmentRow = { id: string; vote_id: string; file_name: string; file_type: string | null; url: string };
type MentionRow = { discussion_id: string; profile_id: string };

// discussion_mentions টেবিলটাও discussions<->profiles-এর মধ্যে একটা many-to-many
// পথ তৈরি করে ফেলে (discussion_id + profile_id), তাই author_id-এর FK embed
// করার সময় "!author_id" হিন্ট না দিলে PostgREST দুটো সম্পর্কের মধ্যে confuse
// হয়ে "more than one relationship was found" এরর দেয়।
const DISCUSSION_SELECT = 'id, title, description, category, tags, project_id, author_id, status, is_pinned, is_draft, is_archived, created_at, profiles!author_id(full_name, role, avatar_color), projects(id, name)';
// একই কারণে vote_responses (votes<->profiles) আর reply_reactions
// (discussion_replies<->profiles) নিজেরাও many-to-many পথ তৈরি করে, তাই এখানেও
// "!author_id" হিন্ট দরকার।
const VOTE_SELECT = 'id, title, description, project_id, author_id, allow_multiple, is_anonymous, ends_at, status, is_pinned, is_draft, is_archived, created_at, profiles!author_id(full_name, role, avatar_color), projects(id, name)';
const REPLY_SELECT = 'id, discussion_id, author_id, body, created_at, updated_at, profiles!author_id(full_name, role, avatar_color)';

async function fetchDiscussionsData() {
  const [discRes, voteRes, optRes, respRes, replyRes, reactRes, discAttRes, replyAttRes, voteAttRes, mentionRes, teamRes, projectsRes, tasksRes] = await Promise.all([
    supabase.from('discussions').select(DISCUSSION_SELECT).order('created_at', { ascending: false }),
    supabase.from('votes').select(VOTE_SELECT).order('created_at', { ascending: false }),
    supabase.from('vote_options').select('id, vote_id, label, position').order('position'),
    supabase.from('vote_responses').select('id, vote_id, option_id, voter_id'),
    supabase.from('discussion_replies').select(REPLY_SELECT).order('created_at'),
    supabase.from('reply_reactions').select('id, reply_id, profile_id, emoji'),
    supabase.from('discussion_attachments').select('id, discussion_id, file_name, file_type, url'),
    supabase.from('reply_attachments').select('id, reply_id, file_name, file_type, url'),
    supabase.from('vote_attachments').select('id, vote_id, file_name, file_type, url'),
    supabase.from('discussion_mentions').select('discussion_id, profile_id'),
    supabase.from('profiles').select('id, full_name, role, avatar_color').order('full_name'),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('tasks').select('id, project_id, status'),
  ]);

  const firstErrored = [discRes, voteRes, optRes, respRes, replyRes, reactRes, discAttRes, replyAttRes, voteAttRes, mentionRes, teamRes, projectsRes, tasksRes].find((r) => r.error);

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    discussions: (discRes.data as unknown as DiscussionRow[]) ?? [],
    votes: (voteRes.data as unknown as VoteRow[]) ?? [],
    voteOptions: (optRes.data as VoteOptionRow[]) ?? [],
    voteResponses: (respRes.data as VoteResponseRow[]) ?? [],
    replies: (replyRes.data as unknown as ReplyRow[]) ?? [],
    reactions: (reactRes.data as ReactionRow[]) ?? [],
    discAttachments: (discAttRes.data as DiscussionAttachmentRow[]) ?? [],
    replyAttachments: (replyAttRes.data as ReplyAttachmentRow[]) ?? [],
    voteAttachments: (voteAttRes.data as VoteAttachmentRow[]) ?? [],
    mentions: (mentionRes.data as MentionRow[]) ?? [],
    teamOptions: (teamRes.data as ProfileRow[]) ?? [],
    projectOptions: (projectsRes.data as ProjectOption[]) ?? [],
    taskOptions: (tasksRes.data as TaskOption[]) ?? [],
  };
}

function guessLinkType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('figma.com')) return 'figma';
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)) return 'image';
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return 'video';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'other';
}
function attachTypeIcon(t: string | null): IconName {
  if (t === 'figma') return 'figma';
  if (t === 'image') return 'image';
  if (t === 'video') return 'video';
  return 'file';
}
// Drive-এর thumbnail এন্ডপয়েন্ট ছবির পাশাপাশি ভিডিও আর PDF-এরও একটা স্ট্যাটিক
// প্রিভিউ ইমেজ জেনারেট করে দেয় (Google-এর নিজস্ব ফিচার) — তাই এই তিন টাইপের
// জন্যই ইনলাইন থাম্বনেইল দেখানো সম্ভব। Figma লিংক Drive-এ হোস্ট করা না হওয়ায়
// এই এন্ডপয়েন্ট কাজ করে না, তাই সেটা আইকন চিপ হিসেবেই থাকছে।
function AttachmentPreview({ name, url, fileType, style }: { name: string; url: string; fileType: string | null; style?: CSSProperties }) {
  if (canPreviewInline(fileType, url)) {
    return (
      <a className="attach-image" href={url} target="_blank" rel="noopener noreferrer" title={name} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={driveThumbnailUrl(url)} alt={name} />
        {fileType === 'video' && <span className="attach-play-badge"><Icon name="play" size={16} /></span>}
      </a>
    );
  }
  return (
    <a className="attach-chip" href={url} target="_blank" rel="noopener noreferrer" style={style}><Icon name={attachTypeIcon(fileType)} size={13} /> {name}</a>
  );
}
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function voteIsClosed(v: VoteRow): boolean {
  return v.status === 'closed' || (v.ends_at ? new Date(v.ends_at).getTime() <= Date.now() : false);
}
function voteCardTimeLabel(v: VoteRow): string {
  if (voteIsClosed(v)) return 'বন্ধ হয়েছে';
  if (!v.ends_at) return 'কোনো ডেডলাইন নেই';
  const diffMs = new Date(v.ends_at).getTime() - Date.now();
  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) return `${days} দিন বাকি`;
  const hours = Math.floor(diffMs / 3600000);
  if (hours >= 1) return `${hours} ঘণ্টা বাকি`;
  return 'আজই শেষ হবে';
}
function countdownParts(endsAt: string | null): { value: string; label: string } {
  if (!endsAt) return { value: '—', label: 'কোনো ডেডলাইন নেই' };
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return { value: '০', label: 'ভোট শেষ হয়ে গেছে' };
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  return { value: days > 0 ? `${days}d ${hours}h` : `${hours}h`, label: 'ভোট শেষ হতে বাকি' };
}

const DISCUSSION_STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'st-open' },
  resolved: { label: 'Resolved', cls: 'st-resolved' },
  closed: { label: 'Closed', cls: 'st-closed' },
};

export default function DiscussionsPage() {
  const { user, loading: sessionLoading } = useSession();

  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [discussions, setDiscussions] = useState<DiscussionRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOptionRow[]>([]);
  const [voteResponses, setVoteResponses] = useState<VoteResponseRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [discAttachments, setDiscAttachments] = useState<DiscussionAttachmentRow[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<ReplyAttachmentRow[]>([]);
  const [voteAttachments, setVoteAttachments] = useState<VoteAttachmentRow[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [teamOptions, setTeamOptions] = useState<ProfileRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [localView, setLocalView] = useState<LocalView>('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [view, setView] = useState<'feed' | 'discussion' | 'vote'>('feed');
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const [activeVoteId, setActiveVoteId] = useState<string | null>(null);

  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const [replyBody, setReplyBody] = useState('');
  const [showReplyAttach, setShowReplyAttach] = useState(false);
  const [replyAttachName, setReplyAttachName] = useState('');
  const [replyAttachUrl, setReplyAttachUrl] = useState('');
  const [replyAttachType, setReplyAttachType] = useState('');
  const [replyUploading, setReplyUploading] = useState(false);
  const [replyUploadProgress, setReplyUploadProgress] = useState(0);
  const [postingReply, setPostingReply] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const [pendingOptionIds, setPendingOptionIds] = useState<Set<string>>(new Set());
  const [submittingVote, setSubmittingVote] = useState(false);

  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [dTitle, setDTitle] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dCategory, setDCategory] = useState(CATEGORY_OPTIONS[0]);
  const [dTags, setDTags] = useState('');
  const [dProjectId, setDProjectId] = useState('');
  const [dMentionIds, setDMentionIds] = useState<Set<string>>(new Set());
  const [dAttachments, setDAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [dAttachName, setDAttachName] = useState('');
  const [dAttachUrl, setDAttachUrl] = useState('');
  const [dUploading, setDUploading] = useState(false);
  const [dUploadProgress, setDUploadProgress] = useState(0);
  const [savingDiscussion, setSavingDiscussion] = useState(false);
  const [discussionError, setDiscussionError] = useState<string | null>(null);

  const [showVoteModal, setShowVoteModal] = useState(false);
  const [vTitle, setVTitle] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vOptions, setVOptions] = useState<string[]>(['', '']);
  const [vAllowMultiple, setVAllowMultiple] = useState(false);
  const [vAnonymous, setVAnonymous] = useState(false);
  const [vEndsAt, setVEndsAt] = useState('');
  const [vProjectId, setVProjectId] = useState('');
  const [vAttachments, setVAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [vAttachName, setVAttachName] = useState('');
  const [vAttachUrl, setVAttachUrl] = useState('');
  const [vUploading, setVUploading] = useState(false);
  const [vUploadProgress, setVUploadProgress] = useState(0);
  const [savingVote, setSavingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  function applyResult(result: Awaited<ReturnType<typeof fetchDiscussionsData>>) {
    setError(result.errorMessage);
    setDiscussions(result.discussions);
    setVotes(result.votes);
    setVoteOptions(result.voteOptions);
    setVoteResponses(result.voteResponses);
    setReplies(result.replies);
    setReactions(result.reactions);
    setDiscAttachments(result.discAttachments);
    setReplyAttachments(result.replyAttachments);
    setVoteAttachments(result.voteAttachments);
    setMentions(result.mentions);
    setTeamOptions(result.teamOptions);
    setProjectOptions(result.projectOptions);
    setTaskOptions(result.taskOptions);
  }

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchDiscussionsData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color').eq('id', user!.id).single(),
      ]);
      applyResult(result);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }
    run();
  }, [user]);

  async function handleReload() {
    setReloading(true);
    const result = await fetchDiscussionsData();
    applyResult(result);
    setReloading(false);
  }

  const profileById = useMemo(() => new Map(teamOptions.map((p) => [p.id, p])), [teamOptions]);

  const projectProgress = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    for (const t of taskOptions) {
      if (!t.project_id) continue;
      const cur = stats.get(t.project_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === 'done') cur.done += 1;
      stats.set(t.project_id, cur);
    }
    const out = new Map<string, number>();
    for (const [pid, s] of stats) out.set(pid, s.total > 0 ? Math.round((s.done / s.total) * 100) : 0);
    return out;
  }, [taskOptions]);

  function voteStats(voteId: string) {
    const options = voteOptions.filter((o) => o.vote_id === voteId).sort((a, b) => a.position - b.position);
    const responses = voteResponses.filter((r) => r.vote_id === voteId);
    const total = responses.length;
    const distinctVoters = new Set(responses.map((r) => r.voter_id)).size;
    const withCounts = options.map((o) => {
      const count = responses.filter((r) => r.option_id === o.id).length;
      return { option: o, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
    const maxCount = withCounts.reduce((m, x) => Math.max(m, x.count), 0);
    const leader = total > 0 ? (withCounts.find((x) => x.count === maxCount) ?? null) : null;
    return { options, responses, total, distinctVoters, withCounts, leader };
  }

  // ---------------- pin / archive / status / delete ----------------
  async function togglePin(kind: 'discussion' | 'vote', id: string, current: boolean) {
    const table = kind === 'discussion' ? 'discussions' : 'votes';
    const { data, error: err } = await supabase.from(table).update({ is_pinned: !current }).eq('id', id).select('id').single();
    if (err || !data) { setError(err?.message ?? 'পিন করা যায়নি।'); return; }
    if (kind === 'discussion') setDiscussions((prev) => prev.map((d) => (d.id === id ? { ...d, is_pinned: !current } : d)));
    else setVotes((prev) => prev.map((v) => (v.id === id ? { ...v, is_pinned: !current } : v)));
  }

  async function toggleArchive(kind: 'discussion' | 'vote', id: string, current: boolean) {
    const table = kind === 'discussion' ? 'discussions' : 'votes';
    const { data, error: err } = await supabase.from(table).update({ is_archived: !current }).eq('id', id).select('id').single();
    if (err || !data) { setError(err?.message ?? 'আর্কাইভ করা যায়নি।'); return; }
    if (kind === 'discussion') setDiscussions((prev) => prev.map((d) => (d.id === id ? { ...d, is_archived: !current } : d)));
    else setVotes((prev) => prev.map((v) => (v.id === id ? { ...v, is_archived: !current } : v)));
    if (!current) setView('feed');
  }

  async function setDiscussionStatus(id: string, status: string) {
    const { data, error: err } = await supabase.from('discussions').update({ status }).eq('id', id).select('id').single();
    if (err || !data) { setError(err?.message ?? 'স্ট্যাটাস পরিবর্তন করা যায়নি।'); return; }
    setDiscussions((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  async function toggleVoteClosed(v: VoteRow) {
    const nextStatus = v.status === 'closed' ? 'open' : 'closed';
    const { data, error: err } = await supabase.from('votes').update({ status: nextStatus }).eq('id', v.id).select('id').single();
    if (err || !data) { setError(err?.message ?? 'স্ট্যাটাস পরিবর্তন করা যায়নি।'); return; }
    setVotes((prev) => prev.map((x) => (x.id === v.id ? { ...x, status: nextStatus } : x)));
  }

  async function deleteDiscussion(id: string) {
    if (!window.confirm('এই আলোচনাটা মুছে ফেলতে চান? এর সব রিপ্লাই ও অ্যাটাচমেন্টও মুছে যাবে।')) return;
    setBusyId(id);
    const { data, error: err } = await supabase.from('discussions').delete().eq('id', id).select('id');
    setBusyId(null);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) { setError('মুছে ফেলা যায়নি — পারমিশন সমস্যা হতে পারে।'); return; }
    setDiscussions((prev) => prev.filter((d) => d.id !== id));
    setView('feed');
  }

  async function deleteVote(id: string) {
    if (!window.confirm('এই ভোটটা মুছে ফেলতে চান? সব রেসপন্সও মুছে যাবে।')) return;
    setBusyId(id);
    const { data, error: err } = await supabase.from('votes').delete().eq('id', id).select('id');
    setBusyId(null);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) { setError('মুছে ফেলা যায়নি — পারমিশন সমস্যা হতে পারে।'); return; }
    setVotes((prev) => prev.filter((v) => v.id !== id));
    setView('feed');
  }

  // ---------------- replies / reactions ----------------
  function openDiscussion(id: string) {
    setActiveDiscussionId(id);
    setView('discussion');
    setReplyBody('');
    setShowReplyAttach(false);
    setReplyAttachName('');
    setReplyAttachUrl('');
    setEditingReplyId(null);
  }
  function openVote(id: string) {
    setActiveVoteId(id);
    setView('vote');
    setPendingOptionIds(new Set());
  }

  async function postReply() {
    if (!replyBody.trim() || !user || !activeDiscussionId) return;
    setPostingReply(true);
    const { data, error: err } = await supabase
      .from('discussion_replies')
      .insert({ discussion_id: activeDiscussionId, author_id: user.id, body: replyBody.trim() })
      .select(REPLY_SELECT)
      .single();
    if (err || !data) { setError(err?.message ?? 'রিপ্লাই পোস্ট করা যায়নি।'); setPostingReply(false); return; }
    const row = data as unknown as ReplyRow;
    let newAttachment: ReplyAttachmentRow | null = null;
    if (replyAttachName.trim() && replyAttachUrl.trim()) {
      const { data: attData } = await supabase
        .from('reply_attachments')
        .insert({ reply_id: row.id, file_name: replyAttachName.trim(), file_type: replyAttachType || guessLinkType(replyAttachUrl), url: replyAttachUrl.trim() })
        .select('id, reply_id, file_name, file_type, url')
        .single();
      if (attData) newAttachment = attData as ReplyAttachmentRow;
    }
    setReplies((prev) => [...prev, row]);
    if (newAttachment) setReplyAttachments((prev) => [...prev, newAttachment as ReplyAttachmentRow]);
    setReplyBody('');
    setReplyAttachName('');
    setReplyAttachUrl('');
    setReplyAttachType('');
    setShowReplyAttach(false);
    setPostingReply(false);
  }

  function quoteReply(authorName: string) {
    setReplyBody((prev) => (prev ? prev : `@${authorName} `));
    replyInputRef.current?.focus();
  }

  async function handleReplyFileUpload(file: File) {
    setReplyUploading(true);
    setReplyUploadProgress(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setReplyUploadProgress);
      setReplyAttachName(result.name ?? file.name);
      setReplyAttachUrl(result.webViewLink);
      setReplyAttachType(guessFileType(file));
      setShowReplyAttach(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setReplyUploading(false);
      setReplyUploadProgress(0);
    }
  }

  async function saveReplyEdit(id: string) {
    if (!editBody.trim()) return;
    const nowIso = new Date().toISOString();
    const { data, error: err } = await supabase.from('discussion_replies').update({ body: editBody.trim(), updated_at: nowIso }).eq('id', id).select('id').single();
    if (err || !data) { setError(err?.message ?? 'এডিট সেভ করা যায়নি।'); return; }
    setReplies((prev) => prev.map((r) => (r.id === id ? { ...r, body: editBody.trim(), updated_at: nowIso } : r)));
    setEditingReplyId(null);
  }

  async function toggleReaction(replyId: string, emoji: string) {
    if (!user) return;
    const mine = reactions.find((r) => r.reply_id === replyId && r.profile_id === user.id && r.emoji === emoji);
    if (mine) {
      const { error: err } = await supabase.from('reply_reactions').delete().eq('id', mine.id);
      if (!err) setReactions((prev) => prev.filter((r) => r.id !== mine.id));
      return;
    }
    const { data, error: err } = await supabase.from('reply_reactions').insert({ reply_id: replyId, profile_id: user.id, emoji }).select('id, reply_id, profile_id, emoji').single();
    if (!err && data) setReactions((prev) => [...prev, data as ReactionRow]);
  }

  // ---------------- vote submit ----------------
  async function submitVoteResponse() {
    if (!user || !activeVoteId || pendingOptionIds.size === 0) return;
    setSubmittingVote(true);
    await supabase.from('vote_responses').delete().eq('vote_id', activeVoteId).eq('voter_id', user.id);
    const rows = Array.from(pendingOptionIds).map((optId) => ({ vote_id: activeVoteId, option_id: optId, voter_id: user.id }));
    const { data, error: err } = await supabase.from('vote_responses').insert(rows).select('id, vote_id, option_id, voter_id');
    setSubmittingVote(false);
    if (err) { setError(err.message); return; }
    setVoteResponses((prev) => [...prev.filter((r) => !(r.vote_id === activeVoteId && r.voter_id === user.id)), ...((data as VoteResponseRow[]) ?? [])]);
    setPendingOptionIds(new Set());
  }

  // ---------------- create discussion modal ----------------
  function closeDiscussionModal() {
    setShowDiscussionModal(false);
    setDTitle('');
    setDDesc('');
    setDCategory(CATEGORY_OPTIONS[0]);
    setDTags('');
    setDProjectId('');
    setDMentionIds(new Set());
    setDAttachments([]);
    setDAttachName('');
    setDAttachUrl('');
    setDUploading(false);
    setDUploadProgress(0);
    setDiscussionError(null);
  }
  function addDiscussionAttachment() {
    if (!dAttachName.trim() || !dAttachUrl.trim()) return;
    setDAttachments((prev) => [...prev, { name: dAttachName.trim(), url: dAttachUrl.trim(), type: guessLinkType(dAttachUrl.trim()) }]);
    setDAttachName('');
    setDAttachUrl('');
  }
  async function handleDiscussionFileUpload(file: File) {
    setDUploading(true);
    setDUploadProgress(0);
    setDiscussionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setDUploadProgress);
      // আপলোড হওয়া webViewLink (Drive viewer পেজ) কোনো ইমেজ এক্সটেনশনে শেষ হয়
      // না, তাই টাইপ আসল ফাইল থেকেই ঠিক করা হচ্ছে — URL থেকে অনুমান করলে "ছবি"
      // ধরা পড়ত না।
      setDAttachments((prev) => [...prev, { name: result.name ?? file.name, url: result.webViewLink, type: guessFileType(file) }]);
    } catch (err) {
      setDiscussionError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setDUploading(false);
      setDUploadProgress(0);
    }
  }
  async function submitDiscussion(asDraft: boolean) {
    if (!dTitle.trim() || !user) return;
    setSavingDiscussion(true);
    setDiscussionError(null);
    const { data, error: err } = await supabase
      .from('discussions')
      .insert({
        title: dTitle.trim(), description: dDesc.trim() || null, category: dCategory || null, tags: dTags.trim() || null,
        project_id: dProjectId || null, author_id: user.id, is_draft: asDraft,
      })
      .select('id')
      .single();
    if (err || !data) { setDiscussionError(err?.message ?? 'সেভ করা যায়নি।'); setSavingDiscussion(false); return; }
    const discussionId = (data as { id: string }).id;
    if (dMentionIds.size > 0) {
      await supabase.from('discussion_mentions').insert(Array.from(dMentionIds).map((pid) => ({ discussion_id: discussionId, profile_id: pid })));
    }
    if (dAttachments.length > 0) {
      await supabase.from('discussion_attachments').insert(dAttachments.map((a) => ({ discussion_id: discussionId, file_name: a.name, file_type: a.type, url: a.url })));
    }
    await handleReload();
    setSavingDiscussion(false);
    closeDiscussionModal();
  }

  // ---------------- create vote modal ----------------
  function closeVoteModal() {
    setShowVoteModal(false);
    setVTitle('');
    setVDesc('');
    setVOptions(['', '']);
    setVAllowMultiple(false);
    setVAnonymous(false);
    setVEndsAt('');
    setVProjectId('');
    setVAttachments([]);
    setVAttachName('');
    setVAttachUrl('');
    setVUploading(false);
    setVUploadProgress(0);
    setVoteError(null);
  }
  function addVoteAttachment() {
    if (!vAttachName.trim() || !vAttachUrl.trim()) return;
    setVAttachments((prev) => [...prev, { name: vAttachName.trim(), url: vAttachUrl.trim(), type: guessLinkType(vAttachUrl.trim()) }]);
    setVAttachName('');
    setVAttachUrl('');
  }
  async function handleVoteFileUpload(file: File) {
    setVUploading(true);
    setVUploadProgress(0);
    setVoteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setVUploadProgress);
      setVAttachments((prev) => [...prev, { name: result.name ?? file.name, url: result.webViewLink, type: guessFileType(file) }]);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setVUploading(false);
      setVUploadProgress(0);
    }
  }
  async function submitVote(asDraft: boolean) {
    const labels = vOptions.map((o) => o.trim()).filter(Boolean);
    if (!vTitle.trim() || labels.length < 2 || !user) { setVoteError('শিরোনাম দিন এবং কমপক্ষে দুটো অপশন লিখুন।'); return; }
    setSavingVote(true);
    setVoteError(null);
    const { data, error: err } = await supabase
      .from('votes')
      .insert({
        title: vTitle.trim(), description: vDesc.trim() || null, project_id: vProjectId || null, author_id: user.id,
        allow_multiple: vAllowMultiple, is_anonymous: vAnonymous,
        ends_at: vEndsAt ? new Date(`${vEndsAt}T23:59:59`).toISOString() : null, is_draft: asDraft,
      })
      .select('id')
      .single();
    if (err || !data) { setVoteError(err?.message ?? 'সেভ করা যায়নি।'); setSavingVote(false); return; }
    const voteId = (data as { id: string }).id;
    const { error: optErr } = await supabase.from('vote_options').insert(labels.map((label, i) => ({ vote_id: voteId, label, position: i })));
    if (optErr) { setVoteError(optErr.message); setSavingVote(false); return; }
    if (vAttachments.length > 0) {
      await supabase.from('vote_attachments').insert(vAttachments.map((a) => ({ vote_id: voteId, file_name: a.name, file_type: a.type, url: a.url })));
    }
    await handleReload();
    setSavingVote(false);
    closeVoteModal();
  }

  // ---------------- feed derivation ----------------
  function matchesFilters(title: string, description: string | null, projectId: string | null, effectiveStatus: string) {
    const q = search.trim().toLowerCase();
    if (q && !title.toLowerCase().includes(q) && !(description ?? '').toLowerCase().includes(q)) return false;
    if (projectFilter && projectId !== projectFilter) return false;
    if (statusFilter && effectiveStatus !== statusFilter) return false;
    return true;
  }

  type FeedItem = { type: 'discussion'; data: DiscussionRow } | { type: 'vote'; data: VoteRow };
  const feedItems = useMemo(() => {
    let items: FeedItem[] = [];
    const myId = profile?.id;
    if (localView === 'votes') {
      items = votes.filter((v) => !v.is_draft && !v.is_archived).map((v) => ({ type: 'vote', data: v }));
    } else if (localView === 'mine') {
      items = [
        ...discussions.filter((d) => d.author_id === myId && !d.is_draft && !d.is_archived).map((d) => ({ type: 'discussion', data: d } as FeedItem)),
        ...votes.filter((v) => v.author_id === myId && !v.is_draft && !v.is_archived).map((v) => ({ type: 'vote', data: v } as FeedItem)),
      ];
    } else if (localView === 'pinned') {
      items = [
        ...discussions.filter((d) => d.is_pinned && !d.is_archived).map((d) => ({ type: 'discussion', data: d } as FeedItem)),
        ...votes.filter((v) => v.is_pinned && !v.is_archived).map((v) => ({ type: 'vote', data: v } as FeedItem)),
      ];
    } else if (localView === 'archived') {
      items = [
        ...discussions.filter((d) => d.is_archived).map((d) => ({ type: 'discussion', data: d } as FeedItem)),
        ...votes.filter((v) => v.is_archived).map((v) => ({ type: 'vote', data: v } as FeedItem)),
      ];
    } else if (localView === 'drafts') {
      items = [
        ...discussions.filter((d) => d.is_draft && d.author_id === myId).map((d) => ({ type: 'discussion', data: d } as FeedItem)),
        ...votes.filter((v) => v.is_draft && v.author_id === myId).map((v) => ({ type: 'vote', data: v } as FeedItem)),
      ];
    } else {
      items = [
        ...discussions.filter((d) => !d.is_draft && !d.is_archived).map((d) => ({ type: 'discussion', data: d } as FeedItem)),
        ...votes.filter((v) => !v.is_draft && !v.is_archived).map((v) => ({ type: 'vote', data: v } as FeedItem)),
      ];
    }

    items = items.filter((item) =>
      item.type === 'discussion'
        ? matchesFilters(item.data.title, item.data.description, item.data.project_id, item.data.status)
        : matchesFilters(item.data.title, item.data.description, item.data.project_id, voteIsClosed(item.data) ? 'closed' : 'open')
    );

    items.sort((a, b) => {
      if (a.data.is_pinned !== b.data.is_pinned) return a.data.is_pinned ? -1 : 1;
      return new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localView, discussions, votes, profile, search, projectFilter, statusFilter]);

  const counts = useMemo(() => {
    const myId = profile?.id;
    const activeD = discussions.filter((d) => !d.is_draft && !d.is_archived);
    const activeV = votes.filter((v) => !v.is_draft && !v.is_archived);
    return {
      all: activeD.length + activeV.length,
      votes: activeV.length,
      mine: activeD.filter((d) => d.author_id === myId).length + activeV.filter((v) => v.author_id === myId).length,
      pinned: [...activeD, ...activeV].filter((x) => x.is_pinned).length,
      archived: discussions.filter((d) => d.is_archived).length + votes.filter((v) => v.is_archived).length,
      drafts: discussions.filter((d) => d.is_draft && d.author_id === myId).length + votes.filter((v) => v.is_draft && v.author_id === myId).length,
    };
  }, [discussions, votes, profile]);

  const pinnedItems = useMemo(
    () => [
      ...discussions.filter((d) => d.is_pinned && !d.is_archived && !d.is_draft).map((d) => ({ type: 'discussion' as const, data: d })),
      ...votes.filter((v) => v.is_pinned && !v.is_archived && !v.is_draft).map((v) => ({ type: 'vote' as const, data: v })),
    ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()).slice(0, 3),
    [discussions, votes]
  );

  const insights = useMemo(() => {
    const list: string[] = [];
    const openDiscussions = discussions.filter((d) => !d.is_draft && !d.is_archived && d.status === 'open');
    for (const d of openDiscussions) {
      const dReplies = replies.filter((r) => r.discussion_id === d.id);
      const lastAt = dReplies.length > 0 ? dReplies[dReplies.length - 1].created_at : d.created_at;
      const daysInactive = daysSince(lastAt);
      if (daysInactive >= 4) { list.push(`"${d.title}" আলোচনাটা ${daysInactive} দিন ধরে ইনঅ্যাক্টিভ।`); break; }
    }
    const openVotes = votes.filter((v) => !v.is_draft && !v.is_archived && !voteIsClosed(v));
    for (const v of openVotes) {
      const stats = voteStats(v.id);
      const missing = teamOptions.length - stats.distinctVoters;
      if (missing > 0) { list.push(`"${v.title}" ভোটে এখনো ${missing} জন অংশ নেননি।`); break; }
    }
    if (openVotes.length > 0) {
      const top = openVotes[0];
      const stats = voteStats(top.id);
      if (stats.leader) list.push(`"${top.title}" ভোটে "${stats.leader.option.label}" ${stats.leader.pct}% নিয়ে এগিয়ে আছে।`);
    }
    if (list.length === 0) list.push('এই মুহূর্তে আলোচনা বা ভোট নিয়ে কোনো বিশেষ সতর্কতা নেই।');
    return list.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussions, votes, replies, voteOptions, voteResponses, teamOptions]);

  const activeDiscussion = discussions.find((d) => d.id === activeDiscussionId) ?? null;
  const activeVote = votes.find((v) => v.id === activeVoteId) ?? null;

  // ---------------- discussion detail derived ----------------
  const discussionReplies = activeDiscussion ? replies.filter((r) => r.discussion_id === activeDiscussion.id) : [];
  const discussionAttachmentsForActive = activeDiscussion ? discAttachments.filter((a) => a.discussion_id === activeDiscussion.id) : [];
  const voteAttachmentsForActive = activeVote ? voteAttachments.filter((a) => a.vote_id === activeVote.id) : [];
  const mentionedForActive = activeDiscussion ? mentions.filter((m) => m.discussion_id === activeDiscussion.id) : [];
  const participants = useMemo(() => {
    if (!activeDiscussion) return [];
    const repliedIds = new Set(discussionReplies.map((r) => r.author_id).filter(Boolean) as string[]);
    const mentionedIds = mentionedForActive.map((m) => m.profile_id);
    const ids = new Set<string>([...(activeDiscussion.author_id ? [activeDiscussion.author_id] : []), ...repliedIds, ...mentionedIds]);
    return Array.from(ids)
      .map((id) => ({ profile: profileById.get(id), active: repliedIds.has(id) || id === activeDiscussion.author_id }))
      .filter((p) => p.profile) as { profile: ProfileRow; active: boolean }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiscussion, replies, mentions, profileById]);

  const activeVoteStats = activeVote ? voteStats(activeVote.id) : null;
  const myVoteResponses = activeVote && profile ? voteResponses.filter((r) => r.vote_id === activeVote.id && r.voter_id === profile.id) : [];
  const hasVoted = myVoteResponses.length > 0;
  const showVoteResults = activeVote ? hasVoted || voteIsClosed(activeVote) : false;

  const emptyCopy: Record<LocalView, { title: string; sub: string }> = {
    all: { title: 'এখনো কোনো আলোচনা বা ভোট নেই', sub: 'নতুন আলোচনা শুরু করুন বা একটা ভোট তৈরি করুন।' },
    votes: { title: 'এখনো কোনো ভোট নেই', sub: '"Create Vote" চেপে প্রথম ভোটটা তৈরি করুন।' },
    mine: { title: 'আপনার কোনো আলোচনা বা ভোট নেই', sub: 'আপনার তৈরি করা আলোচনা/ভোট এখানে দেখা যাবে।' },
    pinned: { title: 'কিছু পিন করা নেই', sub: 'কোনো আলোচনা বা ভোট পিন করলে এখানে দেখা যাবে।' },
    archived: { title: 'আর্কাইভে কিছু নেই', sub: 'আর্কাইভ করা আলোচনা/ভোট এখানে দেখা যাবে।' },
    drafts: { title: 'এখনো কোনো ড্রাফট নেই', sub: 'নতুন আলোচনা বা ভোট শুরু করে "Save Draft" চাপলে এখানে দেখা যাবে।' },
  };

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  // ---------------- card renderers ----------------
  function renderDiscussionCard(d: DiscussionRow) {
    const meta = DISCUSSION_STATUS_META[d.status] ?? DISCUSSION_STATUS_META.open;
    const replyCount = replies.filter((r) => r.discussion_id === d.id).length;
    const attCount = discAttachments.filter((a) => a.discussion_id === d.id).length;
    const tags = (d.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    return (
      <button key={`d-${d.id}`} className="fcard" onClick={() => openDiscussion(d.id)}>
        {d.is_pinned && (
          <span className="pin-badge" title="Pinned"><Icon name="pin" size={15} /></span>
        )}
        <div className="fcard-top">
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: d.profiles?.avatar_color ?? undefined }}>{Array.from(d.profiles?.full_name ?? '?')[0]}</div>
          <div className="fcard-author">
            <div className="fcard-name-row"><span className="fcard-name">{d.profiles?.full_name ?? 'অজানা'}</span></div>
            <span className="fcard-role">{d.profiles?.role ?? ''}</span>
          </div>
          <span className="fcard-time">{relativeTimeBn(d.created_at)}</span>
        </div>
        <div className="fcard-title">{d.title}</div>
        {d.description && <div className="fcard-desc">{d.description}</div>}
        {tags.length > 0 && <div className="fcard-tags">{tags.map((t) => <span key={t} className="tag-chip">{t}</span>)}</div>}
        <div className="fcard-foot">
          {d.projects && <span className="proj-tag">{d.projects.name}</span>}
          <span className="fcard-meta-item"><Icon name="message" size={12} /> {replyCount}</span>
          {attCount > 0 && <span className="fcard-meta-item"><Icon name="paperclip" size={12} /> {attCount}</span>}
          <span className={`status-chip ${meta.cls}`}>{meta.label}</span>
        </div>
      </button>
    );
  }

  function renderVoteCard(v: VoteRow) {
    const stats = voteStats(v.id);
    const closed = voteIsClosed(v);
    const attCount = voteAttachments.filter((a) => a.vote_id === v.id).length;
    return (
      <button key={`v-${v.id}`} className="fcard" onClick={() => openVote(v.id)}>
        {v.is_pinned && (
          <span className="pin-badge" title="Pinned"><Icon name="pin" size={15} /></span>
        )}
        <div className="fcard-top">
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: v.profiles?.avatar_color ?? undefined }}>{Array.from(v.profiles?.full_name ?? '?')[0]}</div>
          <div className="fcard-author">
            <div className="fcard-name-row"><span className="fcard-name">{v.profiles?.full_name ?? 'অজানা'}</span><span className="vote-badge">Vote</span></div>
            <span className="fcard-role">{v.profiles?.role ?? ''}</span>
          </div>
          <span className="fcard-time">{voteCardTimeLabel(v)}</span>
        </div>
        <div className="fcard-title">{v.title}</div>
        {v.description && <div className="fcard-desc">{v.description}</div>}
        <div className="vote-mini">
          <div className="vote-mini-track"><div className="vote-mini-fill" style={{ width: `${stats.leader?.pct ?? 0}%` }}></div></div>
          <span className="vote-mini-label tabular">{stats.leader ? `${stats.leader.option.label} · ${stats.leader.pct}%` : 'এখনো কেউ ভোট দেননি'}</span>
        </div>
        <div className="fcard-foot">
          {v.projects && <span className="proj-tag">{v.projects.name}</span>}
          <span className="fcard-meta-item"><Icon name="user" size={12} /> {stats.distinctVoters}/{teamOptions.length} ভোট দিয়েছে</span>
          {attCount > 0 && <span className="fcard-meta-item"><Icon name="paperclip" size={12} /> {attCount}</span>}
          <span className={`status-chip ${closed ? 'st-closed' : 'st-open'}`}>{closed ? 'Closed' : 'Open'}</span>
        </div>
      </button>
    );
  }

  return (
    <div className={`discussions-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-logo" role="img" aria-label="FLOW 53"></div>
            </div>
            <nav className="nav-group" aria-label="Sidebar">
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <a key={item.label} href={item.href} className="nav-item"><Icon name={item.icon} /> {item.label}</a>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} />
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="search-box"><Icon name="search" /><span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — আলোচনা, ভোট...</span></button>
            <div className="topbar-spacer"></div>
            <button className="icon-btn" onClick={handleReload} disabled={reloading} aria-label="রিলোড"><Icon name="refresh" /></button>
            <button className="icon-btn" onClick={() => setDark((d) => !d)} aria-label="থিম"><Icon name={dark ? 'moon' : 'sun'} /></button>
          </header>

          <div className="hub-body">
            <nav className="local-nav">
              <div>
                <div className="local-nav-title">আলোচনা হাব</div>
                {LOCAL_NAV_ITEMS.map((item) => (
                  <button key={item.key} className={`local-item${localView === item.key ? ' active' : ''}`} onClick={() => { setLocalView(item.key); setView('feed'); }}>
                    <Icon name={item.icon} size={14} /> {item.label} <span className="cnt tabular">{counts[item.key]}</span>
                  </button>
                ))}
              </div>
              <div className="local-nav-foot">
                <button className="btn btn-accent btn-block btn-sm" onClick={() => setShowDiscussionModal(true)}><Icon name="plus" size={13} /> Create Discussion</button>
                <button className="btn btn-ghost btn-block btn-sm" onClick={() => setShowVoteModal(true)}><Icon name="bar-chart" size={13} /> Create Vote</button>
              </div>
            </nav>

            <main className="center-col">
              {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

              {/* ---------------- FEED VIEW ---------------- */}
              {view === 'feed' && (
                <div>
                  <div className="feed-head">
                    <div>
                      <div className="feed-title">Discussions</div>
                      <div className="feed-sub">টিম মিলে আইডিয়া রিভিউ করুন, আলোচনা করুন, একসাথে সিদ্ধান্ত নিন।</div>
                    </div>
                  </div>

                  <div className="feed-toolbar">
                    <div className="toolbar-search"><Icon name="search" size={13} /><input placeholder="খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <select className="filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                      <option value="">সব প্রজেক্ট</option>
                      {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">সব স্ট্যাটাস</option>
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    {(search || projectFilter || statusFilter) && (
                      <button className="filter-chip" onClick={() => { setSearch(''); setProjectFilter(''); setStatusFilter(''); }}><Icon name="close" size={12} /> Clear Filters</button>
                    )}
                    <div className="toolbar-spacer"></div>
                  </div>

                  {loading ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                  ) : feedItems.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><Icon name="message" /></div>
                      <div className="empty-title">{emptyCopy[localView].title}</div>
                      <div className="empty-sub">{emptyCopy[localView].sub}</div>
                    </div>
                  ) : (
                    <div className="feed-list">{feedItems.map((item) => (item.type === 'discussion' ? renderDiscussionCard(item.data) : renderVoteCard(item.data)))}</div>
                  )}
                </div>
              )}

              {/* ---------------- DISCUSSION DETAIL VIEW ---------------- */}
              {view === 'discussion' && activeDiscussion && (
                <div>
                  <button className="detail-back" onClick={() => setView('feed')}><Icon name="chevron-left" size={14} /> সব আলোচনায় ফিরুন</button>
                  <div className="detail-header">
                    <div className="detail-title-row">
                      <div className="detail-title">{activeDiscussion.title}</div>
                      <div className="detail-status-row">
                        <select className="status-select" value={activeDiscussion.status} onChange={(e) => setDiscussionStatus(activeDiscussion.id, e.target.value)}>
                          <option value="open">Open</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button className="icon-btn" title={activeDiscussion.is_pinned ? 'পিন সরান' : 'পিন করুন'} style={{ color: activeDiscussion.is_pinned ? 'var(--warning)' : undefined }} onClick={() => togglePin('discussion', activeDiscussion.id, activeDiscussion.is_pinned)}><Icon name="pin" size={15} /></button>
                        <button className="icon-btn" title={activeDiscussion.is_archived ? 'আনআর্কাইভ করুন' : 'আর্কাইভ করুন'} onClick={() => toggleArchive('discussion', activeDiscussion.id, activeDiscussion.is_archived)}><Icon name="archive" size={15} /></button>
                        {activeDiscussion.author_id === profile?.id && (
                          <button className="icon-btn" title="মুছে ফেলুন" style={{ color: 'var(--danger)' }} disabled={busyId === activeDiscussion.id} onClick={() => deleteDiscussion(activeDiscussion.id)}><Icon name="trash" size={15} /></button>
                        )}
                      </div>
                    </div>
                    <div className="detail-meta-row">
                      <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: activeDiscussion.profiles?.avatar_color ?? undefined }}>{Array.from(activeDiscussion.profiles?.full_name ?? '?')[0]}</div>
                      <span>{activeDiscussion.profiles?.full_name ?? 'অজানা'}</span><span className="sep"></span>
                      {activeDiscussion.projects && (<><span className="proj-tag">{activeDiscussion.projects.name}</span><span className="sep"></span></>)}
                      <span>{formatBnDate(activeDiscussion.created_at)} তৈরি</span>
                    </div>
                    {activeDiscussion.description && <p className="detail-desc">{activeDiscussion.description}</p>}
                    {(activeDiscussion.tags ?? '').trim() && (
                      <div className="fcard-tags" style={{ marginBottom: 12 }}>
                        {(activeDiscussion.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="tag-chip">{t}</span>)}
                      </div>
                    )}
                    {discussionAttachmentsForActive.length > 0 && (
                      <div className="detail-attach-row">
                        {discussionAttachmentsForActive.map((a) => (
                          <AttachmentPreview key={a.id} name={a.file_name} url={a.url} fileType={a.file_type} />
                        ))}
                      </div>
                    )}
                    {mentionedForActive.length > 0 && (
                      <div className="detail-mentions">
                        <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginRight: 4 }}>Mentioned:</span>
                        {mentionedForActive.map((m) => {
                          const p = profileById.get(m.profile_id);
                          if (!p) return null;
                          return <div key={m.profile_id} className="avatar" title={p.full_name} style={{ width: 20, height: 20, fontSize: 9, background: p.avatar_color ?? undefined }}>{Array.from(p.full_name)[0]}</div>;
                        })}
                      </div>
                    )}
                  </div>

                  <div className="composer">
                    <textarea ref={replyInputRef} className="composer-input" placeholder="একটা রিপ্লাই লিখুন..." value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                    {showReplyAttach && (
                      <div className="composer-attach-row">
                        <button type="button" className="btn btn-ghost btn-sm" disabled={replyUploading} onClick={() => document.getElementById('reply-file-input')?.click()}>
                          <Icon name="upload" size={12} /> {replyUploading ? `আপলোড হচ্ছে… ${replyUploadProgress}%` : 'ফাইল আপলোড করুন'}
                        </button>
                        <input id="reply-file-input" type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplyFileUpload(f); e.target.value = ''; }} />
                        <input placeholder="অথবা ফাইলের নাম" value={replyAttachName} onChange={(e) => setReplyAttachName(e.target.value)} disabled={replyUploading} />
                        <input placeholder="Drive/Figma লিংক পেস্ট করুন" value={replyAttachUrl} onChange={(e) => { setReplyAttachUrl(e.target.value); setReplyAttachType(guessLinkType(e.target.value)); }} style={{ flex: 1 }} disabled={replyUploading} />
                      </div>
                    )}
                    <div className="composer-foot">
                      <button className="icon-btn" title="Attach" onClick={() => setShowReplyAttach((s) => !s)}><Icon name="paperclip" size={15} /></button>
                      <div className="toolbar-spacer"></div>
                      <button className="btn btn-accent btn-sm" disabled={!replyBody.trim() || postingReply || replyUploading} onClick={postReply}>{postingReply ? 'পোস্ট হচ্ছে…' : 'রিপ্লাই দিন'}</button>
                    </div>
                  </div>

                  <div>
                    {discussionReplies.map((r) => {
                      const isMine = r.author_id === profile?.id;
                      const isEditing = editingReplyId === r.id;
                      const atts = replyAttachments.filter((a) => a.reply_id === r.id);
                      return (
                        <div className="reply-card" key={r.id}>
                          <div className="reply-top">
                            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: r.profiles?.avatar_color ?? undefined }}>{Array.from(r.profiles?.full_name ?? '?')[0]}</div>
                            <span className="reply-name">{r.profiles?.full_name ?? 'অজানা'}</span>
                            <span className="reply-role">{r.profiles?.role ?? ''}</span>
                            <span className="reply-time">{relativeTimeBn(r.created_at)}{r.updated_at !== r.created_at ? ' · এডিট করা হয়েছে' : ''}</span>
                          </div>
                          {isEditing ? (
                            <>
                              <textarea className="composer-input" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8, marginBottom: 8 }} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingReplyId(null)}>বাতিল</button>
                                <button className="btn btn-accent btn-sm" onClick={() => saveReplyEdit(r.id)}>সেভ করুন</button>
                              </div>
                            </>
                          ) : (
                            <p className="reply-body">{r.body}</p>
                          )}
                          {atts.length > 0 && (
                            <div className="reply-attach">
                              {atts.map((a) => <AttachmentPreview key={a.id} name={a.file_name} url={a.url} fileType={a.file_type} />)}
                            </div>
                          )}
                          <div className="reply-actions">
                            {REACTION_EMOJIS.map((emoji) => {
                              const count = reactions.filter((rc) => rc.reply_id === r.id && rc.emoji === emoji).length;
                              const active = !!profile && reactions.some((rc) => rc.reply_id === r.id && rc.emoji === emoji && rc.profile_id === profile.id);
                              return (
                                <button key={emoji} className={`reaction-chip${active ? ' active' : ''}`} onClick={() => toggleReaction(r.id, emoji)}>{emoji} {count}</button>
                              );
                            })}
                            <button className="reply-action" onClick={() => quoteReply(r.profiles?.full_name ?? '')}><Icon name="message" size={12} /> Reply</button>
                            {isMine && !isEditing && (
                              <button className="reply-action" onClick={() => { setEditingReplyId(r.id); setEditBody(r.body); }}><Icon name="edit" size={12} /> Edit</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------------- VOTE DETAIL VIEW ---------------- */}
              {view === 'vote' && activeVote && activeVoteStats && (
                <div>
                  <button className="detail-back" onClick={() => setView('feed')}><Icon name="chevron-left" size={14} /> সব আলোচনায় ফিরুন</button>
                  <div className="detail-header">
                    <div className="detail-title-row">
                      <div className="detail-title">{activeVote.title}</div>
                      <div className="detail-status-row">
                        <span className="vote-badge">Vote</span>
                        <button className="icon-btn" title={activeVote.is_pinned ? 'পিন সরান' : 'পিন করুন'} style={{ color: activeVote.is_pinned ? 'var(--warning)' : undefined }} onClick={() => togglePin('vote', activeVote.id, activeVote.is_pinned)}><Icon name="pin" size={15} /></button>
                        <button className="icon-btn" title={activeVote.is_archived ? 'আনআর্কাইভ করুন' : 'আর্কাইভ করুন'} onClick={() => toggleArchive('vote', activeVote.id, activeVote.is_archived)}><Icon name="archive" size={15} /></button>
                        {activeVote.author_id === profile?.id && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleVoteClosed(activeVote)}>{activeVote.status === 'closed' ? 'আবার খুলুন' : 'বন্ধ করুন'}</button>
                            <button className="icon-btn" title="মুছে ফেলুন" style={{ color: 'var(--danger)' }} disabled={busyId === activeVote.id} onClick={() => deleteVote(activeVote.id)}><Icon name="trash" size={15} /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="detail-meta-row">
                      <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: activeVote.profiles?.avatar_color ?? undefined }}>{Array.from(activeVote.profiles?.full_name ?? '?')[0]}</div>
                      <span>{activeVote.profiles?.full_name ?? 'অজানা'}</span><span className="sep"></span>
                      {activeVote.projects && (<><span className="proj-tag">{activeVote.projects.name}</span><span className="sep"></span></>)}
                      <span>{activeVote.ends_at ? `শেষ হবে ${formatBnDate(activeVote.ends_at)}` : 'কোনো নির্ধারিত সময় নেই'}</span>
                    </div>
                    {activeVote.description && <p className="detail-desc">{activeVote.description}</p>}
                    {voteAttachmentsForActive.length > 0 && (
                      <div className="detail-attach-row">
                        {voteAttachmentsForActive.map((a) => (
                          <AttachmentPreview key={a.id} name={a.file_name} url={a.url} fileType={a.file_type} />
                        ))}
                      </div>
                    )}
                  </div>

                  {!showVoteResults ? (
                    <div>
                      <div className="rp-title" style={{ marginBottom: 12 }}>অপশন বেছে নিন{activeVote.allow_multiple ? ' (একাধিক সিলেক্ট করা যাবে)' : ''}</div>
                      {activeVoteStats.options.map((o) => {
                        const selected = pendingOptionIds.has(o.id);
                        return (
                          <button
                            key={o.id}
                            className={`vote-option-row${selected ? ' selected' : ''}`}
                            onClick={() => {
                              setPendingOptionIds((prev) => {
                                const next = new Set(activeVote.allow_multiple ? prev : []);
                                if (prev.has(o.id) && activeVote.allow_multiple) next.delete(o.id);
                                else next.add(o.id);
                                return next;
                              });
                            }}
                          >
                            <span className={`vote-radio${activeVote.allow_multiple ? ' checkbox' : ''}`}><span className="vote-radio-dot"></span></span>
                            <span className="vote-option-label">{o.label}</span>
                          </button>
                        );
                      })}
                      <button className="btn btn-accent" style={{ marginTop: 6 }} disabled={pendingOptionIds.size === 0 || submittingVote} onClick={submitVoteResponse}>{submittingVote ? 'সাবমিট হচ্ছে…' : 'Submit Vote'}</button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12 }}>
                        {activeVote.is_anonymous ? 'Anonymous Voting চালু আছে — তাই কে কোন অপশনে ভোট দিয়েছেন তা দেখানো হচ্ছে না।' : 'Anonymous Voting বন্ধ আছে — তাই কে কোন অপশনে ভোট দিয়েছেন তা নিচে দেখা যাচ্ছে।'}
                      </p>
                      {activeVoteStats.leader && (
                        <div className="winner-banner">
                          <Icon name="trophy" size={20} />
                          <div><b style={{ fontSize: 12.5 }}>{activeVoteStats.leader.option.label} এগিয়ে আছে</b><div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{activeVoteStats.leader.pct}% ভোট নিয়ে</div></div>
                        </div>
                      )}
                      {activeVoteStats.withCounts.map(({ option, count, pct }) => {
                        const isWinner = activeVoteStats.leader?.option.id === option.id && count > 0;
                        const voters = activeVote.is_anonymous ? [] : voteResponses.filter((r) => r.vote_id === activeVote.id && r.option_id === option.id).map((r) => profileById.get(r.voter_id)).filter(Boolean) as ProfileRow[];
                        return (
                          <div className="result-row" key={option.id}>
                            <div className="result-top"><span className="result-label">{isWinner && <span className="winner-crown">★</span>} {option.label}</span><span className="result-pct tabular">{pct}%</span></div>
                            <div className="result-track"><div className={`result-fill${isWinner ? ' winner' : ''}`} style={{ width: `${pct}%` }}></div></div>
                            <div className="result-count tabular">{count} ভোট</div>
                            {!activeVote.is_anonymous && (voters.length > 0 ? (
                              <div className="voter-stack" title="যারা ভোট দিয়েছেন">
                                {voters.map((p) => <div key={p.id} className="avatar" title={p.full_name} style={{ background: p.avatar_color ?? undefined }}>{Array.from(p.full_name)[0]}</div>)}
                              </div>
                            ) : (
                              <div className="voter-stack-empty">কেউ এখনো ভোট দেননি</div>
                            ))}
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }} className="tabular">Participation: {activeVoteStats.distinctVoters}/{teamOptions.length} ({teamOptions.length > 0 ? Math.round((activeVoteStats.distinctVoters / teamOptions.length) * 100) : 0}%)</div>
                    </div>
                  )}
                </div>
              )}
            </main>

            {/* ---------------- RIGHT PANEL ---------------- */}
            <aside className="right-col">
              {view === 'feed' && (
                <div>
                  <div className="rp-section">
                    <div className="rp-title">📌 Pinned আলোচনা</div>
                    {pinnedItems.length === 0 ? (
                      <div className="rp-activity-row" style={{ color: 'var(--ink-faint)' }}>কিছু পিন করা নেই।</div>
                    ) : (
                      pinnedItems.map((item) => (
                        <button key={`${item.type}-${item.data.id}`} className="local-item" style={{ padding: '6px 0', fontWeight: 500 }} onClick={() => (item.type === 'discussion' ? openDiscussion(item.data.id) : openVote(item.data.id))}>
                          <span>{item.type === 'vote' ? '🗳️' : '🔥'} <b>{item.data.title}</b></span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="rp-section">
                    <div className="rp-title">AI Collaboration Assistant</div>
                    <div className="ai-card-mini">
                      <div className="ai-head-mini"><div className="ai-badge-mini"><Icon name="spark" size={13} /></div><span style={{ fontSize: 12.5, fontWeight: 600 }}>AI ইনসাইট</span></div>
                      {insights.map((text, i) => <div className="ai-item-mini" key={i}><span className="dot"></span> {text}</div>)}
                      <button className="btn btn-accent btn-block btn-sm" style={{ marginTop: 4 }} disabled title="শীঘ্রই আসছে">Generate Summary</button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'discussion' && activeDiscussion && (
                <div>
                  <div className="rp-section">
                    <div className="rp-title">Members Participating</div>
                    {participants.map((p) => (
                      <div className="rp-member-row" key={p.profile.id}>
                        <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: p.profile.avatar_color ?? undefined }}>{Array.from(p.profile.full_name)[0]}</div>
                        <span className="rp-member-name">{p.profile.full_name}</span>
                        <span className="rp-status-dot" style={{ background: p.active ? 'var(--positive)' : 'var(--ink-faint)' }}></span>
                      </div>
                    ))}
                  </div>
                  <div className="rp-section">
                    <div className="rp-title">Recent Activity</div>
                    {discussionReplies.length === 0 ? (
                      <div className="rp-activity-row" style={{ color: 'var(--ink-faint)' }}>এখনো কোনো রিপ্লাই নেই।</div>
                    ) : (
                      discussionReplies.slice(-3).reverse().map((r) => (
                        <div className="rp-activity-row" key={r.id}><span><b>{r.profiles?.full_name ?? 'অজানা'}</b> রিপ্লাই দিয়েছেন<div className="rp-time">{relativeTimeBn(r.created_at)}</div></span></div>
                      ))
                    )}
                  </div>
                  {discussionAttachmentsForActive.length > 0 && (
                    <div className="rp-section">
                      <div className="rp-title">Related Files</div>
                      {discussionAttachmentsForActive.map((a) => (
                        <AttachmentPreview key={a.id} name={a.file_name} url={a.url} fileType={a.file_type} style={{ marginBottom: 6 }} />
                      ))}
                    </div>
                  )}
                  {activeDiscussion.projects && (
                    <div className="rp-section">
                      <div className="rp-title">Linked Project</div>
                      <div className="linked-proj-mini">
                        <div className="lp-name">{activeDiscussion.projects.name}</div>
                        <div className="lp-track"><div className="lp-fill" style={{ width: `${projectProgress.get(activeDiscussion.projects.id) ?? 0}%` }}></div></div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{projectProgress.get(activeDiscussion.projects.id) ?? 0}% সম্পন্ন</div>
                        <Link className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} href={`/projects/${activeDiscussion.projects.id}`}>প্রজেক্ট দেখুন</Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {view === 'vote' && activeVote && (
                <div>
                  <div className="rp-section">
                    <div className="rp-title">সময় বাকি</div>
                    {(() => {
                      const cd = countdownParts(activeVote.ends_at);
                      return <div className="countdown-box"><div className="countdown-value tabular">{cd.value}</div><div className="countdown-label">{cd.label}</div></div>;
                    })()}
                  </div>
                  <div className="rp-section">
                    <div className="rp-title">Participation</div>
                    <div className="lp-track" style={{ marginBottom: 6 }}><div className="lp-fill" style={{ width: `${teamOptions.length > 0 ? Math.round(((activeVoteStats?.distinctVoters ?? 0) / teamOptions.length) * 100) : 0}%` }}></div></div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }} className="tabular">{activeVoteStats?.distinctVoters ?? 0} / {teamOptions.length} জন ভোট দিয়েছেন</div>
                  </div>
                  <div className="rp-section">
                    <div className="rp-title">Current Leader</div>
                    <div className="linked-proj-mini">
                      {activeVoteStats?.leader ? (
                        <><div className="lp-name">🏆 {activeVoteStats.leader.option.label}</div><div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{activeVoteStats.leader.pct}% ভোট নিয়ে এগিয়ে</div></>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>এখনো কেউ ভোট দেননি</div>
                      )}
                    </div>
                  </div>
                  {voteAttachmentsForActive.length > 0 && (
                    <div className="rp-section">
                      <div className="rp-title">Related Files</div>
                      {voteAttachmentsForActive.map((a) => (
                        <AttachmentPreview key={a.id} name={a.file_name} url={a.url} fileType={a.file_type} style={{ marginBottom: 6 }} />
                      ))}
                    </div>
                  )}
                  {activeVote.projects && (
                    <div className="rp-section">
                      <div className="rp-title">Linked Project</div>
                      <div className="linked-proj-mini">
                        <div className="lp-name">{activeVote.projects.name}</div>
                        <div className="lp-track"><div className="lp-fill" style={{ width: `${projectProgress.get(activeVote.projects.id) ?? 0}%` }}></div></div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{projectProgress.get(activeVote.projects.id) ?? 0}% সম্পন্ন</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* ============ MODAL: Create Discussion ============ */}
      {showDiscussionModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !savingDiscussion) closeDiscussionModal(); }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon"><Icon name="message" /></div>
              <span className="modal-title-lg">নতুন আলোচনা শুরু করুন</span>
              <button className="modal-close" onClick={closeDiscussionModal}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field"><label className="modal-label">শিরোনাম</label><input className="modal-input" value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="যেমন: হোমপেজ টাইপোগ্রাফি নিয়ে মতামত দরকার" autoFocus /></div>
              <div className="modal-field"><label className="modal-label">বিবরণ</label><textarea className="modal-textarea" value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="বিস্তারিত লিখুন..." /></div>
              <div className="modal-field"><label className="modal-label">ক্যাটাগরি</label>
                <select className="modal-select" value={dCategory} onChange={(e) => setDCategory(e.target.value)}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="modal-field"><label className="modal-label">ট্যাগ</label><input className="modal-input" value={dTags} onChange={(e) => setDTags(e.target.value)} placeholder="যেমন: UI, রিভিশন (কমা দিয়ে আলাদা করুন)" /></div>
              <div className="modal-field"><label className="modal-label">সম্পর্কিত প্রজেক্ট (ঐচ্ছিক)</label>
                <select className="modal-select" value={dProjectId} onChange={(e) => setDProjectId(e.target.value)}>
                  <option value="">কোনোটা না</option>
                  {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">মেনশন করুন (ঐচ্ছিক)</label>
                <div className="mention-grid">
                  {teamOptions.map((t) => (
                    <button key={t.id} type="button" className={`mention-pill${dMentionIds.has(t.id) ? ' selected' : ''}`} onClick={() => setDMentionIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}>
                      <div className="avatar" style={{ width: 18, height: 18, fontSize: 8, background: t.avatar_color ?? undefined }}>{Array.from(t.full_name)[0]}</div> {t.full_name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">অ্যাটাচমেন্ট (ঐচ্ছিক)</label>
                {dAttachments.map((a, i) => {
                  return (
                    <div key={i} className="attach-chip" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {canPreviewInline(a.type, a.url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={driveThumbnailUrl(a.url)} alt={a.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <Icon name={attachTypeIcon(a.type)} size={13} />
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      </span>
                      <button type="button" onClick={() => setDAttachments((prev) => prev.filter((_, idx) => idx !== i))}><Icon name="close" size={12} /></button>
                    </div>
                  );
                })}
                <div className="option-input-row">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={dUploading} onClick={() => document.getElementById('discussion-file-input')?.click()}>
                    <Icon name="upload" size={13} /> {dUploading ? `আপলোড হচ্ছে… ${dUploadProgress}%` : 'ফাইল আপলোড করুন'}
                  </button>
                </div>
                <input id="discussion-file-input" type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDiscussionFileUpload(f); e.target.value = ''; }} />
                <div className="option-input-row">
                  <input className="modal-input" value={dAttachName} onChange={(e) => setDAttachName(e.target.value)} placeholder="অথবা ফাইলের নাম" disabled={dUploading} />
                  <input className="modal-input" value={dAttachUrl} onChange={(e) => setDAttachUrl(e.target.value)} placeholder="Drive/Figma লিংক পেস্ট করুন" disabled={dUploading} />
                  <button type="button" className="option-remove" onClick={addDiscussionAttachment} title="যোগ করুন" disabled={dUploading}><Icon name="plus" size={14} /></button>
                </div>
              </div>
              {discussionError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{discussionError}</p>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm" onClick={closeDiscussionModal} disabled={savingDiscussion}>বাতিল</button>
              <button className="btn btn-ghost btn-sm" onClick={() => submitDiscussion(true)} disabled={savingDiscussion || dUploading || !dTitle.trim()}>Save Draft</button>
              <button className="btn btn-accent btn-sm" onClick={() => submitDiscussion(false)} disabled={savingDiscussion || dUploading || !dTitle.trim()}>{savingDiscussion ? 'পাবলিশ হচ্ছে…' : 'Publish Discussion'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: Create Vote ============ */}
      {showVoteModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !savingVote) closeVoteModal(); }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="bar-chart" /></div>
              <span className="modal-title-lg">নতুন ভোট তৈরি করুন</span>
              <button className="modal-close" onClick={closeVoteModal}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field"><label className="modal-label">ভোটের শিরোনাম</label><input className="modal-input" value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="যেমন: ফাইনাল আইকন সেট বেছে নিন" autoFocus /></div>
              <div className="modal-field"><label className="modal-label">বিবরণ</label><textarea className="modal-textarea" value={vDesc} onChange={(e) => setVDesc(e.target.value)} placeholder="প্রেক্ষাপট লিখুন..." /></div>
              <div className="modal-field">
                <label className="modal-label">অপশনসমূহ</label>
                {vOptions.map((opt, i) => (
                  <div key={i} className="option-input-row">
                    <input className="modal-input" value={opt} onChange={(e) => setVOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))} placeholder={`অপশন ${i + 1}`} />
                    <button type="button" className="option-remove" disabled={vOptions.length <= 2} onClick={() => setVOptions((prev) => prev.filter((_, idx) => idx !== i))}><Icon name="close" size={13} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVOptions((prev) => [...prev, ''])}><Icon name="plus" size={13} /> আরেকটা অপশন যোগ করুন</button>
              </div>
              <div className="toggle-row"><span className="toggle-label">একাধিক অপশন সিলেক্ট করা যাবে</span><button type="button" className={`toggle-switch${vAllowMultiple ? ' on' : ''}`} onClick={() => setVAllowMultiple((v) => !v)}><span className="toggle-knob"></span></button></div>
              <div className="toggle-row"><span className="toggle-label">Anonymous Voting</span><button type="button" className={`toggle-switch${vAnonymous ? ' on' : ''}`} onClick={() => setVAnonymous((v) => !v)}><span className="toggle-knob"></span></button></div>
              <div className="modal-field" style={{ marginTop: 8 }}><label className="modal-label">End Date (ঐচ্ছিক)</label><input type="date" className="modal-input" value={vEndsAt} onChange={(e) => setVEndsAt(e.target.value)} /></div>
              <div className="modal-field"><label className="modal-label">সম্পর্কিত প্রজেক্ট (ঐচ্ছিক)</label>
                <select className="modal-select" value={vProjectId} onChange={(e) => setVProjectId(e.target.value)}>
                  <option value="">কোনোটা না</option>
                  {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">অ্যাটাচমেন্ট (ঐচ্ছিক)</label>
                {vAttachments.map((a, i) => {
                  return (
                  <div key={i} className="attach-chip" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {canPreviewInline(a.type, a.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={driveThumbnailUrl(a.url)} alt={a.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <Icon name={attachTypeIcon(a.type)} size={13} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    </span>
                    <button type="button" onClick={() => setVAttachments((prev) => prev.filter((_, idx) => idx !== i))}><Icon name="close" size={12} /></button>
                  </div>
                  );
                })}
                <div className="option-input-row">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={vUploading} onClick={() => document.getElementById('vote-file-input')?.click()}>
                    <Icon name="upload" size={13} /> {vUploading ? `আপলোড হচ্ছে… ${vUploadProgress}%` : 'ফাইল আপলোড করুন'}
                  </button>
                </div>
                <input id="vote-file-input" type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVoteFileUpload(f); e.target.value = ''; }} />
                <div className="option-input-row">
                  <input className="modal-input" value={vAttachName} onChange={(e) => setVAttachName(e.target.value)} placeholder="অথবা ফাইলের নাম" disabled={vUploading} />
                  <input className="modal-input" value={vAttachUrl} onChange={(e) => setVAttachUrl(e.target.value)} placeholder="Drive/Figma লিংক পেস্ট করুন" disabled={vUploading} />
                  <button type="button" className="option-remove" onClick={addVoteAttachment} title="যোগ করুন" disabled={vUploading}><Icon name="plus" size={14} /></button>
                </div>
              </div>
              {voteError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{voteError}</p>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm" onClick={closeVoteModal} disabled={savingVote}>বাতিল</button>
              <button className="btn btn-ghost btn-sm" onClick={() => submitVote(true)} disabled={savingVote || vUploading || !vTitle.trim()}>Save Draft</button>
              <button className="btn btn-accent btn-sm" onClick={() => submitVote(false)} disabled={savingVote || vUploading || !vTitle.trim()}>{savingVote ? 'পাবলিশ হচ্ছে…' : 'Publish Vote'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
