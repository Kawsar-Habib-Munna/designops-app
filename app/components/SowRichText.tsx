// Renders the lightweight formatting used in the SOW "Terms & Conditions" text. The terms are still stored as
// plain text in the same column — the formatting is a small markdown-style subset, so old terms (no markers)
// look the same as before and nothing in the database changes:
//   **bold**   *italic*   ## heading   - bullet   1. numbered
// Rendering goes through React elements only (never innerHTML), so the text cannot inject markup.
import type { ReactNode } from 'react';
import './sow-rich.css';

// inline: **bold** and *italic*
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) out.push(<strong key={`${keyPrefix}-${i}`}>{token.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyPrefix}-${i}`}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// a paragraph keeps its single line breaks (the old plain-text rendering used white-space: pre-wrap)
function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyPrefix}-br-${idx}`} />);
    out.push(...renderInline(line, `${keyPrefix}-${idx}`));
  });
  return out;
}

const BULLET = /^\s*(?:[-•*])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,3}\s+(.*)$/;

export default function SowRichText({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push(
        <div className="sow-rich-h" key={key++}>
          {renderInline(heading[1], `h${key}`)}
        </div>
      );
      i += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push((lines[i].match(BULLET) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push(
        <ul className="sow-rich-list" key={key++}>
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `u${key}-${n}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (NUMBERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED.test(lines[i])) {
        items.push((lines[i].match(NUMBERED) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push(
        <ol className="sow-rich-list" key={key++}>
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `o${key}-${n}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // paragraph: consecutive plain lines up to a blank line or the start of another block
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !HEADING.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p className="sow-rich-p" key={key++}>
        {renderLines(para, `p${key}`)}
      </p>
    );
  }

  return <div className={`sow-rich${className ? ` ${className}` : ''}`}>{blocks}</div>;
}
