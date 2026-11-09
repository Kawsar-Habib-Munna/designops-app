import { driveFullImageUrl } from './driveUpload';

// The two-row image strip under "Trusted By Partners" on the public homepage. The dashboard (/portfolio > Hero Showcase)
// controls it through the hero_showcase table. Until that table has rows (or if it is missing), the built-in images
// below are shown, so the strip never disappears by accident.
export type ShowcaseCard = { src: string; w: 228 | 284; crop?: { w: number; h: number; left: number; top: number } };
export type ShowcaseRows = [ShowcaseCard[], ShowcaseCard[]];

const img = (n: string) => `/hero/showcase/${n}.webp`;
export const DEFAULT_SHOWCASE: ShowcaseRows = [
  [
    { src: img('a1'), w: 228 },
    { src: img('a2'), w: 284 },
    { src: img('a3'), w: 228, crop: { w: 105.13, h: 156, left: -5.35, top: 0.16 } },
    { src: img('a4'), w: 284 },
    { src: img('a5'), w: 228 },
    { src: img('a6'), w: 284, crop: { w: 146, h: 136.5, left: -23, top: -26.9 } },
    { src: img('a7'), w: 228 },
  ],
  [
    { src: img('b1'), w: 284 },
    { src: img('b2'), w: 284 },
    { src: img('b3'), w: 228 },
    { src: img('b4'), w: 284 },
    { src: img('b5'), w: 228 },
    { src: img('b6'), w: 284 },
  ],
];

// the same images as plain rows, for the dashboard's "use the current images" button
export const DEFAULT_SHOWCASE_ROWS = DEFAULT_SHOWCASE.flatMap((cards, r) => cards.map((c, i) => ({ row_no: r + 1, width: c.w, image_url: c.src, order_index: (i + 1) * 10 })));

// a stored image: a site path (/hero/...) is used as it is, anything else is a Google Drive link
export function showcaseImageSrc(url: string, width = 700): string {
  return url.startsWith('/') ? url : driveFullImageUrl(url, width);
}

export const HERO_SHOWCASE_SQL = `create table if not exists hero_showcase (
  id uuid default gen_random_uuid() primary key,
  row_no int not null default 1 check (row_no in (1, 2)),
  width int not null default 284 check (width in (228, 284)),
  image_url text not null,
  order_index int not null default 0,
  published boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table hero_showcase enable row level security;
drop policy if exists "team can read hero_showcase" on hero_showcase;
create policy "team can read hero_showcase" on hero_showcase for select using (public.is_team_member());
drop policy if exists "team can write hero_showcase" on hero_showcase;
create policy "team can write hero_showcase" on hero_showcase for insert with check (public.is_team_member());
drop policy if exists "team can update hero_showcase" on hero_showcase;
create policy "team can update hero_showcase" on hero_showcase for update using (public.is_team_member());
drop policy if exists "team can delete hero_showcase" on hero_showcase;
create policy "team can delete hero_showcase" on hero_showcase for delete using (public.is_team_member());`;
