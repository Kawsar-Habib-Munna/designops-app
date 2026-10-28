'use client';

// A textarea with a small formatting toolbar for the SOW "Terms & Conditions". The value stays plain text; the buttons
// insert the markdown-style markers that SowRichText renders (**bold**, *italic*, ## heading, "- " bullets, "1. " numbers).
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import './rich-text-field.css';

const BULLET_RE = /^\s*[-•*]\s+/;
const NUMBER_RE = /^\s*\d+[.)]\s+/;
const HEADING_RE = /^\s*#{1,3}\s+/;
const stripMarker = (line: string) => line.replace(BULLET_RE, '').replace(NUMBER_RE, '').replace(HEADING_RE, '');

type LineKind = 'ul' | 'ol' | 'h';
type ToolKey = 'bold' | 'italic' | 'heading' | 'ul' | 'ol';

const TOOLS: { key: ToolKey; label: string; title: string; icon: ReactNode }[] = [
  { key: 'bold', label: 'Bold', title: 'Bold (Ctrl+B)', icon: <span className="rtf-b">B</span> },
  { key: 'italic', label: 'Italic', title: 'Italic (Ctrl+I)', icon: <span className="rtf-i">I</span> },
  { key: 'heading', label: 'Heading', title: 'Heading', icon: <span className="rtf-h">H</span> },
  {
    key: 'ul',
    label: 'Bulleted list',
    title: 'Bulleted list',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="5" cy="6" r="1" fill="currentColor" />
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="5" cy="18" r="1" fill="currentColor" />
        <path d="M10 6h10M10 12h10M10 18h10" />
      </svg>
    ),
  },
  {
    key: 'ol',
    label: 'Numbered list',
    title: 'Numbered list',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 6h10M10 12h10M10 18h10" />
        <path d="M4 5l1.5-1v5M4 14.5a1.5 1.5 0 1 1 3 .5c0 .8-1.4 1.6-3 3h3.2" />
      </svg>
    ),
  },
];

export default function RichTextField({
  value,
  onChange,
  textareaClassName,
  placeholder,
  showHint = false,
  rows,
  required,
  autoFocus,
  disabled,
  minHeight,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  textareaClassName?: string;
  placeholder?: string;
  // the marker cheat-sheet under the field; the Terms field shows it, the shorter Project Summary doesn't need to
  showHint?: boolean;
  rows?: number;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  // for fields that used an inline minHeight instead of rows
  minHeight?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // apply the new text, then put the selection back (React re-renders the textarea, which would drop it)
  function commit(next: string, selStart: number, selEnd: number) {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  // **bold** / *italic*: wraps the selection (or a placeholder word); applying it again removes the markers
  function wrap(marker: string, placeholderText: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    const m = marker.length;

    const italicInsideBold = marker === '*' && (value.slice(s - 2, s) === '**' || value.slice(e, e + 2) === '**');
    if (!italicInsideBold && value.slice(s - m, s) === marker && value.slice(e, e + m) === marker) {
      commit(value.slice(0, s - m) + sel + value.slice(e + m), s - m, e - m);
      return;
    }
    if (!italicInsideBold && sel.length >= m * 2 && sel.startsWith(marker) && sel.endsWith(marker)) {
      const inner = sel.slice(m, -m);
      commit(value.slice(0, s) + inner + value.slice(e), s, s + inner.length);
      return;
    }
    const text = sel || placeholderText;
    commit(value.slice(0, s) + marker + text + marker + value.slice(e), s + m, s + m + text.length);
  }

  // bullets / numbers / heading apply to every line the selection touches; applying again removes them
  function formatLines(kind: LineKind) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    const endFrom = e > s && value[e - 1] === '\n' ? e - 1 : e;
    let end = value.indexOf('\n', endFrom);
    if (end === -1) end = value.length;

    const lines = value.slice(start, end).split('\n');
    const filled = lines.filter((l) => l.trim() !== '');
    const re = kind === 'ul' ? BULLET_RE : kind === 'ol' ? NUMBER_RE : HEADING_RE;
    const allMarked = filled.length > 0 && filled.every((l) => re.test(l));

    let n = 0;
    const next = lines.map((l) => {
      if (l.trim() === '') return l;
      const bare = stripMarker(l);
      if (allMarked) return bare;
      if (kind === 'ul') return `- ${bare}`;
      if (kind === 'ol') {
        n += 1;
        return `${n}. ${bare}`;
      }
      return `## ${bare}`;
    });
    const block = next.join('\n');
    commit(value.slice(0, start) + block + value.slice(end), start, start + block.length);
  }

  function handleKeyDown(ev: KeyboardEvent<HTMLTextAreaElement>) {
    const el = ev.currentTarget;
    const mod = ev.ctrlKey || ev.metaKey;

    if (mod && (ev.key === 'b' || ev.key === 'B')) {
      ev.preventDefault();
      wrap('**', 'bold text');
      return;
    }
    if (mod && (ev.key === 'i' || ev.key === 'I')) {
      ev.preventDefault();
      wrap('*', 'italic text');
      return;
    }

    // Enter at the end of a list line starts the next item; Enter on an empty item ends the list
    if (ev.key === 'Enter' && !ev.shiftKey && !mod && el.selectionStart === el.selectionEnd) {
      const pos = el.selectionStart;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = value.indexOf('\n', pos);
      if (lineEnd === -1) lineEnd = value.length;
      if (pos !== lineEnd) return;
      const line = value.slice(lineStart, lineEnd);
      const match = line.match(/^(\s*)([-•*]|(\d+)[.)])\s+(.*)$/);
      if (!match) return;
      ev.preventDefault();
      if (match[4].trim() === '') {
        commit(value.slice(0, lineStart) + value.slice(lineEnd), lineStart, lineStart);
        return;
      }
      const marker = match[3] ? `${Number(match[3]) + 1}.` : match[2];
      const insert = `\n${match[1]}${marker} `;
      commit(value.slice(0, pos) + insert + value.slice(pos), pos + insert.length, pos + insert.length);
    }
  }

  function runTool(key: ToolKey) {
    if (key === 'bold') wrap('**', 'bold text');
    else if (key === 'italic') wrap('*', 'italic text');
    else if (key === 'heading') formatLines('h');
    else if (key === 'ul') formatLines('ul');
    else formatLines('ol');
  }

  return (
    <div className="rtf">
      <div className="rtf-toolbar" role="toolbar" aria-label="Text formatting">
        {TOOLS.map((t) => (
          <button
            type="button"
            key={t.key}
            className="rtf-btn"
            title={t.title}
            aria-label={t.label}
            // keep the textarea's focus + selection when a button is pressed
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => runTool(t.key)}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className={`rtf-textarea${textareaClassName ? ` ${textareaClassName}` : ''}`}
        value={value}
        placeholder={placeholder}
        rows={rows}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        style={minHeight ? { minHeight, resize: 'vertical' } : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {showHint && (
        <p className="rtf-hint">
          Formatting shows in the preview: <b>**bold**</b> · <i>*italic*</i> · <code>## heading</code> · <code>- bullet</code> · <code>1. numbered</code>
        </p>
      )}
    </div>
  );
}
