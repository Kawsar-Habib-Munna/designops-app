'use client';

// Screen 19 — Files & Documents (client)। v2: sidebar shell + rich files hub।
//
// "Folders" real category কলাম থেকেই আসে (নতুন কোনো folders টেবিল না) — শুধু যে
// category-তে আসলেই ফাইল আছে সেটাই একটা "folder"। "New Folder" বাদ দেওয়া হয়েছে
// কারণ এই আর্কিটেকচারে user-created arbitrary folder বলে কিছু নেই (category
// একটা fixed enum) — fake বাটন রাখা হয়নি। "Shared By" এখন real uploaded_by_id
// (ফেজ ১৭, Messages-এর sender_id-এর same প্যাটার্ন) থেকে টিম মেম্বারের real
// নাম/role/avatar দেখায়, কোনো ID না থাকলে (পুরনো রো) জেনেরিক "FLOW 53 Team"।

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveDownloadUrl, driveThumbnailUrl } from '@/lib/driveUpload';
import MediaPreviewModal, { type MediaPreviewItem } from '@/app/components/MediaPreviewModal';
import { formatDateLong } from '@/lib/format';
import ClientBottomNav from '@/app/components/ClientBottomNav';
import ClientSelect from '@/app/components/ClientSelect';
import AvatarImage from '@/app/components/AvatarImage';
import '../../../client-shared.css';
import './files.css';
import './files-v2.css';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  grid2: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  move: '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

// "Need help?" বাটন — বাকি client portal পেজগুলোর (project dashboard, payments)
// "Contact Support" লিংকের মতোই সরাসরি WhatsApp-এ প্রি-ফিল্ড মেসেজ নিয়ে যায়।
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

type ProjectInfo = { id: string; name: string };
type UploaderProfile = { id: string; full_name: string; role: string | null; avatar_url: string | null };
type FileRow = {
  id: string;
  name: string;
  file_type: string | null;
  size_bytes: number | null;
  drive_url: string;
  category: string;
  uploaded_by: string;
  uploaded_by_id: string | null;
  folder_id?: string | null;
  created_at: string;
};
type CustomFolder = { id: string; name: string; created_at: string };
type FolderTile = { id: string; label: string; count: number; latest: FileRow | null; custom: boolean };

const CATEGORY_LABEL: Record<string, string> = {
  requirements: 'Project Requirements',
  sow: 'Statement of Work',
  invoice: 'Invoices',
  receipt: 'Receipts',
  design: 'Design Files',
  deliverable: 'Deliverables',
  other: 'Other',
};
const CATEGORY_ORDER = ['requirements', 'sow', 'invoice', 'receipt', 'design', 'deliverable', 'other'];
const PAGE_SIZE = 5;

// one colour per folder, shared by the ring and the little dots on the folder tiles
const FOLDER_COLORS = ['var(--accent)', 'var(--positive)', 'var(--warning)', '#2f6fdb', 'var(--danger)', '#0ea5a4', '#ec4899'];

// donut of how the files are split across folders, with the total in the middle
function FilesRing({ segments, total }: { segments: { key: string; label: string; value: number; color: string }[]; total: number }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const innerR = r - stroke / 2 - 11; // the thin circle inside the thick ring
  const circ = 2 * Math.PI * r;
  const sum = segments.reduce((n, seg) => n + seg.value, 0);
  const gap = segments.length > 1 ? stroke + 4 : 0; // round caps stick out by half the stroke at each end
  return (
    <div className="ff-ring" role="img" aria-label={`${total} files in ${segments.length} folders`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={innerR} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.7" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, i) => {
            const before = segments.slice(0, i).reduce((n, v) => n + v.value, 0);
            const len = sum > 0 ? (seg.value / sum) * circ : 0;
            const dash = Math.max(len - gap, 0.1);
            const start = (before / sum) * circ + gap / 2;
            return <circle key={seg.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-start} />;
          })}
        </g>
      </svg>
      <div className="ff-ring-center">
        <strong>{total}</strong>
        <span>{total === 1 ? 'file' : 'files'}</span>
      </div>
    </div>
  );
}

// small donut for the key-number cards
function MiniRing({ pct, color }: { pct: number; color: string }) {
  const size = 46;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dx-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

// tiny column chart (values 0..1) for the key-number cards
function MiniBars({ values, color }: { values: number[]; color: string }) {
  const w = 46;
  const h = 34;
  const gap = 3;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {values.map((v, i) => {
        const bh = Math.max(3, v * h);
        return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)} fill={color} opacity={v > 0 ? 1 : 0.25} />;
      })}
    </svg>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? (parts.pop() as string).toUpperCase() : 'FILE';
}
// accepts "figma.com/file/x", "https://…", etc. and returns a clean http(s) address, or null when it is not a link
function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
type Kind = 'pdf' | 'image' | 'doc' | 'sheet' | 'slides' | 'zip' | 'video' | 'audio' | 'figma' | 'text' | 'other';
const KIND_LABEL: Record<Kind, string> = { pdf: 'PDF', image: 'Images', doc: 'Documents', sheet: 'Spreadsheets', slides: 'Presentations', zip: 'Archives', video: 'Videos', audio: 'Audio', figma: 'Figma', text: 'Text', other: 'Other' };
const EXT_KIND: Record<string, Kind> = {
  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image', bmp: 'image',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc', pages: 'doc', xls: 'sheet', xlsx: 'sheet', csv: 'sheet', ods: 'sheet', numbers: 'sheet',
  ppt: 'slides', pptx: 'slides', odp: 'slides', key: 'slides', zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio',
  fig: 'figma', txt: 'text', md: 'text', json: 'text', xml: 'text', log: 'text',
};
function typeKind(f: { name: string; file_type: string | null }): Kind {
  const fromExt = EXT_KIND[(f.name.split('.').pop() ?? '').toLowerCase()];
  if (fromExt) return fromExt;
  const t = f.file_type ?? '';
  return (['pdf', 'image', 'doc', 'sheet', 'slides', 'zip', 'video', 'audio', 'figma', 'text'] as string[]).includes(t) ? (t as Kind) : 'other';
}
// small picture of an image file; if Google cannot serve it, the coloured type tile is shown instead
function FileThumb({ f, kind, className }: { f: { name: string; drive_url: string }; kind: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`ff-type ff-type-${kind}`}>{(f.name.split('.').pop() ?? 'IMG').toUpperCase().slice(0, 4)}</span>;
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={driveThumbnailUrl(f.drive_url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </span>
  );
}

// what the preview window should treat this file as: decided by the extension first, so images and documents open
// even when the stored type is just "other"
function previewType(f: { name: string; file_type: string | null }): string | null {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  const map: Record<string, string> = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', heic: 'image',
    pdf: 'pdf', mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio',
    doc: 'doc', docx: 'doc', rtf: 'doc', odt: 'doc', xls: 'sheet', xlsx: 'sheet', csv: 'sheet', ods: 'sheet', ppt: 'slides', pptx: 'slides', odp: 'slides', txt: 'text',
  };
  return map[ext] ?? f.file_type;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function dayLabel(iso: string, nowIso: string): string {
  if (isSameDay(iso, nowIso)) return 'Today';
  const yesterday = new Date(nowIso);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return formatDateLong(iso);
}
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ClientFilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [allRows, setFiles] = useState<FileRow[]>([]);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null); // the row whose actions menu is open (phones)
  const [linkToDelete, setLinkToDelete] = useState<FileRow | null>(null);
  const [deletingLink, setDeletingLink] = useState(false);
  const [deleteLinkError, setDeleteLinkError] = useState<string | null>(null);
  const [uploaders, setUploaders] = useState<Record<string, UploaderProfile>>({});
  const [nowIso, setNowIso] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadInfo, setUploadInfo] = useState<{ index: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size' | 'oldest'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  // the step shown when "Upload files" is pressed: pick the folder first (or create the very first one)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<File[] | null>(null); // files dropped onto the card, waiting for a folder
  const [pickerChoice, setPickerChoice] = useState(''); // '' = no folder, otherwise a folder id
  const [pickerNewName, setPickerNewName] = useState('');
  const [pickerCreating, setPickerCreating] = useState(false); // the "new folder" field is open
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);
  const pendingFolderRef = useRef<string | null>(null);
  const [foldersReady, setFoldersReady] = useState(true); // false until the folders table exists in the database
  const [folderModal, setFolderModal] = useState<{ mode: 'new' | 'rename' | 'delete' | 'move'; folder?: CustomFolder; file?: FileRow } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<MediaPreviewItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        setClient(own.client);
        setNowIso(new Date().toISOString());

        const baseCols = 'id, name, file_type, size_bytes, drive_url, category, uploaded_by, uploaded_by_id, created_at';
        let filesRes: { data: unknown; error: unknown } = await supabase.from('client_files').select(`${baseCols}, folder_id`).eq('client_id', own.client.id).order('created_at', { ascending: false });
        let hasFolderColumn = true;
        if (filesRes.error) {
          // the folder_id column is not in the database yet: load the files without it
          hasFolderColumn = false;
          filesRes = await supabase.from('client_files').select(baseCols).eq('client_id', own.client.id).order('created_at', { ascending: false });
        }
        const rows = (filesRes.data as unknown as FileRow[]) ?? [];
        setFiles(rows);
        const foldersRes = hasFolderColumn ? await supabase.from('client_folders').select('id, name, created_at').eq('client_id', own.client.id).order('created_at', { ascending: true }) : null;
        setFoldersReady(!!foldersRes && !foldersRes.error);
        setCustomFolders(foldersRes && !foldersRes.error ? ((foldersRes.data as CustomFolder[]) ?? []) : []);

        const uploaderIds = Array.from(new Set(rows.filter((f) => f.uploaded_by_id).map((f) => f.uploaded_by_id as string)));
        if (uploaderIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, avatar_url').in('id', uploaderIds);
          const map: Record<string, UploaderProfile> = {};
          (profilesData as UploaderProfile[] | null)?.forEach((p) => {
            map[p.id] = p;
          });
          setUploaders(map);
        }

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    })();
  }, [router, projectId, reloadKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  // any number of files, of any type: documents, images, spreadsheets, videos, archives, design files …
  async function uploadFiles(list: File[], folderId: string | null) {
    if (list.length === 0 || !client) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setUploadError('Your session has expired. Please sign in again.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setUploadInfo({ index: i + 1, total: list.length });
      setUploadProgress(0);
      try {
        const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
        const { error } = await supabase.from('client_files').insert({
          client_id: client.id,
          project_id: project?.id,
          name: file.name,
          file_type: guessFileType(file),
          size_bytes: file.size,
          drive_url: result.webViewLink,
          category: 'other',
          uploaded_by: 'client',
          ...(folderId ? { folder_id: folderId } : {}),
        });
        if (error) throw new Error(error.message);
      } catch (err) {
        failed.push(`${file.name}${err instanceof Error && err.message ? ` (${err.message})` : ''}`);
      }
    }
    if (failed.length > 0) setUploadError(`Couldn't upload: ${failed.join(', ')}`);
    setUploadInfo(null);
    setUploading(false);
    setReloadKey((k) => k + 1);
  }

  // a link of any kind (Figma, Google Docs, a website, a video …) is stored as a "link" entry instead of a file
  async function saveLink(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    const href = normalizeUrl(linkUrl);
    if (!href) {
      setLinkError('Please enter a valid link, for example https://figma.com/file/…');
      return;
    }
    setSavingLink(true);
    setLinkError(null);
    const { error } = await supabase.from('client_files').insert({
      client_id: client.id,
      project_id: project?.id,
      name: linkTitle.trim() || domainOf(href),
      file_type: 'link',
      size_bytes: null,
      drive_url: href,
      category: 'other',
      uploaded_by: 'client',
    });
    setSavingLink(false);
    if (error) {
      setLinkError(error.message);
      return;
    }
    setLinkOpen(false);
    setLinkUrl('');
    setLinkTitle('');
    setReloadKey((k) => k + 1);
  }

  function openFolderModal(mode: 'new' | 'rename' | 'delete' | 'move', folder?: CustomFolder, file?: FileRow) {
    setFolderModal({ mode, folder, file });
    setFolderName(mode === 'rename' && folder ? folder.name : '');
    setFolderError(null);
  }

  async function saveFolder(e: FormEvent) {
    e.preventDefault();
    if (!client || !folderModal) return;
    const name = folderName.trim();
    if (!name) {
      setFolderError('Please give the folder a name.');
      return;
    }
    if (name.length > 40) {
      setFolderError('Keep the name under 40 characters.');
      return;
    }
    if (customFolders.some((cf) => cf.name.toLowerCase() === name.toLowerCase() && cf.id !== folderModal.folder?.id)) {
      setFolderError('You already have a folder with this name.');
      return;
    }
    setSavingFolder(true);
    setFolderError(null);
    const res =
      folderModal.mode === 'rename' && folderModal.folder
        ? await supabase.from('client_folders').update({ name }).eq('id', folderModal.folder.id)
        : await supabase.from('client_folders').insert({ client_id: client.id, name });
    setSavingFolder(false);
    if (res.error) {
      setFolderError(foldersReady ? res.error.message : 'Folders are not set up yet. Please ask your project team to enable them.');
      return;
    }
    setFolderModal(null);
    setReloadKey((k) => k + 1);
  }

  async function deleteFolder() {
    if (!folderModal?.folder) return;
    setSavingFolder(true);
    const { error } = await supabase.from('client_folders').delete().eq('id', folderModal.folder.id);
    setSavingFolder(false);
    if (error) {
      setFolderError(error.message);
      return;
    }
    if (categoryFilter === `f:${folderModal.folder.id}`) setCategoryFilter(null);
    setFolderModal(null);
    setReloadKey((k) => k + 1);
  }

  async function moveFile(file: FileRow, folderId: string | null) {
    setSavingFolder(true);
    const { error } = await supabase.rpc('move_client_file', { p_file_id: file.id, p_folder_id: folderId });
    setSavingFolder(false);
    if (error) {
      setFolderError(error.message);
      return;
    }
    setFolderModal(null);
    setReloadKey((k) => k + 1);
  }

  function openUploadPicker(dropped?: File[]) {
    setPickerFiles(dropped && dropped.length > 0 ? dropped : null);
    setPickerChoice(openFolderId ?? customFolders[0]?.id ?? '');
    setPickerNewName('');
    setPickerCreating(false);
    setPickerError(null);
    setPickerOpen(true);
  }

  // creates a folder from the picker and selects it straight away
  async function createPickerFolder() {
    if (!client) return;
    const name = pickerNewName.trim();
    if (!name) {
      setPickerError('Please give the folder a name.');
      return;
    }
    if (name.length > 40) {
      setPickerError('Keep the name under 40 characters.');
      return;
    }
    if (customFolders.some((cf) => cf.name.toLowerCase() === name.toLowerCase())) {
      setPickerError('You already have a folder with this name.');
      return;
    }
    setPickerSaving(true);
    setPickerError(null);
    const { data, error } = await supabase.from('client_folders').insert({ client_id: client.id, name }).select('id, name, created_at').single();
    setPickerSaving(false);
    if (error || !data) {
      setPickerError(foldersReady ? (error?.message ?? 'Could not create the folder.') : 'Folders are not set up yet. Please ask your project team to enable them.');
      return;
    }
    setCustomFolders((prev) => [...prev, data as CustomFolder]);
    setPickerChoice((data as CustomFolder).id);
    setPickerNewName('');
    setPickerCreating(false);
  }

  function confirmPicker() {
    const folderId = pickerChoice;
    if (!folderId || !customFolders.some((cf) => cf.id === folderId)) return;
    pendingFolderRef.current = folderId;
    setPickerOpen(false);
    if (pickerFiles) {
      const list = pickerFiles;
      setPickerFiles(null);
      void uploadFiles(list, folderId);
    } else {
      fileInputRef.current?.click();
    }
  }

  function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadFiles(list, pendingFolderRef.current);
  }

  // files and links are shown separately: links have their own card
  const files = useMemo(() => allRows.filter((x) => x.file_type !== 'link'), [allRows]);
  const linkRows = useMemo(() => allRows.filter((x) => x.file_type === 'link'), [allRows]);
  const visibleLinks = showAllLinks ? linkRows : linkRows.slice(0, 5);

  async function removeLink() {
    if (!linkToDelete) return;
    setDeletingLink(true);
    setDeleteLinkError(null);
    const { data, error } = await supabase.from('client_files').delete().eq('id', linkToDelete.id).eq('file_type', 'link').select('id');
    setDeletingLink(false);
    if (error) {
      setDeleteLinkError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      // nothing was deleted: the database rule that allows it has not been added yet
      setDeleteLinkError('This link could not be deleted. Please ask your project team to enable it.');
      return;
    }
    setLinkToDelete(null);
    setReloadKey((k) => k + 1);
  }

  async function copyLink(row: FileRow) {
    try {
      await navigator.clipboard.writeText(row.drive_url);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 1600);
    } catch {
      // clipboard not available: the Open button still works
    }
  }

  const kindOptions = useMemo(() => {
    const counts = new Map<Kind, number>();
    files.forEach((f) => counts.set(typeKind(f), (counts.get(typeKind(f)) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [files]);

  // where a file lives, for the small label on each row
  function folderOf(f: FileRow): string {
    if (f.folder_id) return customFolders.find((cf) => cf.id === f.folder_id)?.name ?? 'Folder';
    return CATEGORY_LABEL[f.category] ?? 'Other';
  }

  // custom folders first (always shown, even empty), then the built-in categories that actually have files
  const folders = useMemo<FolderTile[]>(() => {
    const tiles: FolderTile[] = [];
    customFolders.forEach((cf) => {
      const items = files.filter((x) => x.folder_id === cf.id);
      tiles.push({ id: `f:${cf.id}`, label: cf.name, count: items.length, latest: items[0] ?? null, custom: true });
    });
    CATEGORY_ORDER.forEach((cat) => {
      const items = files.filter((x) => !x.folder_id && x.category === cat);
      if (items.length > 0) tiles.push({ id: cat, label: CATEGORY_LABEL[cat] ?? cat, count: items.length, latest: items[0], custom: false });
    });
    return tiles;
  }, [files, customFolders]);
  const activeFolder = categoryFilter ? folders.find((x) => x.id === categoryFilter) ?? null : null;
  const openFolderId = categoryFilter && categoryFilter.startsWith('f:') ? categoryFilter.slice(2) : null;
  const visibleFolders = showAllFolders ? folders : folders.slice(0, 4);

  const filteredFiles = useMemo(() => {
    let list = files;
    if (categoryFilter) list = list.filter((f) => (f.folder_id ? `f:${f.folder_id}` : f.category) === categoryFilter);
    if (typeFilter !== 'all') list = list.filter((f) => typeKind(f) === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'recent') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortBy === 'oldest') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'size') sorted.sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
    return sorted;
  }, [files, categoryFilter, typeFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedFiles = filteredFiles.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function resetToPage1() {
    setPage(1);
  }

  if (loading) {
    return (
      <div className="client-portal files-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 60, marginBottom: 18 }} />
              <div className="skel" style={{ height: 400 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal files-root">
        <div className="files-bare-shell">
          <div className="files-state-card">
            <div className="files-state-title">Unable to load files</div>
            <p className="files-state-sub">Please try again.</p>
            <div className="files-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  const distinctTeamUploaders = new Set(files.filter((f) => f.uploaded_by === 'team' && f.uploaded_by_id).map((f) => f.uploaded_by_id)).size;
  const lastFile = files[0] ?? null;
  const teamFileCount = files.filter((x) => x.uploaded_by === 'team').length;
  const teamPct = files.length > 0 ? Math.round((teamFileCount / files.length) * 100) : 0;
  const biggest = [...files].sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0)).slice(0, 5);
  const biggestMax = Math.max(...biggest.map((x) => x.size_bytes ?? 0), 1);
  const sizeBars = biggest.length > 0 ? biggest.map((x) => (x.size_bytes ?? 0) / biggestMax) : [0, 0, 0, 0, 0];
  // uploads per day over the last 7 days
  const dayMs = 24 * 3600 * 1000;
  const nowMs = nowIso ? new Date(nowIso).getTime() : 0;
  const weekCounts = Array.from({ length: 7 }, (_, i) => files.filter((x) => nowMs > 0 && Math.floor((nowMs - new Date(x.created_at).getTime()) / dayMs) === 6 - i).length);
  const weekMax = Math.max(...weekCounts, 1);
  const weekBars = weekCounts.map((n) => n / weekMax);
  const teamAvatars = Array.from(new Set(files.filter((x) => x.uploaded_by === 'team' && x.uploaded_by_id).map((x) => x.uploaded_by_id as string))).slice(0, 3);

  return (
    <div className="client-portal files-root">
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div>
            <div className="cp-brand cp-brand-sidebar">
              <span className="cp-brand-art">
                <img src="/sidebar-logo.webp" alt="FLOW 53 - Innovate-Design-Elevate" className="cp-brand-logo-combined" />
              </span>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group">
              <Link href="/client/dashboard" className="nav-item">
                <Icon name="grid" /> Overview
              </Link>
              <Link href={`/client/project/${project.id}`} className="nav-item">
                <Icon name="folder" /> My Project
              </Link>
              <Link href={`/client/project/${project.id}/messages`} className="nav-item">
                <Icon name="message" /> Messages
              </Link>
              <Link href={`/client/project/${project.id}/files`} className="nav-item active">
                <Icon name="file" /> Files
              </Link>
              <Link href={`/client/project/${project.id}/sow`} className="nav-item">
                <Icon name="doc" /> SOW
              </Link>
              <Link href={`/client/project/${project.id}/payments`} className="nav-item">
                <Icon name="card" /> Payments
              </Link>
            </nav>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">Files</span>
                      <button type="button" className="topbar-avatar" aria-label="Sign out" onClick={() => { if (window.confirm('Sign out of your account?')) (handleSignOut)(); }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </button>
</header>

          <header className="page-topbar">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / Files
            </div>
            <a
              className="page-help-link"
              href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help with files${project ? ` for ${project.name}` : ''}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="help" size={13} /> Need help?
            </a>
          <button type="button" className="profile-card topbar-profile" onClick={handleSignOut} title="Sign out">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
              <div className="profile-role">{client.company_name}</div>
            </div>
          </button>
</header>

          <main className="content">
            <div className="dx">
              {/* ---- hero ---- */}
              <section
                className={`dx-hero${dragging ? ' ff-dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const dropped = Array.from(e.dataTransfer.files); if (dropped.length > 0) openUploadPicker(dropped); }}
              >
                <div className="dx-hero-text">
                  <h1 className="dx-title">Project files</h1>
                  <p className="dx-sub">Everything shared for your project in one place. View it, download it, or add your own.</p>
                  <div className="dx-hero-project">
                    <span className="dx-hero-project-name">{project.name}</span>
                  </div>
                  <div className="dx-hero-actions">
                    <input ref={fileInputRef} type="file" multiple hidden onChange={handleUpload} />
                    <button type="button" className="btn btn-ghost" onClick={() => { setLinkError(null); setLinkOpen(true); }}>
                      <Icon name="link" size={14} /> Add a link
                    </button>
                    <button type="button" className="btn btn-accent" onClick={() => openUploadPicker()} disabled={uploading}>
                      <Icon name="upload" size={14} /> {uploading ? (uploadInfo && uploadInfo.total > 1 ? `Uploading ${uploadInfo.index} of ${uploadInfo.total} · ${uploadProgress}%` : `Uploading ${uploadProgress}%`) : 'Upload files'}
                    </button>
                  </div>
                  {uploadError && <p className="ff-upload-error">{uploadError}</p>}
                </div>
                <div className="dx-hero-progress">
                  <FilesRing segments={folders.filter((fo) => fo.count > 0).map((fo, i) => ({ key: fo.id, label: fo.label, value: fo.count, color: FOLDER_COLORS[i % FOLDER_COLORS.length] }))} total={files.length} />
                  <ul className="ff-legend">
                    {folders.filter((fo) => fo.count > 0).slice(0, 4).map((fo, i) => (
                      <li key={fo.id}>
                        <span className="ff-legend-dot" style={{ background: FOLDER_COLORS[i % FOLDER_COLORS.length] }} />
                        <span className="ff-legend-label">{fo.label}</span>
                        <span className="ff-legend-leader" aria-hidden="true" />
                        <b>{fo.count}</b>
                      </li>
                    ))}
                    {folders.filter((fo) => fo.count > 0).length > 4 && <li className="ff-legend-more">+{folders.filter((fo) => fo.count > 0).length - 4} more</li>}
                    {folders.filter((fo) => fo.count > 0).length === 0 && <li className="ff-legend-more">No files yet</li>}
                  </ul>
                </div>
              </section>

              {/* ---- key numbers ---- */}
              <section className="dx-kpis">
                <a href="#all-files" className="dx-kpi">
                  <span className="dx-kpi-top">
                    <span className="dx-kpi-icon dx-tone-accent"><Icon name="folder" size={20} /></span>
                    <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    <span className="dx-kpi-mini" aria-hidden="true">
                      <MiniRing pct={teamPct} color="var(--accent)" />
                      <span className="dx-kpi-mini-num">{teamPct}%</span>
                    </span>
                  </span>
                  <span className="dx-kpi-label">Total files</span>
                  <strong className="dx-kpi-value">{files.length}</strong>
                  <span className="dx-kpi-sub">{folders.length} folder{folders.length === 1 ? '' : 's'} · {teamPct}% from the team</span>
                </a>
                <a href="#all-files" className="dx-kpi" onClick={() => { setSortBy('size'); resetToPage1(); }}>
                  <span className="dx-kpi-top">
                    <span className="dx-kpi-icon dx-tone-green"><Icon name="file" size={20} /></span>
                    <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    <span className="dx-kpi-mini" aria-hidden="true">
                      <MiniBars values={sizeBars} color="var(--positive)" />
                    </span>
                  </span>
                  <span className="dx-kpi-label">Total size</span>
                  <strong className="dx-kpi-value">{formatBytes(totalSize)}</strong>
                  <span className="dx-kpi-sub">Largest files first</span>
                </a>
                <a href="#all-files" className="dx-kpi">
                  <span className="dx-kpi-top">
                    <span className="dx-kpi-icon dx-tone-amber"><Icon name="users" size={20} /></span>
                    <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    <span className="dx-kpi-mini ff-avatars" aria-hidden="true">
                      {teamAvatars.length === 0 ? (
                        <span className="ff-avatar ff-avatar-empty">–</span>
                      ) : (
                        teamAvatars.map((id) => {
                          const u = uploaders[id];
                          return (
                            <span className="ff-avatar" key={id}>
                              {u?.avatar_url ? (
                                <AvatarImage src={u.avatar_url} name={u.full_name ?? 'F'} />
                              ) : (
                                (u?.full_name ?? 'F').charAt(0).toUpperCase()
                              )}
                            </span>
                          );
                        })
                      )}
                    </span>
                  </span>
                  <span className="dx-kpi-label">Shared by team</span>
                  <strong className="dx-kpi-value">{distinctTeamUploaders}</strong>
                  <span className="dx-kpi-sub">Team member{distinctTeamUploaders === 1 ? '' : 's'}</span>
                </a>
                <a
                  href="#all-files"
                  className="dx-kpi"
                  onClick={(e) => {
                    if (lastFile) {
                      e.preventDefault();
                      if (lastFile.file_type === 'link') window.open(lastFile.drive_url, '_blank', 'noopener,noreferrer');
                      else setPreviewItem({ name: lastFile.name, url: lastFile.drive_url, fileType: previewType(lastFile) });
                    }
                  }}
                >
                  <span className="dx-kpi-top">
                    <span className="dx-kpi-icon dx-tone-blue"><Icon name="clock" size={20} /></span>
                    <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    <span className="dx-kpi-mini" aria-hidden="true">
                      <MiniBars values={weekBars} color="#2f6fdb" />
                    </span>
                  </span>
                  <span className="dx-kpi-label">Last updated</span>
                  <strong className="dx-kpi-value">{lastFile && nowIso ? dayLabel(lastFile.created_at, nowIso) : '—'}</strong>
                  <span className="dx-kpi-sub ff-trunc">{lastFile ? `Open ${lastFile.name}` : 'No files yet'}</span>
                </a>
              </section>

              {/* ---- folders ---- */}
              <section className="dx-card">
                <div className="dx-card-head">
                  <h2 className="dx-card-title">Folders</h2>
                  <div className="ff-head-actions">
                    {folders.length > 4 && (
                      <button type="button" className="dx-link ff-link-btn" onClick={() => setShowAllFolders((v) => !v)}>
                        {showAllFolders ? 'Show less' : 'View all'}
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openFolderModal('new')}>
                      <Icon name="plus" size={13} /> New folder
                    </button>
                  </div>
                </div>
                {customFolders.length === 0 && <p className="dx-empty ff-folders-hint">Create folders to keep your files organised, for example &ldquo;Brand assets&rdquo; or &ldquo;Contracts&rdquo;.</p>}
                {folders.length > 0 && (
                  <div className="ff-folders">
                    {visibleFolders.map((f, idx) => {
                      const cf = f.custom ? customFolders.find((x) => `f:${x.id}` === f.id) : undefined;
                      return (
                        <div className="ff-folder-cell" key={f.id}>
                          <Link href={`/client/project/${project.id}/files/folders/${encodeURIComponent(f.custom ? f.id.slice(2) : f.id)}`} className="ff-folder">
                            <span className="dx-kpi-icon dx-tone-accent"><Icon name="folder" size={18} /></span>
                            <span className="ff-folder-dot" style={{ background: FOLDER_COLORS[idx % FOLDER_COLORS.length] }} />
                            <span className="ff-folder-body">
                              <span className="ff-folder-name">{f.label}</span>
                              <span className="ff-folder-meta">
                                {f.count} file{f.count === 1 ? '' : 's'}
                                {f.latest && nowIso ? ` · ${dayLabel(f.latest.created_at, nowIso)}` : ''}
                              </span>
                            </span>
                          </Link>
                          {cf && (
                            <span className="ff-folder-tools">
                              <button type="button" className="ff-tool" aria-label={`Rename ${f.label}`} onClick={() => openFolderModal('rename', cf)}>
                                <Icon name="edit" size={13} />
                              </button>
                              <button type="button" className="ff-tool" aria-label={`Delete ${f.label}`} onClick={() => openFolderModal('delete', cf)}>
                                <Icon name="trash" size={13} />
                              </button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ---- links ---- */}
              <section className="dx-card" id="links">
                <div className="dx-card-head">
                  <h2 className="dx-card-title">
                    Links <span className="ff-count">{linkRows.length}</span>
                  </h2>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLinkError(null); setLinkOpen(true); }}>
                    <Icon name="plus" size={13} /> Add a link
                  </button>
                </div>
                {linkRows.length === 0 ? (
                  <div className="ff-empty">
                    <span className="dx-kpi-icon dx-tone-accent"><Icon name="link" size={20} /></span>
                    <div className="ff-empty-title">No links yet</div>
                    <p className="ff-empty-sub">Figma files, Google Docs, websites, videos&hellip; save any link here and it stays with your project.</p>
                  </div>
                ) : (
                  <>
                    <ul className="ff-list">
                      {visibleLinks.map((l) => {
                        const uploader = l.uploaded_by_id ? uploaders[l.uploaded_by_id] : null;
                        const sharedBy = uploader?.full_name ?? (l.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team');
                        return (
                          <li className="ff-item" key={l.id}>
                            <span className="dx-row-icon"><Icon name="link" size={15} /></span>
                            <div className="ff-item-body">
                              <div className="ff-item-name">
                                <a href={l.drive_url} target="_blank" rel="noopener noreferrer" className="ff-item-name-text ff-link-name">{l.name}</a>
                                <span className="ff-name-who">{sharedBy} · {nowIso ? dayLabel(l.created_at, nowIso) : ''}</span>
                              </div>
                              <div className="ff-item-meta">
                                <span className="ff-meta-group">
                                  <span className="ff-ext">{domainOf(l.drive_url)}</span>
                                </span>
                                <span className="ff-meta-group">
                                  <span>{sharedBy}</span>
                                  <span>{nowIso ? dayLabel(l.created_at, nowIso) : ''}</span>
                                </span>
                              </div>
                            </div>
                            <div className={`ff-item-actions${menuId === l.id ? ' open' : ''}`}>
                              <button type="button" className="ff-more-btn" aria-label="More actions" aria-expanded={menuId === l.id} onClick={() => setMenuId((id) => (id === l.id ? null : l.id))}>
                                <Icon name="dots" size={16} />
                              </button>
                              <div className="ff-actions-pop" onClick={() => setMenuId(null)}>
                                <button type="button" className="ff-icon-btn" aria-label={`Copy link to ${l.name}`} title={copiedId === l.id ? 'Copied' : 'Copy link'} onClick={() => copyLink(l)}>
                                  <Icon name={copiedId === l.id ? 'check' : 'copy'} size={15} /><span className="ff-act-label">{copiedId === l.id ? 'Copied' : 'Copy link'}</span>
                                </button>
                                <a href={l.drive_url} target="_blank" rel="noopener noreferrer" className="ff-icon-btn" aria-label={`Open ${l.name}`} title="Open link">
                                  <Icon name="external" size={15} /><span className="ff-act-label">Open link</span>
                                </a>
                                {l.uploaded_by === 'client' && (
                                  <button type="button" className="ff-icon-btn ff-danger" aria-label={`Delete ${l.name}`} title="Delete link" onClick={() => { setDeleteLinkError(null); setLinkToDelete(l); }}>
                                    <Icon name="trash" size={15} /><span className="ff-act-label">Delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {linkRows.length > 5 && (
                      <button type="button" className="ff-more" onClick={() => setShowAllLinks((v) => !v)}>
                        {showAllLinks ? 'Show fewer links' : `Show all ${linkRows.length} links`}
                      </button>
                    )}
                  </>
                )}
              </section>

              {/* ---- files ---- */}
              <section className="dx-card ff-allfiles" id="all-files">
                <div className="ff-all-head">
                  <div className="ff-all-title">
                    <h2 className="dx-card-title">
                      All files <span className="ff-count">{filteredFiles.length}</span>
                    </h2>
                    {categoryFilter && (
                      <button type="button" className="ff-chip" onClick={() => setCategoryFilter(null)}>
                        {activeFolder?.label ?? CATEGORY_LABEL[categoryFilter] ?? 'Folder'} <Icon name="close" size={11} />
                      </button>
                    )}
                  </div>
                  <div className="ff-toggle">
                    <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="List view" title="List">
                      <Icon name="list" size={15} />
                    </button>
                    <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view" title="Grid">
                      <Icon name="grid2" size={15} />
                    </button>
                  </div>
                </div>

                <div className="ff-toolbar">
                  <label className={`ff-search${search ? ' has-value' : ''}`}>
                    <span className="ff-search-icon"><Icon name="search" size={16} /></span>
                    <input
                      ref={searchRef}
                      type="search"
                      placeholder="Search files by name"
                      value={search}
                      aria-label="Search files by name"
                      onChange={(e) => {
                        setSearch(e.target.value);
                        resetToPage1();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearch('');
                          resetToPage1();
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    {search ? (
                      <>
                        <span className="ff-search-count">{filteredFiles.length} result{filteredFiles.length === 1 ? '' : 's'}</span>
                        <button type="button" className="ff-search-clear" aria-label="Clear search" onClick={() => { setSearch(''); resetToPage1(); searchRef.current?.focus(); }}>
                          <Icon name="close" size={12} />
                        </button>
                      </>
                    ) : (
                      <kbd className="ff-kbd" aria-hidden="true">/</kbd>
                    )}
                  </label>
                  <ClientSelect className="ff-sort" ariaLabel="Sort files" value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)} options={[{ value: 'recent', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name (A–Z)' }, { value: 'size', label: 'Largest first' }]} />
                </div>

                {kindOptions.length > 1 && (
                  <div className="ff-kinds" role="tablist" aria-label="Filter by file type">
                    <button type="button" role="tab" aria-selected={typeFilter === 'all'} className={`ff-kind${typeFilter === 'all' ? ' active' : ''}`} onClick={() => { setTypeFilter('all'); resetToPage1(); }}>
                      All <span>{files.length}</span>
                    </button>
                    {kindOptions.map(([k, n]) => (
                      <button key={k} type="button" role="tab" aria-selected={typeFilter === k} className={`ff-kind${typeFilter === k ? ' active' : ''}`} onClick={() => { setTypeFilter(k); resetToPage1(); }}>
                        <i className={`ff-kind-dot ff-type-${k}`} />
                        {KIND_LABEL[k]} <span>{n}</span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredFiles.length === 0 ? (
                  <div className="ff-empty">
                    <span className="dx-kpi-icon dx-tone-accent"><Icon name="file" size={20} /></span>
                    <div className="ff-empty-title">{files.length === 0 ? 'No files yet' : 'No files found'}</div>
                    <p className="ff-empty-sub">{files.length === 0 ? 'Files shared with you will show up here. You can also upload your own.' : 'Try a different search, or clear the filters.'}</p>
                  </div>
                ) : viewMode === 'list' ? (
                  <ul className="ff-rows">
                    {pagedFiles.map((f) => {
                      const uploader = f.uploaded_by_id ? uploaders[f.uploaded_by_id] : null;
                      const isNew = nowIso ? new Date(nowIso).getTime() - new Date(f.created_at).getTime() < 24 * 3600 * 1000 : false;
                      const sharedBy = uploader?.full_name ?? (f.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team');
                      const kind = typeKind(f);
                      return (
                        <li className="ff-row" key={f.id}>
                          {kind === 'image' ? (
                            <FileThumb f={f} kind={kind} className="ff-thumb" />
                          ) : (
                            <span className={`ff-type ff-type-${kind}`}>{fileExtension(f.name).slice(0, 4)}</span>
                          )}
                          <div className="ff-row-main">
                            <div className="ff-item-name">
                              <span className="ff-item-name-text">{f.name}</span>
                              {isNew && <span className="ff-new">New</span>}
                              <span className="ff-name-who">{sharedBy} · {nowIso ? dayLabel(f.created_at, nowIso) : ''}</span>
                            </div>
                            <div className="ff-item-meta">
                              <span className="ff-meta-group">
                                <span className="ff-ext">{KIND_LABEL[kind]}</span>
                                <span>{formatBytes(f.size_bytes)}</span>
                              </span>
                              <span className="ff-meta-group">
                                <span>{sharedBy}</span>
                                <span>{nowIso ? dayLabel(f.created_at, nowIso) : ''}, {formatClockTime(f.created_at)}</span>
                              </span>
                            </div>
                          </div>
                          <span className="ff-where" title="Folder">
                            <Icon name="folder" size={12} /> {folderOf(f)}
                          </span>
                          <div className={`ff-item-actions${menuId === f.id ? ' open' : ''}`}>
                            <button type="button" className="ff-more-btn" aria-label="More actions" aria-expanded={menuId === f.id} onClick={() => setMenuId((id) => (id === f.id ? null : f.id))}>
                              <Icon name="dots" size={16} />
                            </button>
                            <div className="ff-actions-pop" onClick={() => setMenuId(null)}>
                              {customFolders.length > 0 && (
                                <button type="button" className="ff-icon-btn" aria-label={`Move ${f.name} to a folder`} title="Move to a folder" onClick={() => openFolderModal('move', undefined, f)}>
                                  <Icon name="move" size={15} /><span className="ff-act-label">Move</span>
                                </button>
                              )}
                              <button type="button" className="ff-icon-btn" aria-label={`View ${f.name}`} title="View" onClick={() => setPreviewItem({ name: f.name, url: f.drive_url, fileType: previewType(f) })}>
                                <Icon name="eye" size={15} /><span className="ff-act-label">View</span>
                              </button>
                              <a href={driveDownloadUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="ff-icon-btn" aria-label={`Download ${f.name}`} title="Download">
                                <Icon name="download" size={15} /><span className="ff-act-label">Download</span>
                              </a>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="ff-tiles">
                    {pagedFiles.map((f) => {
                      const kind = typeKind(f);
                      const uploader = f.uploaded_by_id ? uploaders[f.uploaded_by_id] : null;
                      return (
                        <button type="button" key={f.id} className="ff-tile" onClick={() => setPreviewItem({ name: f.name, url: f.drive_url, fileType: previewType(f) })}>
                          <span className="ff-tile-art">
                            {kind === 'image' ? (
                              <FileThumb f={f} kind={kind} className="ff-thumb-fill" />
                            ) : (
                              <span className={`ff-type ff-type-lg ff-type-${kind}`}>{fileExtension(f.name).slice(0, 4)}</span>
                            )}
                          </span>
                          <span className="ff-tile-name">{f.name}</span>
                          <span className="ff-tile-meta">{KIND_LABEL[kind]} · {formatBytes(f.size_bytes)}</span>
                          <span className="ff-tile-meta">{uploader?.full_name ?? (f.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredFiles.length > 0 && (
                  <div className="ff-pager">
                    <span className="ff-pager-info">
                      {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length} files
                    </span>
                    <div className="ff-pager-controls">
                      <button type="button" disabled={pageSafe === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                        <Icon name="chevronLeft" size={14} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .slice(0, 5)
                        .map((n) => (
                          <button key={n} type="button" className={pageSafe === n ? 'active' : ''} onClick={() => setPage(n)}>
                            {n}
                          </button>
                        ))}
                      {totalPages > 5 && <span className="ff-pager-dots">…</span>}
                      <button type="button" disabled={pageSafe === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                        <Icon name="chevronRight" size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
      <ClientBottomNav projectId={project.id} active="files" />

      {linkOpen && (
        <div className="ff-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setLinkOpen(false); }}>
          <form className="ff-modal" onSubmit={saveLink}>
            <div className="ff-modal-head">
              <span className="dx-kpi-icon dx-tone-accent"><Icon name="link" size={20} /></span>
              <div>
                <h2 className="ff-modal-title">Add a link</h2>
                <p className="ff-modal-sub">Figma, Google Docs, a website, a video … any link is saved with your project files.</p>
              </div>
              <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setLinkOpen(false)}>
                <Icon name="close" size={15} />
              </button>
            </div>
            <label className="ff-field">
              <span>Link</span>
              <input type="text" inputMode="url" autoFocus placeholder="https://" value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null); }} />
            </label>
            <label className="ff-field">
              <span>Name <em>(optional)</em></span>
              <input type="text" placeholder="e.g. Homepage design in Figma" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
            </label>
            <p className="ff-link-note"><Icon name="link" size={13} /> Saved in the <strong>Links</strong> card on this page.</p>
            {linkError && <p className="ff-upload-error">{linkError}</p>}
            <div className="ff-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setLinkOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent" disabled={savingLink || !linkUrl.trim()}>{savingLink ? 'Saving…' : 'Save link'}</button>
            </div>
          </form>
        </div>
      )}

      {menuId && <div className="ff-menu-backdrop" onClick={() => setMenuId(null)} />}

      {linkToDelete && (
        <div className="ff-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !deletingLink) setLinkToDelete(null); }}>
          <div className="ff-modal" role="dialog" aria-modal="true">
            <div className="ff-modal-head">
              <span className="dx-kpi-icon dx-tone-accent"><Icon name="trash" size={20} /></span>
              <div>
                <h2 className="ff-modal-title">Delete this link?</h2>
                <p className="ff-modal-sub ff-trunc">{linkToDelete.name}</p>
              </div>
            </div>
            <p className="ff-modal-sub">It will be removed from your project. The website itself is not affected.</p>
            {deleteLinkError && <p className="ff-upload-error">{deleteLinkError}</p>}
            <div className="ff-modal-actions">
              <button type="button" className="btn btn-ghost" disabled={deletingLink} onClick={() => setLinkToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-accent" disabled={deletingLink} onClick={removeLink}>{deletingLink ? 'Deleting…' : 'Delete link'}</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="ff-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPickerOpen(false); }}>
          <div className="ff-modal ff-picker" role="dialog" aria-modal="true" aria-labelledby="ff-picker-title">
            <div className="ff-picker-head">
              <div>
                <h2 className="ff-picker-title" id="ff-picker-title">
                  {customFolders.length === 0 ? 'Create your first folder' : pickerFiles ? `Choose a folder for ${pickerFiles.length} file${pickerFiles.length === 1 ? '' : 's'}` : 'Choose a folder'}
                </h2>
                <p className="ff-picker-sub">
                  {customFolders.length === 0 ? 'Your files are kept in folders, so start by naming one.' : 'Your files will be saved inside the folder you pick.'}
                </p>
              </div>
              <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setPickerOpen(false)}>
                <Icon name="close" size={15} />
              </button>
            </div>

            {customFolders.length > 0 && (
              <ul className="ff-pick-list" role="radiogroup" aria-label="Folders">
                {customFolders.map((cf) => {
                  const count = files.filter((x) => x.folder_id === cf.id).length;
                  const selected = pickerChoice === cf.id;
                  return (
                    <li key={cf.id}>
                      <button type="button" role="radio" aria-checked={selected} className={`ff-pick-item${selected ? ' selected' : ''}`} onClick={() => setPickerChoice(cf.id)}>
                        <span className="ff-pick-icon"><Icon name="folder" size={18} /></span>
                        <span className="ff-pick-body">
                          <span className="ff-pick-name">{cf.name}</span>
                          <span className="ff-pick-meta">{count} item{count === 1 ? '' : 's'}</span>
                        </span>
                        <span className="ff-pick-radio" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {customFolders.length === 0 || pickerCreating ? (
              <form
                className="ff-newfolder"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createPickerFolder();
                }}
              >
                <input type="text" maxLength={40} autoFocus placeholder="Folder name, e.g. Brand assets" value={pickerNewName} onChange={(e) => { setPickerNewName(e.target.value); setPickerError(null); }} aria-label="New folder name" />
                <button type="submit" className="btn btn-ghost btn-sm" disabled={pickerSaving || !pickerNewName.trim()}>
                  {pickerSaving ? 'Creating…' : 'Create'}
                </button>
                {customFolders.length > 0 && (
                  <button type="button" className="ff-text-btn" onClick={() => { setPickerCreating(false); setPickerError(null); }}>
                    Cancel
                  </button>
                )}
              </form>
            ) : (
              <button type="button" className="ff-newfolder-open" onClick={() => setPickerCreating(true)}>
                <Icon name="plus" size={15} /> New folder
              </button>
            )}
            {pickerError && <p className="ff-upload-error">{pickerError}</p>}

            <div className="ff-picker-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPickerOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-accent" disabled={!pickerChoice || !customFolders.some((cf) => cf.id === pickerChoice)} onClick={confirmPicker}>
                <Icon name="upload" size={14} /> {pickerFiles ? `Upload ${pickerFiles.length} file${pickerFiles.length === 1 ? '' : 's'}` : 'Choose files'}
              </button>
            </div>
          </div>
        </div>
      )}

      {folderModal && (
        <div className="ff-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setFolderModal(null); }}>
          {folderModal.mode === 'new' || folderModal.mode === 'rename' ? (
            <form className="ff-modal" onSubmit={saveFolder}>
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="folder" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">{folderModal.mode === 'new' ? 'New folder' : 'Rename folder'}</h2>
                  <p className="ff-modal-sub">{folderModal.mode === 'new' ? 'Give it a name you will recognise.' : 'The files inside stay where they are.'}</p>
                </div>
                <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setFolderModal(null)}>
                  <Icon name="close" size={15} />
                </button>
              </div>
              <label className="ff-field">
                <span>Folder name</span>
                <input type="text" autoFocus maxLength={40} placeholder="e.g. Brand assets" value={folderName} onChange={(e) => { setFolderName(e.target.value); setFolderError(null); }} />
              </label>
              {folderError && <p className="ff-upload-error">{folderError}</p>}
              <div className="ff-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setFolderModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={savingFolder || !folderName.trim()}>{savingFolder ? 'Saving…' : folderModal.mode === 'new' ? 'Create folder' : 'Save'}</button>
              </div>
            </form>
          ) : folderModal.mode === 'delete' && folderModal.folder ? (
            <div className="ff-modal">
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="trash" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">Delete &ldquo;{folderModal.folder.name}&rdquo;?</h2>
                  <p className="ff-modal-sub">Only the folder is removed. Its files and links are kept and go back to where they were before.</p>
                </div>
              </div>
              {folderError && <p className="ff-upload-error">{folderError}</p>}
              <div className="ff-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setFolderModal(null)}>Cancel</button>
                <button type="button" className="btn btn-accent" disabled={savingFolder} onClick={deleteFolder}>{savingFolder ? 'Deleting…' : 'Delete folder'}</button>
              </div>
            </div>
          ) : folderModal.mode === 'move' && folderModal.file ? (
            <div className="ff-modal">
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="move" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">Move to a folder</h2>
                  <p className="ff-modal-sub ff-trunc">{folderModal.file.name}</p>
                </div>
                <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setFolderModal(null)}>
                  <Icon name="close" size={15} />
                </button>
              </div>
              <div className="ff-move-list">
                {customFolders.map((cf) => (
                  <button key={cf.id} type="button" className={`ff-move-item${folderModal.file?.folder_id === cf.id ? ' current' : ''}`} disabled={savingFolder} onClick={() => folderModal.file && moveFile(folderModal.file, cf.id)}>
                    <Icon name="folder" size={16} /> <span>{cf.name}</span>
                  </button>
                ))}
                <button type="button" className={`ff-move-item${!folderModal.file.folder_id ? ' current' : ''}`} disabled={savingFolder} onClick={() => folderModal.file && moveFile(folderModal.file, null)}>
                  <Icon name="file" size={16} /> <span>No folder</span>
                </button>
              </div>
              {folderError && <p className="ff-upload-error">{folderError}</p>}
            </div>
          ) : null}
        </div>
      )}

      <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
