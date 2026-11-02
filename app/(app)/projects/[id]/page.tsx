'use client';

// Project Details — lib/supabaseClient.ts দিয়ে রিয়েল Supabase ডেটা:
// projects + clients + profiles (manager/assignee) + tasks + milestones +
// attachments + activity_log + meetings। RLS-এর জন্য sign-in লাগবে।
//
// নোট: schema-তে notes-এর জন্য কোনো টেবিল নেই — তাই ওই সেকশনটা honest
// empty-state দেখায়। Share/More বাটন এবং বেশিরভাগ Quick Actions এখনো
// প্লেসহোল্ডার (disabled)। Client Status আসল clients.status ফিল্ড দেখায় —
// schema-তে পেমেন্ট ট্র্যাকিং নেই বলে ফেক "পরিশোধিত" বসানো হয়নি। Star
// টগল লোকাল-অনলি (persist হয় না) — favorite কলাম যোগ করলে persist করা যাবে।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import './project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDate, formatTimeBn, todayISO } from '@/lib/format';
import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';
import { dueNextDays, statusCounts } from '@/lib/dashboardCharts';
import { currencySymbol } from '@/lib/currency';
import { sendNotifications } from '@/lib/notify';
import { getProjectCurrency } from '@/lib/projectCurrency';
import RichTextField from '@/app/components/RichTextField';
import RichText from '@/app/components/RichText';
import { useAppShell } from '@/app/components/appShellContext';
import ChangeManagerModal from '@/app/components/ChangeManagerModal';
import ClientAvatar from '@/app/components/ClientAvatar';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';

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
  chevrons: '<path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  tick: '<path d="M20 6L9 17l-5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  'check-circle-o': '<circle cx="12" cy="12" r="9"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.9 1.4 7-6.2-3.6-6.2 3.6 1.4-7L2 9.3l7-.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9"/><path d="M8.6 13.4l6.8 3.9"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  figma: '<path d="M9 2h6a4 4 0 0 1 0 8H9z"/><path d="M9 10h6a4 4 0 0 1 0 8 4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  'cal-plus': '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>',
  'cal-clock': '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/>',
  'dollar-circle': '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  'bell-ring': '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/>',
  'cal-x': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>',
  alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  'ws-sow': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'ws-pay': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  'ws-msg': '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  'ws-feedback': '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  'ws-approve': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  'ws-change': '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
  'ws-update': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'ws-files': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  'chart-pie': '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
  milestone: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.636l-3.424-2.317A2 2 0 0 0 17 6z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  'users-round': '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'f-file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  'f-image': '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'f-zip': '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  'f-sheet': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  'f-video': '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  'f-audio': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'f-slides': '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  'files-stack': '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  note: '<path d="M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h4"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}



const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
  on_hold: { label: 'হোল্ডে', cls: 's-todo' },
  draft: { label: 'Draft', cls: 's-todo' },
};

const CLIENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  lead: { label: 'Lead', cls: 's-todo' },
  discussion: { label: 'In Discussion', cls: 's-review' },
  active: { label: 'Active', cls: 's-progress' },
  retainer: { label: 'Retainer', cls: 's-done' },
  completed: { label: 'Completed', cls: 's-done' },
};

const FILE_TYPE_ICON: Record<string, { icon: IconName; bg: string; color: string }> = {
  figma: { icon: 'figma', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  image: { icon: 'f-image', bg: 'var(--warning-soft)', color: 'var(--warning)' },
  pdf: { icon: 'ws-sow', bg: 'var(--danger-soft)', color: 'var(--danger)' },
  zip: { icon: 'f-zip', bg: 'var(--positive-soft)', color: 'var(--positive)' },
  doc: { icon: 'ws-sow', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  sheet: { icon: 'f-sheet', bg: 'var(--positive-soft)', color: 'var(--positive)' },
  slides: { icon: 'f-slides', bg: 'var(--warning-soft)', color: 'var(--warning)' },
  video: { icon: 'f-video', bg: 'var(--danger-soft)', color: 'var(--danger)' },
  audio: { icon: 'f-audio', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  text: { icon: 'ws-sow', bg: 'var(--surface-muted)', color: 'var(--ink-soft)' },
  link: { icon: 'link', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  other: { icon: 'f-file', bg: 'var(--surface-muted)', color: 'var(--ink-soft)' },
};

// "5 min ago", "2 days ago" for the file rows
function agoEn(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} ${day === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

type ProjectNote = { id: string; body: string; pinned: boolean; created_at: string; updated_at: string | null; author_id: string | null; profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null };
// the icon and colour for an activity event, from its action name
function activityLook(action: string | null | undefined): { icon: IconName; tone: 'positive' | 'danger' | 'accent' | 'info' } {
  const a = (action ?? '').toLowerCase();
  if (/delet|cancel|remov|declin/.test(a)) return { icon: 'close', tone: 'danger' };
  if (/creat|add|new/.test(a)) return { icon: 'plus', tone: 'positive' };
  if (/complet|done|sign|approv|paid|receiv/.test(a)) return { icon: 'check-circle', tone: 'positive' };
  if (/comment|message|reply|discuss/.test(a)) return { icon: 'message', tone: 'info' };
  if (/file|upload|attach/.test(a)) return { icon: 'upload', tone: 'info' };
  return { icon: 'pencil', tone: 'accent' };
}
function activityGroupOf(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}
type ProjectFileRow = { id: string; name: string; file_type: string | null; drive_url: string; created_at: string; uploaded_by: string; hidden_from_client: boolean };

type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  budget: number | null;
  start_date: string | null;
  due_date: string | null;
  description: string | null;
  category: string | null;
  final_delivery_status: string | null;
  final_delivery_notes: string | null;
  completed_at: string | null;
  clients: {
    id: string;
    company_name: string;
    industry: string | null;
    primary_contact: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
  } | null;
  project_manager_id: string | null;
  manager: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
};

type ProjectTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  workflow_stage: string;
  due_date: string | null;
  progress: number | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  updated_at: string;
  assignee_id: string | null;
  profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null; role: string | null } | null;
};

type ProjectAttachment = { id: string; file_name: string; file_type: string | null; drive_url: string; uploaded_at: string; profiles: { full_name: string } | null };
type ProjectActivity = { id: string; action?: string | null; detail: string | null; created_at: string; profiles: { full_name: string } | null };
type NextMeeting = { id: string; title: string; meeting_date: string; meeting_time: string | null };
type TeamEntry = { id: string; name: string; role: string | null; avatar_color: string | null; avatar_url: string | null; activeTasks: number };
type Milestone = { id: string; title: string; due_date: string | null; completed_at: string | null; progress: number | null };

function daysFromNowISO(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function fetchProjectData(projectId: string) {
  const today = todayISO();

  const [projectRes, tasksRes, milestonesRes] = await Promise.all([
    supabase
      .from('projects')
      .select(
        'id, name, status, progress, budget, start_date, due_date, description, category, final_delivery_status, final_delivery_notes, completed_at, project_manager_id, clients(id, company_name, industry, primary_contact, contact_email, contact_phone, status), manager:profiles!project_manager_id(full_name, avatar_color, avatar_url)'
      )
      .eq('id', projectId)
      .single(),
    supabase
      .from('tasks')
      .select(
        'id, title, status, priority, workflow_stage, due_date, progress, estimated_hours, logged_hours, updated_at, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url, role)'
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('milestones')
      .select('id, title, due_date, completed_at, progress')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .order('due_date', { ascending: true }),
  ]);

  const project = (projectRes.data as unknown as ProjectDetail) ?? null;
  const tasks = (tasksRes.data as unknown as ProjectTask[]) ?? [];
  const taskIds = tasks.map((t) => t.id);
  const clientId = project?.clients?.id ?? null;

  const [attachmentsRes, activityRes, meetingRes] = await Promise.all([
    taskIds.length > 0
      ? supabase
          .from('attachments')
          .select('id, file_name, file_type, drive_url, uploaded_at, profiles(full_name)')
          .in('task_id', taskIds)
          .order('uploaded_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length > 0
      ? supabase
          .from('activity_log')
          .select('id, action, detail, created_at, profiles(full_name)')
          .eq('entity_type', 'task')
          .in('entity_id', taskIds)
          .order('created_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    clientId
      ? supabase
          .from('meetings')
          .select('id, title, meeting_date, meeting_time')
          .eq('client_id', clientId)
          .gte('meeting_date', today)
          .order('meeting_date', { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstErrored = [projectRes, tasksRes, milestonesRes, attachmentsRes, activityRes, meetingRes].find((r) => r.error);

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    project,
    tasks,
    milestones: (milestonesRes.data as unknown as Milestone[]) ?? [],
    attachments: (attachmentsRes.data as unknown as ProjectAttachment[]) ?? [],
    activity: (activityRes.data as unknown as ProjectActivity[]) ?? [],
    nextMeeting: ((meetingRes.data as unknown as NextMeeting[]) ?? [])[0] ?? null,
  };
}

// whole days from `fromISO` to `toISO` (both yyyy-mm-dd); negative = already past
function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

// every project tool that has its own sub-page; shown as tiles in the Workspace card
const WORKSPACE_TOOLS: { label: string; href: string; icon: IconName }[] = [
  { label: 'SOW', href: 'sow', icon: 'ws-sow' },
  { label: 'Payments', href: 'payments', icon: 'ws-pay' },
  { label: 'Messages', href: 'messages', icon: 'ws-msg' },
  { label: 'Feedback', href: 'feedback', icon: 'ws-feedback' },
  { label: 'Approvals', href: 'approvals', icon: 'ws-approve' },
  { label: 'Change Requests', href: 'change-requests', icon: 'ws-change' },
  { label: 'Updates', href: 'updates', icon: 'ws-update' },
  { label: 'Client Files', href: 'files', icon: 'ws-files' },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, loading: sessionLoading } = useSession();

  const { dark } = useAppShell();
  const [profile, setProfile] = useState<{ id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null } | null>(null);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  // the client's photo (copied from their Google account when they sign in); fetched on its own so a missing column never breaks the page
  const [clientAvatar, setClientAvatar] = useState<string | null>(null);
  const [clientCountry, setClientCountry] = useState<string | null>(null);
  // files shared on this project (client_files), plus a quick uploader for the Files card
  const [projectFiles, setProjectFiles] = useState<ProjectFileRow[]>([]);
  const [fileUpload, setFileUpload] = useState<{ index: number; total: number; pct: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileView, setFileViewState] = useState<'list' | 'cards'>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('pd-file-view') === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });
  const setFileView = (v: 'list' | 'cards') => {
    setFileViewState(v);
    try {
      window.localStorage.setItem('pd-file-view', v);
    } catch {
      // the choice just is not remembered
    }
  };
  const [filesTick, setFilesTick] = useState(0);
  const [filePage, setFilePage] = useState(0);

  // ---- notes: private to the team, saved in the project_notes table ----
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [notesReady, setNotesReady] = useState(true);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const NOTE_SELECT = 'id, body, pinned, created_at, updated_at, author_id, profiles(full_name, avatar_color, avatar_url)';
  useEffect(() => {
    if (!projectId || !user) return;
    let off = false;
    supabase
      .from('project_notes')
      .select(NOTE_SELECT)
      .eq('project_id', projectId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (off) return;
        setNotesLoaded(true);
        if (error) {
          setNotesReady(false);
          return;
        }
        setNotesReady(true);
        setNotes((data as unknown as ProjectNote[]) ?? []);
      });
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!off) setIsAdminUser(!!(data as { is_admin?: boolean } | null)?.is_admin);
      });
    return () => {
      off = true;
    };
  }, [projectId, user]);

  async function addNote() {
    const body = noteText.trim();
    if (!body || !user || !projectId) return;
    setNoteBusy(true);
    setNoteError(null);
    const { data, error } = await supabase.from('project_notes').insert({ project_id: projectId, author_id: user.id, body }).select(NOTE_SELECT).single();
    setNoteBusy(false);
    if (error) {
      setNoteError(error.message);
      return;
    }
    setNotes((prev) => [data as unknown as ProjectNote, ...prev].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)));
    setNoteText('');
  }
  async function saveNoteEdit(id: string) {
    const body = editText.trim();
    if (!body) return;
    setNoteBusy(true);
    setNoteError(null);
    const stamp = new Date().toISOString();
    const { error } = await supabase.from('project_notes').update({ body, updated_at: stamp }).eq('id', id);
    setNoteBusy(false);
    if (error) {
      setNoteError(error.message);
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body, updated_at: stamp } : n)));
    setEditingNote(null);
  }
  async function toggleNotePin(n: ProjectNote) {
    setNoteError(null);
    const { error } = await supabase.from('project_notes').update({ pinned: !n.pinned }).eq('id', n.id);
    if (error) {
      setNoteError(error.message);
      return;
    }
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, pinned: !n.pinned } : x)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)));
  }
  async function deleteNote(id: string) {
    if (!window.confirm('Delete this note?')) return;
    setNoteError(null);
    const { error } = await supabase.from('project_notes').delete().eq('id', id);
    if (error) {
      setNoteError(error.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  const [allAttachments, setAllAttachments] = useState<ProjectAttachment[] | null>(null);
  const taskIdsKey = tasks.map((t) => t.id).join(',');
  useEffect(() => {
    if (!taskIdsKey) return;
    let off = false;
    supabase
      .from('attachments')
      .select('id, file_name, file_type, drive_url, uploaded_at, profiles(full_name)')
      .in('task_id', taskIdsKey.split(','))
      .order('uploaded_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!off && !error) setAllAttachments((data as unknown as ProjectAttachment[]) ?? []);
      });
    return () => {
      off = true;
    };
  }, [taskIdsKey]);
  useEffect(() => {
    if (!projectId) return;
    let off = false;
    supabase
      .from('client_files')
      .select('id, name, file_type, drive_url, created_at, uploaded_by, hidden_from_client')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!off && !error) setProjectFiles((data as ProjectFileRow[]) ?? []);
      });
    return () => {
      off = true;
    };
  }, [projectId, filesTick]);

  async function handleQuickUpload(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    if (picked.length === 0 || !project?.clients?.id || !user) {
      if (picked.length > 0 && !project?.clients?.id) setFileError('This project has no client yet, so files cannot be added.');
      return;
    }
    setFileError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setFileError('Your session has expired. Please sign in again.');
      return;
    }
    const failed: string[] = [];
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      setFileUpload({ index: i + 1, total: picked.length, pct: 0 });
      try {
        const result = await uploadFileToDrive(file, accessToken, (pct) => setFileUpload({ index: i + 1, total: picked.length, pct }));
        const { error: insertError } = await supabase.from('client_files').insert({
          client_id: project.clients.id,
          project_id: project.id,
          name: file.name,
          file_type: guessFileType(file),
          size_bytes: file.size,
          drive_url: result.webViewLink,
          category: 'other',
          uploaded_by: 'team',
          uploaded_by_id: user.id,
          hidden_from_client: true,
        });
        if (insertError) throw new Error(insertError.message);
      } catch (err) {
        failed.push(`${file.name}${err instanceof Error && err.message ? ` (${err.message})` : ''}`);
      }
    }
    setFileUpload(null);
    if (failed.length > 0) setFileError(`Could not upload: ${failed.join(', ')}`);
    setFilePage(0);
    setFilesTick((n) => n + 1);
  }
  const clientIdForAvatar = project?.clients?.id ?? null;
  useEffect(() => {
    if (!clientIdForAvatar) return;
    let off = false;
    supabase
      .from('clients')
      .select('avatar_url')
      .eq('id', clientIdForAvatar)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!off && !error) setClientAvatar((data as { avatar_url: string | null } | null)?.avatar_url ?? null);
      });
    supabase
      .from('clients')
      .select('country')
      .eq('id', clientIdForAvatar)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!off && !error) setClientCountry((data as { country: string | null } | null)?.country ?? null);
      });
    return () => {
      off = true;
    };
  }, [clientIdForAvatar]);
  const [currency, setCurrency] = useState('BDT');
  useEffect(() => {
    if (projectId) getProjectCurrency(projectId).then(setCurrency);
  }, [projectId]);
  const [taskScope, setTaskScope] = useState<'all' | 'mine'>('all');

  // "Assign task" modal: a new task for this project, handed straight to a team member
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url: string | null }[]>([]);
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tAssignee, setTAssignee] = useState<string | null>(null);
  const [tPriority, setTPriority] = useState<TaskPriority>('normal');
  const [tDue, setTDue] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchProjectData(projectId),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setProject(result.project);
      setTasks(result.tasks);
      setMilestones(result.milestones);
      setAttachments(result.attachments);
      setActivity(result.activity);
      setNextMeeting(result.nextMeeting);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    }

    run();
  }, [user, projectId]);

  async function openTaskModal(assigneeId: string | null = null) {
    setTTitle('');
    setTDescription('');
    setTAssignee(assigneeId);
    setTPriority('normal');
    setTDue('');
    setTaskFormError(null);
    setShowTaskModal(true);
    if (members.length === 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url').order('full_name');
      setMembers((data as typeof members) ?? []);
    }
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!tTitle.trim() || !tAssignee || !user) return;

    setCreatingTask(true);
    setTaskFormError(null);
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: tTitle.trim(),
        description: tDescription.trim() || null,
        project_id: projectId,
        assignee_id: tAssignee,
        priority: tPriority,
        due_date: tDue || null,
        assigned_date: todayISO(),
        status: 'todo',
        workflow_stage: 'backlog',
        created_by: user.id,
      })
      .select('id, title, status, priority, workflow_stage, due_date, progress, estimated_hours, logged_hours, updated_at, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url, role)')
      .single();

    if (insertError || !data) {
      setTaskFormError(insertError?.message ?? 'Could not create the task.');
      setCreatingTask(false);
      return;
    }

    const row = data as unknown as ProjectTask;
    setTasks((prev) => [row, ...prev]);
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: row.id,
      detail: `"${row.title}" তৈরি করা হয়েছে`,
    });
    if (tAssignee) {
      sendNotifications([
        {
          recipient_id: tAssignee,
          actor_id: user.id,
          type: 'task_assigned',
          title: `${profile?.full_name?.trim() || user.email || 'কেউ একজন'} আপনাকে একটা টাস্ক অ্যাসাইন করেছে`,
          subtitle: row.title,
          link: '/tasks',
        },
      ]);
    }
    setCreatingTask(false);
    setShowTaskModal(false);
  }

  async function handleCreateMilestone(e: FormEvent) {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;

    setCreatingMilestone(true);
    const { data, error } = await supabase
      .from('milestones')
      .insert({ project_id: projectId, title: newMilestoneTitle.trim(), due_date: newMilestoneDueDate || null, progress: 0 })
      .select('id, title, due_date, completed_at, progress')
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      setMilestones((prev) => [...prev, data as Milestone]);
    }

    setNewMilestoneTitle('');
    setNewMilestoneDueDate('');
    setCreatingMilestone(false);
    setShowMilestoneModal(false);
  }

  async function toggleMilestone(m: Milestone) {
    const isDone = !!m.completed_at;
    const patch = isDone ? { completed_at: null, progress: m.progress ?? 0 } : { completed_at: todayISO(), progress: 100 };

    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('milestones').update(patch).eq('id', m.id);
    if (error) setError(error.message);
  }

  // Screen 23/24 — Final Delivery ও Project Completion। ভারী নতুন পেজের বদলে এই
  // বিদ্যমান প্রজেক্ট ডিটেইল পেজেই ছোট দুইটা অ্যাকশন — client-facing ফুল স্ক্রিন
  // /client/project/[id]/final-delivery ও /complete-এ।
  async function markReadyForDelivery() {
    if (!project) return;
    const { error } = await supabase.from('projects').update({ final_delivery_status: 'ready' }).eq('id', project.id);
    if (error) {
      setError(error.message);
      return;
    }
    setProject((prev) => (prev ? { ...prev, final_delivery_status: 'ready' } : prev));
  }

  async function closeProject() {
    if (!project) return;
    const { error } = await supabase.from('projects').update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() }).eq('id', project.id);
    if (error) {
      setError(error.message);
      return;
    }
    setProject((prev) => (prev ? { ...prev, status: 'completed', progress: 100, completed_at: new Date().toISOString() } : prev));
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const doneTaskCount = tasks.filter((t) => t.status === 'done').length;
  const computedProgress = tasks.length > 0 ? Math.round((doneTaskCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className={`projdetail-root${dark ? ' dark' : ''}`}>
        <div style={{ padding: 60, textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={`projdetail-root${dark ? ' dark' : ''}`}>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>{error ?? 'এই প্রজেক্ট পাওয়া যায়নি।'}</p>
          <Link href="/projects" className="btn btn-accent btn-sm" style={{ display: 'inline-flex' }}>প্রজেক্ট লিস্টে ফিরে যান</Link>
        </div>
      </div>
    );
  }

  const today = todayISO();
  const sevenDaysFromNow = daysFromNowISO(7);

  const completed = tasks.filter((t) => t.status === 'done').length;
  const remaining = tasks.length - completed;
  const overdue = tasks.filter((t) => !!t.due_date && t.due_date < today && t.status !== 'done').length;
  const upcoming = tasks.filter((t) => !!t.due_date && t.due_date >= today && t.due_date <= sevenDaysFromNow && t.status !== 'done').length;
  const revisionCount = tasks.filter((t) => t.workflow_stage === 'revision').length;

  const estimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const workedHours = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

  const teamMap = new Map<string, TeamEntry>();
  for (const t of tasks) {
    if (!t.assignee_id || !t.profiles) continue;
    const cur = teamMap.get(t.assignee_id);
    const isActive = t.status !== 'done' ? 1 : 0;
    if (cur) cur.activeTasks += isActive;
    else teamMap.set(t.assignee_id, { id: t.assignee_id, name: t.profiles.full_name, role: t.profiles.role, avatar_color: t.profiles.avatar_color, avatar_url: t.profiles.avatar_url, activeTasks: isActive });
  }
  const team = Array.from(teamMap.values()).sort((a, b) => b.activeTasks - a.activeTasks);

  // the signed-in team member's own tasks (for the All / Mine switch)
  const myTasks = tasks.filter((t) => !!profile && t.assignee_id === profile.id);
  const shownTasks = taskScope === 'mine' ? myTasks : tasks;

  // days-left badge next to the due date (hidden once the project is completed)
  const daysLeft = project.due_date && project.status !== 'completed' ? daysBetween(today, project.due_date) : null;
  const deadlineChip =
    daysLeft === null
      ? null
      : daysLeft < 0
        ? { text: `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} overdue`, tone: 'danger' }
        : daysLeft === 0
          ? { text: 'Due today', tone: 'warn' }
          : { text: `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`, tone: daysLeft <= 7 ? 'warn' : 'ok' };
  let schedule: { label: string; tone: 'ok' | 'warn' | 'danger' } | null = null;
  if (project.status === 'completed') {
    schedule = { label: 'Completed', tone: 'ok' };
  } else if (project.start_date && project.due_date) {
    const span = daysBetween(project.start_date, project.due_date);
    if (span > 0) {
      const elapsed = Math.min(Math.max(daysBetween(project.start_date, today), 0), span);
      const diff = computedProgress - Math.round((elapsed / span) * 100);
      schedule = diff >= 5 ? { label: 'Ahead of schedule', tone: 'ok' } : diff >= -10 ? { label: 'On track', tone: 'ok' } : { label: 'Behind schedule', tone: diff < -30 ? 'danger' : 'warn' };
    }
  }
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  // worked vs estimated hours (bar is capped at 100%)
  const hoursPercent = estimatedHours > 0 ? Math.min(100, Math.round((workedHours / estimatedHours) * 100)) : 0;

  const workspaceTools = WORKSPACE_TOOLS;

  const statusMeta = PROJECT_STATUS_META[project.status] ?? { label: project.status, cls: 's-todo' };
  const clientStatusMeta = project.clients ? CLIENT_STATUS_META[project.clients.status] ?? { label: project.clients.status, cls: 's-todo' } : null;

  return (
    <>
      <main className="content">
            <div className="pd-topbar">
              <div className="pd-topbar-text">
                <span className="pd-topbar-title">Project Details</span>
                <span className="pd-topbar-sub">Everything about <b>{project.name}</b> in one place</span>
              </div>
              <Link href="/projects" className="pd-back">
                <span className="pd-back-icon"><Icon name="back" size={14} /></span>
                Back to projects
              </Link>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* ===== hero: identity + key facts + progress ===== */}
            {project.status === 'draft' && project.clients && (
              <div className="pd-draft-banner">
                <div>
                  <b>This project is a saved draft.</b> It is hidden from the client until you finish creating it.
                </div>
                <Link href={`/clients/${project.clients.id}/create-project?draft=${project.id}`} className="btn btn-accent btn-sm">
                  <Icon name="edit" size={12} /> Continue editing
                </Link>
              </div>
            )}

            {showManagerModal && user && (
              <ChangeManagerModal
                projectId={project.id}
                projectName={project.name}
                clientId={project.clients?.id ?? null}
                currentManagerId={project.project_manager_id}
                actorId={user.id}
                dark={dark}
                onClose={() => setShowManagerModal(false)}
                onSaved={(m) => setProject((prev) => (prev ? { ...prev, project_manager_id: m.id, manager: { full_name: m.full_name, avatar_color: m.avatar_color, avatar_url: m.avatar_url } } : prev))}
              />
            )}

            <section className={`pdh st-${project.status}`}>
              <div className="pdh-left">
                <div className="pdh-id">
                  <div className="pdh-icon">{project.name.charAt(0).toUpperCase()}</div>
                  <div className="pdh-titles">
                    <div className="pdh-title-row">
                      <h1 className="pdh-title">{project.name}</h1>
                      <span className="pdh-status"><i />{statusMeta.label}</span>
                    </div>
                    <div className="pdh-chips">
                      {project.category && <span className="pdh-chip">{project.category}</span>}
                      {project.clients && <span className="pdh-chip"><Icon name="building" size={13} />{project.clients.company_name}</span>}
                      <span className="pdh-chip">
                        {project.manager ? <Avatar person={project.manager} size={18} /> : <Icon name="users" size={13} />}
                        PM: {project.manager ? project.manager.full_name : 'Not assigned'}
                        <button type="button" className="pd-pm-change" onClick={() => setShowManagerModal(true)}>Change</button>
                      </span>
                    </div>
                  </div>
                  <div className="header-actions">
                    <button
                      className={`icon-btn star-btn${starred ? ' active' : ''}`}
                      onClick={() => setStarred((s) => !s)}
                      aria-label="Favourite"
                      title="Local toggle, not saved"
                    >
                      <Icon name="star" />
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled title="Coming soon"><Icon name="share" size={14} /> Share</button>
                    <button className="icon-btn" disabled title="Coming soon" aria-label="More options"><Icon name="more" /></button>
                  </div>
                </div>

                {project.description && <RichText text={project.description} className="pdh-desc" />}

                <div className="pdt" role="table" aria-label="Project dates, budget and hours">
                  <div className="pdt-col" role="rowgroup">
                    <div className="pdt-head" role="columnheader"><span className="pdt-icon"><Icon name="cal-plus" size={15} /></span>Start</div>
                    <div className="pdt-cell" role="cell"><span className="pdt-value">{fmtDate(project.start_date)}</span></div>
                  </div>
                  <div className="pdt-col" role="rowgroup">
                    <div className="pdt-head" role="columnheader"><span className="pdt-icon"><Icon name="cal-clock" size={15} /></span>Due</div>
                    <div className="pdt-cell" role="cell">
                      <span className="pdt-value">{fmtDate(project.due_date)}</span>
                      {deadlineChip && <span className={`pd-days ${deadlineChip.tone}`}>{deadlineChip.text}</span>}
                    </div>
                  </div>
                  <div className="pdt-col" role="rowgroup">
                    <div className="pdt-head" role="columnheader"><span className="pdt-icon"><Icon name="dollar-circle" size={15} /></span>Budget</div>
                    <div className="pdt-cell" role="cell"><span className="pdt-value tabular">{project.budget ? `${currencySymbol(currency)} ${project.budget.toLocaleString('en-US')}` : '—'}</span></div>
                  </div>
                  <div className="pdt-col" role="rowgroup">
                    <div className="pdt-head" role="columnheader"><span className="pdt-icon"><Icon name="gauge" size={15} /></span>Hours</div>
                    <div className="pdt-cell" role="cell">
                      <span className="pdt-value tabular">{workedHours}h <i>of {estimatedHours}h</i></span>
                      <div className="pd-hours-meter" aria-label={`${hoursPercent}% of estimated hours`}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <span key={i} className={`${hoursPercent >= (i + 1) * 10 - 4 ? 'on' : ''}${workedHours > estimatedHours && estimatedHours > 0 ? ' over' : ''}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="pdh-side">
                <div className="pd-dial">
                  <svg viewBox="0 0 140 140" role="img" aria-label={`${computedProgress}% complete`}>
                    <defs>
                      <linearGradient id="pd-dial-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="#2189d9" />
                      </linearGradient>
                    </defs>
                    <circle cx="70" cy="70" r="46" fill="none" stroke="var(--border)" strokeWidth="1" />
                    <circle cx="70" cy="70" r="40" fill="none" stroke="var(--border-soft)" strokeWidth="1" strokeDasharray="2 4" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke="var(--border-soft)" strokeWidth="14" />
                    {computedProgress > 0 && (
                      <circle
                        cx="70" cy="70" r="58" fill="none" stroke="url(#pd-dial-grad)" strokeWidth="14" strokeLinecap="round"
                        strokeDasharray="364.42" strokeDashoffset={364.42 - (364.42 * computedProgress) / 100}
                        transform="rotate(-90 70 70)"
                      />
                    )}
                  </svg>
                  <div className="pd-dial-center">
                    <b className="tabular">{computedProgress}%</b>
                    <span>complete</span>
                  </div>
                </div>
                <span className="pd-progress-caption"><b className="tabular">{completed}</b> of {tasks.length} tasks done</span>
                {schedule && <span className={`pdh-schedule ${schedule.tone}`}><i />{schedule.label}</span>}
              </aside>
            </section>

            {/* ===== needs attention ===== */}
            <div className={`pd-attn-row${project.clients ? " has-client" : ""}`}>
              {(() => {
                const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
                const items: { tone: 'danger' | 'warn' | 'accent' | 'info'; icon: IconName; title: string; text: string; href: string }[] = [];
                if (overdue > 0) items.push({ tone: 'danger', icon: 'cal-x', title: 'Overdue tasks', text: `${plural(overdue, 'task has', 'tasks have')} missed the deadline. Review ${overdue === 1 ? 'it' : 'them'} first.`, href: '#recent-tasks' });
                if (revisionCount > 0) items.push({ tone: 'warn', icon: 'refresh', title: 'In revision', text: `${plural(revisionCount, 'task is', 'tasks are')} waiting on requested changes.`, href: '#recent-tasks' });
                if (upcoming > 0) items.push({ tone: 'accent', icon: 'alarm', title: 'Due soon', text: `${plural(upcoming, 'task is', 'tasks are')} due in the next 7 days.`, href: '#recent-tasks' });
                if (nextMeeting) items.push({ tone: 'info', icon: 'calendar', title: 'Next meeting', text: `${new Date(nextMeeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}${nextMeeting.meeting_time ? ` at ${formatTimeBn(nextMeeting.meeting_time)}` : ''}.`, href: '#activity' });
                const allClear = overdue === 0 && revisionCount === 0 && upcoming === 0;
                return (
                  <section className={`pdi${allClear ? ' clear' : ''}`} role="status" aria-label="Needs attention">
                    <div className="pdi-head">
                      <span className="pdi-badge"><Icon name={allClear ? 'check-circle' : 'bell-ring'} size={16} /></span>
                      <div className="pdi-head-text">
                        <div className="pdi-title">Needs attention</div>
                        <div className="pdi-sub">{allClear ? 'Nothing urgent right now' : 'Based on this project\'s live tasks'}</div>
                      </div>
                      <span className="pdi-count tabular">{allClear ? 0 : items.length}</span>
                    </div>
                    <div className="pdi-list">
                      {allClear && (
                        <div className="pdi-item tone-ok">
                          <span className="pdi-icon"><Icon name="check-circle" size={17} /></span>
                          <span className="pdi-body">
                            <span className="pdi-item-title">All on track</span>
                            <span className="pdi-item-text">No overdue tasks, revisions or deadlines in the next 7 days.</span>
                          </span>
                        </div>
                      )}
                      {items.map((it) => (
                        <a href={it.href} className={`pdi-item tone-${it.tone}`} key={it.title}>
                          <span className="pdi-icon"><Icon name={it.icon} size={17} /></span>
                          <span className="pdi-body">
                            <span className="pdi-item-title">{it.title}</span>
                            <span className="pdi-item-text">{it.text}</span>
                          </span>
                          <span className="pdi-go" aria-hidden="true"><Icon name="chevron-right" size={14} /></span>
                        </a>
                      ))}
                    </div>
                  </section>
                );
              })()}
              {/* Workspace: every project tool, one click away */}
              <section className="pdw pd-workspace">
                <div className="pdw-head">
                  <span className="pdw-badge"><Icon name="layers" size={16} /></span>
                  <div className="pdw-head-text">
                    <div className="pdw-title">Workspace</div>
                    <div className="pdw-sub">Project tools, one click away</div>
                  </div>
                </div>
                <div className="pdw-grid">
                  {workspaceTools.map((tool) => (
                    <Link key={tool.href} href={`/projects/${project.id}/${tool.href}`} className="pdw-tool">
                      <span className="pdw-top">
                        <span className="pdw-icon"><Icon name={tool.icon} size={17} /></span>
                        <span className="pdw-go" aria-hidden="true"><Icon name="back" size={12} /></span>
                      </span>
                      <span className="pdw-label">{tool.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
              {/* Client Info */}
              {project.clients && (
                <section className="pdc pd-client" id="client">
                  <div className="pdc-head">
                    <div className="pdc-logo"><ClientAvatar src={clientAvatar} name={project.clients.company_name} /></div>
                    <div className="pdc-id">
                      <div className="pdc-name">{project.clients.company_name}</div>
                      <div className="pdc-industry">{project.clients.industry ?? 'Client'}</div>
                    </div>
                    {clientStatusMeta && <span className="pdc-status"><i />{clientStatusMeta.label}</span>}
                  </div>
                  <div className="pdc-list">
                    <div className="pdc-row">
                      <span className="pdc-icon"><Icon name="users" size={15} /></span>
                      <span className="pdc-text">
                        <span className="pdc-label">Contact person</span>
                        <span className="pdc-value">{project.clients.primary_contact ?? '—'}</span>
                      </span>
                    </div>
                    <div className="pdc-row">
                      <span className="pdc-icon"><Icon name="phone" size={15} /></span>
                      <span className="pdc-text">
                        <span className="pdc-label">Phone</span>
                        {project.clients.contact_phone ? (
                          <a className="pdc-value tabular" href={`tel:${project.clients.contact_phone}`}>{project.clients.contact_phone}</a>
                        ) : (
                          <span className="pdc-value muted">—</span>
                        )}
                      </span>
                    </div>
                    <div className="pdc-row">
                      <span className="pdc-icon"><Icon name="map-pin" size={15} /></span>
                      <span className="pdc-text">
                        <span className="pdc-label">Location</span>
                        {clientCountry ? <span className="pdc-value">{clientCountry}</span> : <span className="pdc-value muted">Not provided</span>}
                      </span>
                    </div>
                    <div className="pdc-row">
                      <span className="pdc-icon"><Icon name="calendar" size={15} /></span>
                      <span className="pdc-text">
                        <span className="pdc-label">Next meeting</span>
                        {nextMeeting ? (
                          <span className="pdc-value">{new Date(nextMeeting.meeting_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}{nextMeeting.meeting_time ? `, ${formatTimeBn(nextMeeting.meeting_time)}` : ''}</span>
                        ) : (
                          <span className="pdc-value muted">Not scheduled</span>
                        )}
                      </span>
                    </div>
                    <div className="pdc-row">
                      <span className="pdc-icon"><Icon name="mail" size={15} /></span>
                      <span className="pdc-text">
                        <span className="pdc-label">Email</span>
                        {project.clients.contact_email ? (
                          <a className="pdc-value" href={`mailto:${project.clients.contact_email}`}>{project.clients.contact_email}</a>
                        ) : (
                          <span className="pdc-value muted">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ===== jump bar (this page's own sections; the project tools live in the Workspace card) ===== */}
            <nav className="pd-jump" aria-label="পেজ সেকশন">
              <a href="#recent-tasks">Tasks</a>
              <a href="#milestones">Milestones</a>
              <a href="#files">Files</a>
              <a href="#activity">Activity</a>
              <a href="#team">Team</a>
              <a href="#client">Client</a>
              <a href="#final-delivery">Delivery</a>
            </nav>

            <div className="pd-layout">
              {/* ---------- main column ---------- */}
              <div className="pd-main">
                <div className="pdv">
                  {[
                    { tone: 'green', icon: 'check-circle', value: completed, label: 'Completed' },
                    { tone: 'grey', icon: 'checklist', value: remaining, label: 'Remaining' },
                    { tone: 'red', icon: 'cal-x', value: overdue, label: 'Overdue' },
                    { tone: 'amber', icon: 'alarm', value: upcoming, label: 'Due in 7 days' },
                    { tone: 'blue', icon: 'square-pen', value: revisionCount, label: 'Revisions' },
                  ].map((k) => {
                    const share = tasks.length > 0 ? Math.round((k.value / tasks.length) * 100) : 0;
                    return (
                      <div className={`pdv-card tone-${k.tone}`} key={k.label}>
                        <div className="pdv-top">
                          <span className="pdv-icon"><Icon name={k.icon as IconName} size={16} /></span>
                          <span className="pdv-label">{k.label}</span>
                        </div>
                        <div className="pdv-main">
                          <span className="pdv-value tabular">{k.value}</span>
                          <span className="pdv-ring" aria-hidden="true">
                            <svg viewBox="0 0 40 40">
                              <circle cx="20" cy="20" r="16" fill="none" stroke="color-mix(in srgb, var(--t) 14%, var(--surface))" strokeWidth="4" />
                              {share > 0 && (
                                <circle cx="20" cy="20" r="16" fill="none" stroke="var(--t)" strokeWidth="4" strokeLinecap="round" strokeDasharray="100.53" strokeDashoffset={100.53 - (share / 100) * 100.53} transform="rotate(-90 20 20)" />
                              )}
                            </svg>
                            <span>{share}%</span>
                          </span>
                        </div>
                        <div className="pdv-foot">{k.value === 0 ? 'None right now' : `${share}% of all tasks`}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress at a glance: how this project's tasks split by status, and what falls due in the next 7 days */}
                {(() => {
                  const segs = statusCounts(tasks);
                  const total = segs.reduce((n, x) => n + x.count, 0);
                  const CX = 110;
                  const R = 56;
                  const SW = 16;
                  const C = 2 * Math.PI * R;
                  const GAP = 5;
                  const shown = segs.filter((x) => x.count > 0);
                  const arcs = shown.map((x, i) => {
                    const acc = (shown.slice(0, i).reduce((n, y) => n + y.count, 0) / total) * C;
                    const len = (x.count / total) * C;
                    const dash = shown.length > 1 ? Math.max(len - SW - GAP, 0.1) : C;
                    const mid = ((acc + len / 2) / C) * 2 * Math.PI - Math.PI / 2;
                    const arc = {
                      ...x,
                      dash,
                      off: acc + (shown.length > 1 ? (SW + GAP) / 2 : 0),
                      pct: Math.round((x.count / total) * 100),
                      lx1: CX + Math.cos(mid) * (R + SW / 2 + 3),
                      ly1: CX + Math.sin(mid) * (R + SW / 2 + 3),
                      lx2: CX + Math.cos(mid) * (R + SW / 2 + 10),
                      ly2: CX + Math.sin(mid) * (R + SW / 2 + 10),
                      tx: CX + Math.cos(mid) * (R + SW / 2 + 14),
                      ty: CX + Math.sin(mid) * (R + SW / 2 + 14),
                      right: Math.cos(mid) >= 0,
                    };
                    return arc;
                  });
                  const due = dueNextDays(tasks, todayISO());
                  const dueTotal = due.buckets.reduce((n, x) => n + x.tasks, 0);
                  const maxDue = Math.max(1, ...due.buckets.map((x) => x.tasks));
                  return (
                    <section className="pdg" id="progress">
                      <div className="pdg-head">
                        <span className="pdg-badge"><Icon name="chart-pie" size={16} /></span>
                        <div className="pdg-head-text">
                          <div className="pdg-title">Progress at a glance</div>
                          <div className="pdg-sub">How the tasks split by status, and what is due next</div>
                        </div>
                      </div>
                      <div className="pdg-grid">
                        <div className="pdg-panel">
                          <div className="pdg-panel-head">
                            <span className="pdg-panel-title">Tasks by status</span>
                            <span className="pdg-panel-sub">{total} {total === 1 ? 'task' : 'tasks'} in total</span>
                          </div>
                          {total === 0 ? (
                            <p className="pdg-empty">No tasks yet. They will appear here once some are created.</p>
                          ) : (
                            <>
                              <div className="pdg-donut">
                                <svg viewBox="0 0 220 220" role="img" aria-label="Tasks by status">
                                  <circle cx={CX} cy={CX} r={R - SW / 2 - 8} fill="none" stroke="var(--border)" strokeWidth={1} />
                                  <circle cx={CX} cy={CX} r={R - SW / 2 - 14} fill="none" stroke="var(--border-soft)" strokeWidth={1} strokeDasharray="2 4" />
                                  <circle cx={CX} cy={CX} r={R} fill="none" stroke="var(--border-soft)" strokeWidth={SW} />
                                  <g transform={`rotate(-90 ${CX} ${CX})`}>
                                    {arcs.map((x) => (
                                      <circle key={x.key} cx={CX} cy={CX} r={R} fill="none" stroke={x.color} strokeWidth={SW} strokeLinecap={shown.length > 1 ? 'round' : 'butt'} strokeDasharray={`${x.dash} ${C - x.dash}`} strokeDashoffset={-x.off}>
                                        <title>{`${x.label}: ${x.count}`}</title>
                                      </circle>
                                    ))}
                                  </g>
                                  {arcs.map((x) => (
                                    <g key={`l-${x.key}`}>
                                      <line x1={x.lx1} y1={x.ly1} x2={x.lx2} y2={x.ly2} stroke="var(--ink-faint)" strokeWidth={1} />
                                      <text x={x.tx + (x.right ? 3 : -3)} y={x.ty} textAnchor={x.right ? 'start' : 'end'} dominantBaseline="middle" className="pdg-pct-label">{x.pct}%</text>
                                    </g>
                                  ))}
                                </svg>
                                <div className="pdg-donut-center">
                                  <span>Total</span>
                                  <b className="tabular">{total}</b>
                                </div>
                              </div>
                              <ul className="pdg-legend">
                                {segs.map((x) => (
                                  <li key={x.key} className={x.count === 0 ? 'is-zero' : undefined}>
                                    <i style={{ background: x.color }} />
                                    <span className="pdg-legend-label">{x.label}</span>
                                    <span className="pdg-leader" aria-hidden="true" />
                                    <b className="tabular">{x.count}</b>
                                    <span className="pdg-legend-pct tabular">{Math.round((x.count / total) * 100)}%</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>

                        <div className="pdg-panel">
                          <div className="pdg-panel-head">
                            <span className="pdg-panel-title">Due in the next 7 days</span>
                            <span className="pdg-panel-sub">{dueTotal} open {dueTotal === 1 ? 'task' : 'tasks'}</span>
                          </div>
                          <div className="pdg-bars" role="img" aria-label="Open tasks due per day">
                            {due.buckets.map((x) => (
                              <div className={`pdg-col${x.overdue ? ' late' : ''}${x.tasks === 0 ? ' zero' : ''}`} key={x.key} title={`${x.label}: ${x.tasks}`}>
                                <span className="pdg-track">
                                  <span className="pdg-fill" style={{ ['--r' as string]: x.tasks === 0 ? 0 : Math.max(0.1, x.tasks / maxDue) }}>
                                    <span className="pdg-val tabular">{x.tasks}</span>
                                  </span>
                                </span>
                                <span className="pdg-x">{x.label}</span>
                              </div>
                            ))}
                          </div>
                          {due.later > 0 && <div className="pdg-note">{due.later} more with no date or due later</div>}
                        </div>
                      </div>
                    </section>
                  );
                })()}

                {/* Tasks */}
                <section className="pd-card pdk" id="recent-tasks">
                  <div className="pdk-head">
                    <span className="pdk-badge"><Icon name="checklist" size={16} /></span>
                    <div className="pdk-title-wrap">
                      <div className="pdk-title">Tasks <span className="pdk-count tabular">{shownTasks.length}</span></div>
                      <div className="pdk-sub">{taskScope === 'mine' ? 'Assigned to you in this project' : 'Everything assigned in this project'}</div>
                    </div>
                    <div className="pdk-tools">
                      <div className="pd-seg" role="group" aria-label="Task filter">
                        <button type="button" className={taskScope === 'all' ? 'active' : ''} onClick={() => setTaskScope('all')}>All</button>
                        <button type="button" className={taskScope === 'mine' ? 'active' : ''} onClick={() => setTaskScope('mine')}>Mine · {myTasks.length}</button>
                      </div>
                      <button type="button" className="btn btn-accent btn-sm" onClick={() => openTaskModal()}><Icon name="plus" size={13} /> Assign task</button>
                    </div>
                  </div>
                  {shownTasks.length === 0 ? (
                    <div className="pdk-empty">
                      <span className="pdk-empty-icon"><Icon name="check" size={18} /></span>
                      <strong>{taskScope === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}</strong>
                      <span>{taskScope === 'mine' ? 'Nothing in this project is assigned to you.' : 'Assign the first task to get this project moving.'}</span>
                    </div>
                  ) : (
                    <>
                      <div className="pd-table-wrap">
                        <table className="pdk-table">
                          <thead><tr><th>Task</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Progress</th></tr></thead>
                          <tbody>
                            {shownTasks.slice(0, 8).map((t) => {
                              const status = STATUS_META[t.status];
                              const priority = PRIORITY_META[t.priority];
                              const isOverdue = !!t.due_date && t.due_date < today && t.status !== 'done';
                              const pct = t.status === 'done' ? 100 : Math.min(100, t.progress ?? 0);
                              return (
                                <tr key={t.id}>
                                  <td>
                                    <div className="pdk-task">
                                      <span className={`pdk-check${t.status === 'done' ? ' done' : ''}`}><Icon name="tick" size={11} /></span>
                                      <span className={`pdk-task-title${t.status === 'done' ? ' done' : ''}`}>{t.title}</span>
                                    </div>
                                  </td>
                                  <td>
                                    {t.profiles ? (
                                      <div className="pdk-person">
                                        <Avatar person={t.profiles} size={24} />
                                        <span>{t.profiles.full_name}</span>
                                      </div>
                                    ) : (
                                      <span className="pdk-muted">Unassigned</span>
                                    )}
                                  </td>
                                  <td><span className={`priority-pill ${priority.cls}`}>{priority.label}</span></td>
                                  <td><span className={`status-pill ${status.cls}`}>{status.label}</span></td>
                                  <td>
                                    <span className={`pdk-date tabular${isOverdue ? ' late' : ''}`}>{t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'}</span>
                                    {isOverdue && <span className="pdk-late-note">Overdue</span>}
                                  </td>
                                  <td>
                                    <div className="pdk-ring" aria-label={`${pct}% complete`}>
                                      <svg viewBox="0 0 40 40">
                                        <defs>
                                          <linearGradient id="pdk-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" />
                                            <stop offset="100%" stopColor="#2189d9" />
                                          </linearGradient>
                                        </defs>
                                        <circle cx="20" cy="20" r="11" fill="none" stroke="var(--border)" strokeWidth="0.7" />
                                        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--border-soft)" strokeWidth="4" />
                                        {pct > 0 && (
                                          <circle cx="20" cy="20" r="16" fill="none" stroke={t.status === 'done' ? 'var(--positive)' : 'url(#pdk-ring-grad)'} strokeWidth="4" strokeLinecap="round" strokeDasharray="100.53" strokeDashoffset={100.53 - (pct / 100) * 100.53} transform="rotate(-90 20 20)" />
                                        )}
                                      </svg>
                                      <span className="tabular">{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="pdk-foot">
                        <span>Showing <b className="tabular">{Math.min(8, shownTasks.length)}</b> of <b className="tabular">{shownTasks.length}</b> tasks</span>
                        <Link className="pdk-all" href="/tasks">View all tasks <span className="pdk-all-go"><Icon name="chevron-right" size={13} /></span></Link>
                      </div>
                    </>
                  )}
                </section>

                {/* Files */}
                {(() => {
                  const items = [
                    ...projectFiles.map((x) => ({ id: `c-${x.id}`, name: x.name, type: x.file_type ?? 'other', url: x.drive_url, when: x.created_at, tag: x.hidden_from_client ? 'Private' : 'Shared', by: x.uploaded_by === 'client' ? 'Client' : 'Team' })),
                    ...(allAttachments ?? attachments).map((x) => ({ id: `a-${x.id}`, name: x.file_name, type: x.file_type ?? 'other', url: x.drive_url, when: x.uploaded_at, tag: 'Task', by: x.profiles?.full_name ?? 'Team' })),
                  ].sort((p, q) => q.when.localeCompare(p.when));
                  const PAGE_SIZE = 6;
                  const total = items.length;
                  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
                  const page = Math.min(filePage, pages - 1);
                  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
                  return (
                    <section className="pdf" id="files">
                      <div className="pdf-head">
                        <span className="pdf-badge"><Icon name="files-stack" size={16} /></span>
                        <div className="pdf-head-text">
                          <div className="pdf-title">Files <span className="pdf-count tabular">{total}</span></div>
                          <div className="pdf-sub">Latest files and links on this project</div>
                        </div>
                        <div className="pdf-tools">
                          <div className="pdf-view" role="group" aria-label="File view">
                            <button type="button" className={fileView === 'list' ? 'active' : ''} onClick={() => setFileView('list')} aria-pressed={fileView === 'list'} title="List view" aria-label="List view"><Icon name="menu" size={14} /></button>
                            <button type="button" className={fileView === 'cards' ? 'active' : ''} onClick={() => setFileView('cards')} aria-pressed={fileView === 'cards'} title="Card view" aria-label="Card view"><Icon name="grid" size={14} /></button>
                          </div>
                          <label className={`btn btn-accent btn-sm pdf-upload${fileUpload ? ' busy' : ''}`}>
                            <Icon name="upload" size={13} /> {fileUpload ? `Uploading ${fileUpload.index}/${fileUpload.total}` : 'Upload'}
                            <input type="file" multiple disabled={!!fileUpload} onChange={(e) => { void handleQuickUpload(e.target.files); e.target.value = ''; }} />
                          </label>
                          <Link className="pdf-all" href={`/projects/${project.id}/files`}>Manage <span className="pdf-all-go"><Icon name="chevron-right" size={13} /></span></Link>
                        </div>
                      </div>
                      {fileUpload && (
                        <div className="pdf-progress" role="status">
                          <span>Uploading file {fileUpload.index} of {fileUpload.total}</span>
                          <b className="tabular">{fileUpload.pct}%</b>
                        </div>
                      )}
                      {fileError && <div className="pdf-error" role="alert">{fileError}</div>}
                      {total === 0 ? (
                        <div className="pdf-empty">
                          <span className="pdf-empty-icon"><Icon name="upload" size={18} /></span>
                          <strong>No files yet</strong>
                          <span>Upload a file here, or open Manage to add links and share with the client.</span>
                        </div>
                      ) : (
                        <ul className={`pdf-list${fileView === 'cards' ? ' cards' : ''}`}>
                          {pageItems.map((x) => {
                            const meta = FILE_TYPE_ICON[x.type] ?? FILE_TYPE_ICON.other;
                            const dot = x.name.lastIndexOf('.');
                            const ext = x.type === 'link' ? 'LINK' : dot > 0 && x.name.length - dot <= 6 ? x.name.slice(dot + 1).toUpperCase() : x.type.toUpperCase();
                            return (
                              <li key={x.id}>
                                <a className="pdf-row" href={x.url} target="_blank" rel="noopener noreferrer">
                                  <span className="pdf-icon" style={{ background: meta.bg, color: meta.color }}>
                                    <Icon name={meta.icon} size={17} />
                                    {x.type === 'image' && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img className="pdf-thumb" src={driveThumbnailUrl(x.url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    )}
                                    <span className="pdf-ext">{ext}</span>
                                  </span>
                                  <span className="pdf-info">
                                    <span className="pdf-name">{x.name}</span>
                                    <span className="pdf-meta">{x.by} · {agoEn(x.when)}</span>
                                  </span>
                                  <span className={`pdf-tag tag-${x.tag.toLowerCase()}`}>{x.tag}</span>
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {total > PAGE_SIZE && (
                        <nav className="pdf-pager" aria-label="Files pages">
                          <span className="pdf-pager-info">Showing <b className="tabular">{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)}</b> of <b className="tabular">{total}</b></span>
                          <div className="pdf-pager-controls">
                            <button type="button" className="pdf-pg" disabled={page === 0} onClick={() => setFilePage(page - 1)} aria-label="Previous page"><Icon name="back" size={13} /></button>
                            {Array.from({ length: pages }, (_, i) => i)
                              .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 1)
                              .map((i, idx, arr) => (
                                <span className="pdf-pg-wrap" key={i}>
                                  {idx > 0 && i - arr[idx - 1] > 1 && <span className="pdf-pg-gap">…</span>}
                                  <button type="button" className={`pdf-pg num${i === page ? ' active' : ''}`} onClick={() => setFilePage(i)} aria-current={i === page ? 'page' : undefined}>{i + 1}</button>
                                </span>
                              ))}
                            <button type="button" className="pdf-pg next" disabled={page >= pages - 1} onClick={() => setFilePage(page + 1)} aria-label="Next page"><Icon name="back" size={13} /></button>
                          </div>
                        </nav>
                      )}
                    </section>
                  );
                })()}


              </div>

              {/* ---------- side column ---------- */}
              <aside className="pd-side">
                {/* Milestones */}
                <section className="pdm" id="milestones">
                  <div className="pdm-head">
                    <span className="pdm-badge"><Icon name="milestone" size={16} /></span>
                    <div className="pdm-head-text">
                      <div className="pdm-title">Milestones <span className="pdm-count tabular">{milestones.length}</span></div>
                      <div className="pdm-sub">{milestones.length === 0 ? 'Break the project into key stages' : `${milestones.filter((m) => !!m.completed_at).length} of ${milestones.length} done`}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneModal(true)}><Icon name="plus" size={13} /> Add milestone</button>
                  </div>
                  {milestones.length === 0 ? (
                    <div className="pdm-empty">
                      <span className="pdm-empty-icon"><Icon name="milestone" size={18} /></span>
                      <strong>No milestones yet</strong>
                      <span>Add the first one to track the main stages of this project.</span>
                    </div>
                  ) : (
                    <ol className="pdm-list">
                      {milestones.map((m, i) => {
                        const isDone = !!m.completed_at;
                        const pct = isDone ? 100 : Math.min(100, m.progress ?? 0);
                        const left = m.due_date && !isDone ? daysBetween(today, m.due_date) : null;
                        const late = left !== null && left < 0;
                        return (
                          <li className={`pdm-item${isDone ? ' done' : ''}${late ? ' late' : ''}`} key={m.id}>
                            <button type="button" className="pdm-node" onClick={() => toggleMilestone(m)} aria-label={isDone ? 'Mark as not done' : 'Mark as done'} title={isDone ? 'Mark as not done' : 'Mark as done'}>
                              {isDone ? <Icon name="tick" size={13} /> : <span className="tabular">{i + 1}</span>}
                            </button>
                            <div className="pdm-card">
                              <div className="pdm-info">
                                <div className="pdm-name">{m.title}</div>
                                <div className="pdm-meta">
                                  <Icon name="calendar" size={13} />
                                  {isDone
                                    ? `Completed ${new Date(m.completed_at as string).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                    : `Due ${m.due_date ? new Date(m.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not set'}`}
                                  {left !== null && (
                                    <span className={`pdm-chip ${late ? 'danger' : left <= 7 ? 'warn' : 'ok'}`}>
                                      {late ? `${Math.abs(left)} ${Math.abs(left) === 1 ? 'day' : 'days'} overdue` : left === 0 ? 'Due today' : `${left} ${left === 1 ? 'day' : 'days'} left`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="pdm-ring" aria-label={`${pct}% complete`}>
                                <svg viewBox="0 0 40 40">
                                  <circle cx="20" cy="20" r="16" fill="none" stroke="var(--border-soft)" strokeWidth="4" />
                                  {pct > 0 && (
                                    <circle cx="20" cy="20" r="16" fill="none" stroke={isDone ? 'var(--positive)' : late ? 'var(--danger)' : 'var(--accent)'} strokeWidth="4" strokeLinecap="round" strokeDasharray="100.53" strokeDashoffset={100.53 - (pct / 100) * 100.53} transform="rotate(-90 20 20)" />
                                  )}
                                </svg>
                                <span className="tabular">{pct}%</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                {/* Team */}
                <section className="pdt2" id="team">
                  <div className="pdt2-head">
                    <span className="pdt2-badge"><Icon name="users-round" size={16} /></span>
                    <div className="pdt2-head-text">
                      <div className="pdt2-title">Team <span className="pdt2-count tabular">{team.length}</span></div>
                      <div className="pdt2-sub">People working on this project</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTaskModal()}><Icon name="plus" size={13} /> Assign task</button>
                  </div>
                  {team.length === 0 ? (
                    <div className="pdt2-empty">
                      <span className="pdt2-empty-icon"><Icon name="users-round" size={18} /></span>
                      <strong>No one yet</strong>
                      <span>Assign a task to add someone to the team.</span>
                    </div>
                  ) : (
                    <ul className="pdt2-list">
                      {team.map((m) => {
                        const percent = Math.min(100, (m.activeTasks / 5) * 100);
                        const tone = percent >= 90 ? 'full' : percent >= 50 ? 'busy' : 'free';
                        const toneLabel = tone === 'full' ? 'Full load' : tone === 'busy' ? 'Busy' : 'Available';
                        return (
                          <li className={`pdt2-row tone-${tone}`} key={m.id}>
                            <Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={40} />
                            <div className="pdt2-info">
                              <div className="pdt2-name">{m.name}</div>
                              <div className="pdt2-role">{m.role ?? 'Team member'}</div>
                              <div className="pdt2-load"><i />{toneLabel}<span className="tabular">· {m.activeTasks} open {m.activeTasks === 1 ? 'task' : 'tasks'}</span></div>
                            </div>
                            <button type="button" className="pdt2-add" onClick={() => openTaskModal(m.id)} title={`Assign a task to ${m.name}`} aria-label={`Assign a task to ${m.name}`}><Icon name="plus" size={14} /></button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Final Delivery / Completion */}
                <section className="pd-card" id="final-delivery">
                  <div className="pd-card-head"><span className="pd-card-title">Final Delivery &amp; Completion</span></div>
                  <div className="pd-card-body">
                    {project.status === 'completed' ? (
                      <p style={{ fontSize: 13, color: 'var(--positive)', fontWeight: 600 }}>✓ Project completed{project.completed_at ? ` — ${formatBnDate(project.completed_at)}` : ''}</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
                          Status: <strong>{project.final_delivery_status === 'ready' ? 'Ready for client review' : project.final_delivery_status === 'approved' ? 'Approved by client ✓' : project.final_delivery_status === 'changes_requested' ? 'Client requested changes' : 'Not started'}</strong>
                        </p>
                        {project.final_delivery_notes && project.final_delivery_status === 'changes_requested' && (
                          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>&quot;{project.final_delivery_notes}&quot;</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!project.final_delivery_status || project.final_delivery_status === 'changes_requested' ? (
                            <button className="btn btn-accent btn-sm" onClick={markReadyForDelivery}>
                              Mark Ready for Final Review
                            </button>
                          ) : null}
                          {project.final_delivery_status === 'approved' && (
                            <button className="btn btn-accent btn-sm" onClick={closeProject}>
                              Close Project
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Quick Actions */}
                <section className="pd-card">
                  <div className="pd-card-head"><span className="pd-card-title">Quick Actions</span></div>
                  <div className="qa-grid">
                    <button type="button" className="qa-btn" onClick={() => openTaskModal()}><div className="qa-icon"><Icon name="plus" size={14} /></div><span className="qa-label">টাস্ক তৈরি</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="upload" size={14} /></div><span className="qa-label">ফাইল আপলোড</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="user-plus" size={14} /></div><span className="qa-label">মেম্বার ইনভাইট</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="check-circle" size={14} /></div><span className="qa-label">রিভিউ শুরু</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="share" size={14} /></div><span className="qa-label">প্রজেক্ট শেয়ার</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="bar" size={14} /></div><span className="qa-label">রিপোর্ট বানান</span></button>
                  </div>
                </section>

              </aside>
            </div>

            {/* Recent Activity and Notes sit side by side, one row under the main grid */}
            <div className="pd-pair">
              {/* Recent Activity */}
              <section className="pda2" id="activity">
                <div className="pda2-head">
                  <span className="pda2-badge"><Icon name="activity" size={16} /></span>
                  <div className="pda2-head-text">
                    <div className="pda2-title">Recent Activity <span className="pda2-count tabular">{activity.length}</span></div>
                    <div className="pda2-sub">What changed on this project&apos;s tasks</div>
                  </div>
                </div>
                {activity.length === 0 ? (
                  <div className="pda2-empty">
                    <span className="pda2-empty-icon"><Icon name="activity" size={18} /></span>
                    <strong>No activity yet</strong>
                    <span>Updates to tasks will show up here.</span>
                  </div>
                ) : (
                  <div className="pda2-body">
                    {(['Today', 'Yesterday', 'Earlier'] as const).map((group) => {
                      const rows = activity.filter((a) => activityGroupOf(a.created_at) === group);
                      if (rows.length === 0) return null;
                      return (
                        <div className="pda2-group" key={group}>
                          <div className="pda2-group-label">{group}</div>
                          <ul className="pda2-list">
                            {rows.map((a) => {
                              const look = activityLook(a.action);
                              return (
                                <li className="pda2-row" key={a.id}>
                                  <span className={`pda2-icon tone-${look.tone}`}><Icon name={look.icon} size={14} /></span>
                                  <div className="pda2-text-wrap">
                                    <div className="pda2-text"><b>{a.profiles?.full_name ?? 'Someone'}</b> {a.detail}</div>
                                    <div className="pda2-time">{agoEn(a.created_at)}</div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              {/* Notes: private to the team */}
              <section className="pdn" id="notes">
                <div className="pdn-head">
                  <span className="pdn-badge"><Icon name="note" size={16} /></span>
                  <div className="pdn-head-text">
                    <div className="pdn-title">Notes <span className="pdn-count tabular">{notes.length}</span></div>
                    <div className="pdn-sub">Private to the team. The client never sees these.</div>
                  </div>
                </div>

                {!notesReady && notesLoaded ? (
                  <div className="pdn-setup" role="alert">
                    <strong>Notes need a one-time database update</strong>
                    <span>Run the SQL for the project_notes table in Supabase (it is in sql/schema.sql), then reload this page.</span>
                  </div>
                ) : (
                  <>
                    <div className="pdn-compose">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void addNote();
                        }}
                        placeholder="Write a note for the team…"
                        rows={3}
                        maxLength={4000}
                        aria-label="New note"
                      />
                      <div className="pdn-compose-foot">
                        <span className="pdn-hint">Press Ctrl + Enter to add</span>
                        <button type="button" className="btn btn-accent btn-sm" onClick={() => void addNote()} disabled={noteBusy || !noteText.trim()}>
                          <Icon name="plus" size={13} /> Add note
                        </button>
                      </div>
                    </div>
                    {noteError && <div className="pdn-error" role="alert">{noteError}</div>}

                    {notes.length === 0 ? (
                      <div className="pdn-empty">
                        <span className="pdn-empty-icon"><Icon name="note" size={18} /></span>
                        <strong>No notes yet</strong>
                        <span>Jot down decisions, calls and reminders for this project.</span>
                      </div>
                    ) : (
                      <ul className="pdn-list">
                        {notes.map((n) => {
                          const mine = !!user && n.author_id === user.id;
                          const canManage = mine || isAdminUser;
                          const name = n.profiles?.full_name ?? 'Team member';
                          return (
                            <li className={`pdn-note${n.pinned ? ' pinned' : ''}`} key={n.id}>
                              <Avatar person={{ full_name: name, avatar_color: n.profiles?.avatar_color ?? null, avatar_url: n.profiles?.avatar_url ?? null }} size={32} />
                              <div className="pdn-body">
                                <div className="pdn-meta">
                                  <b>{name}</b>
                                  <span>{agoEn(n.created_at)}{n.updated_at && n.updated_at !== n.created_at ? ' · edited' : ''}</span>
                                  {n.pinned && <span className="pdn-pin"><Icon name="pin" size={12} /> Pinned</span>}
                                </div>
                                {editingNote === n.id ? (
                                  <div className="pdn-edit">
                                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} maxLength={4000} aria-label="Edit note" autoFocus />
                                    <div className="pdn-edit-actions">
                                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNote(null)}>Cancel</button>
                                      <button type="button" className="btn btn-accent btn-sm" onClick={() => void saveNoteEdit(n.id)} disabled={noteBusy || !editText.trim()}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="pdn-text">{n.body}</p>
                                )}
                              </div>
                              {canManage && editingNote !== n.id && (
                                <div className="pdn-actions">
                                  <button type="button" className={`pdn-act${n.pinned ? ' on' : ''}`} onClick={() => void toggleNotePin(n)} title={n.pinned ? 'Unpin' : 'Pin to top'} aria-label={n.pinned ? 'Unpin note' : 'Pin note'}><Icon name="pin" size={13} /></button>
                                  <button type="button" className="pdn-act" onClick={() => { setEditingNote(n.id); setEditText(n.body); }} title="Edit" aria-label="Edit note"><Icon name="pencil" size={13} /></button>
                                  <button type="button" className="pdn-act danger" onClick={() => void deleteNote(n.id)} title="Delete" aria-label="Delete note"><Icon name="trash-2" size={13} /></button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </section>
            </div>
          </main>
      {showTaskModal && (
        <div
          className="modal-overlay pd-task-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creatingTask) setShowTaskModal(false);
          }}
        >
          <div className="modal-box pd-task-modal">
            <div className="modal-title">Assign a task</div>
            <p className="pd-task-modal-sub">New task in <b>{project?.name}</b></p>
            <form onSubmit={handleCreateTask}>
              <label className="field-label">Task title</label>
              <input className="field-input" type="text" value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Design the checkout screens" autoFocus required />

              <label className="field-label">Description <span className="pd-optional">optional</span></label>
              <RichTextField value={tDescription} onChange={setTDescription} textareaClassName="field-input" placeholder="What needs to be done?" rows={3} />

              <label className="field-label">Assign to <span className="pd-optional">choose a team member</span></label>
              <div className="pd-assign-grid" role="radiogroup" aria-label="Assign to">
                {members.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={tAssignee === m.id} className={`pd-assign-opt${tAssignee === m.id ? ' active' : ''}`} onClick={() => setTAssignee(m.id)}>
                    <Avatar person={m} size={26} />
                    <span className="pd-assign-name">{m.full_name}</span>
                  </button>
                ))}
              </div>

              <div className="pd-task-row">
                <div>
                  <label className="field-label">Priority</label>
                  <div className="pd-seg" role="group" aria-label="Priority">
                    {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                      <button key={p} type="button" className={tPriority === p ? 'active' : ''} onClick={() => setTPriority(p)}>{PRIORITY_META[p].label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Deadline</label>
                  <input className="field-input" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
                </div>
              </div>

              {taskFormError && <div className="pd-task-error">{taskFormError}</div>}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTaskModal(false)} disabled={creatingTask}>Cancel</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingTask || !tTitle.trim() || !tAssignee}>
                  {creatingTask ? 'Assigning…' : 'Assign task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showMilestoneModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMilestoneModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">নতুন মাইলস্টোন যোগ করুন</div>
            <form onSubmit={handleCreateMilestone}>
              <label className="field-label">শিরোনাম</label>
              <input className="field-input" type="text" value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} placeholder="যেমন: ওয়্যারফ্রেম ও IA" autoFocus required />

              <label className="field-label">ডেডলাইন</label>
              <input className="field-input" type="date" value={newMilestoneDueDate} onChange={(e) => setNewMilestoneDueDate(e.target.value)} />

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneModal(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingMilestone || !newMilestoneTitle.trim()}>
                  {creatingMilestone ? 'তৈরি হচ্ছে…' : 'মাইলস্টোন তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
