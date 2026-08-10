'use client';

// অ্যাপজুড়ে (task assignee, discussion author, team member, activity feed,
// vote responses ইত্যাদি) সব জায়গায় ব্যবহৃত অ্যাভাটার — ProfileMenu-তে আপলোড করা
// প্রোফাইল ছবি (avatar_url, Google Drive-এ হোস্ট করা) থাকলে সেটা দেখায়, নাহলে
// আগের মতোই রঙিন initial. প্রতিটা পেজের নিজস্ব scoped CSS-এ .avatar ক্লাস
// (border-radius/display/font-weight ইত্যাদি লেআউট) আগে থেকেই ডিফাইন করা আছে,
// তাই এই কম্পোনেন্ট সেই ক্লাসটাই ব্যবহার করে — কোনো এক্সট্রা CSS ছাড়াই যেকোনো
// পেজের ভেতরে বসে যায় (ProfileMenu.tsx-এর কমেন্টে বর্ণিত একই কনভেনশন)।

import { driveThumbnailUrl } from '@/lib/driveUpload';

type AvatarPerson = { full_name?: string | null; avatar_color?: string | null; avatar_url?: string | null } | null | undefined;

export default function Avatar({
  person,
  size = 28,
  fontSize,
  className = 'avatar',
  style,
  title,
  children,
}: {
  person: AvatarPerson;
  size?: number;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
}) {
  const name = person?.full_name?.trim() || '?';
  const initial = Array.from(name)[0]?.toUpperCase() ?? '?';
  const img = person?.avatar_url ? driveThumbnailUrl(person.avatar_url) : null;

  return (
    <div
      className={className}
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: fontSize ?? Math.max(9, Math.round(size * 0.42)),
        background: img ? undefined : (person?.avatar_color ?? undefined),
        overflow: 'hidden',
        padding: 0,
        ...style,
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initial
      )}
      {children}
    </div>
  );
}
