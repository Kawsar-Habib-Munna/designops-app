// Homepage hero: a two-row strip of project screenshots under "Trusted By Partners" (Figma "Frame 2147239615", node
// 3102:2197), no background glow. The rows are offset from each other and drift in opposite directions, forever.
// The images come from the dashboard (/portfolio > Hero Showcase) through lib/heroShowcase.ts; app/page.tsx loads them.
// Each row repeats its cards until one set is wider than a big screen, then holds that set three times, so the loop
// restarts without a jump and never shows a gap (see home.css).

import type { ShowcaseCard, ShowcaseRows } from '@/lib/heroShowcase';

const GAP = 18;
const FILL = 2000; // one repeated set should be at least this wide (px)

function Row({ cards, reverse }: { cards: ShowcaseCard[]; reverse?: boolean }) {
  const setWidth = cards.reduce((n, c) => n + c.w + GAP, 0);
  const reps = Math.min(8, Math.max(1, Math.ceil(FILL / setWidth)));
  const base = Array.from({ length: reps }, () => cards).flat();
  return (
    <div className="showcase-row">
      <div className={`showcase-track${reverse ? ' reverse' : ''}`}>
        {[0, 1, 2].flatMap((copy) =>
          base.map((c, i) => (
            <span key={`${copy}-${i}`} className={`showcase-card w${c.w}`} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.src}
                alt=""
                loading="lazy"
                decoding="async"
                style={c.crop ? { width: `${c.crop.w}%`, height: `${c.crop.h}%`, left: `${c.crop.left}%`, top: `${c.crop.top}%` } : undefined}
                className={c.crop ? 'cropped' : undefined}
              />
            </span>
          )),
        )}
      </div>
    </div>
  );
}

export default function ShowcaseStrip({ rows }: { rows: ShowcaseRows }) {
  const [one, two] = rows;
  if (one.length === 0 && two.length === 0) return null;
  return (
    <div className="showcase" aria-hidden="true">
      {one.length > 0 && <Row cards={one} />}
      {two.length > 0 && <Row cards={two} reverse />}
    </div>
  );
}
