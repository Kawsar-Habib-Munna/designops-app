'use client';

// A dropdown for the client portal. The browser's own <select> draws its list of options itself, so it cannot be given
// rounded corners; this one draws the list in the page, with the same rounded look as the button that opens it.
// Works with mouse, touch and keyboard (arrow keys, Home/End, Enter, Space, Escape, type-to-open).
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import './client-select.css';

export type SelectOption = { value: string; label: string };

export default function ClientSelect({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  placeholder = 'Select…',
  className = '',
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // close when the page is pressed anywhere else
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // keep the highlighted option in view in long lists
  useEffect(() => {
    if (!open || active < 0) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openMenu() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    setOpen(false);
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={`cs ${open ? 'cs-open' : ''} ${className}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="cs-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`cs-value${selected ? '' : ' cs-placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <svg className="cs-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="cs-menu" role="listbox" id={listId} ref={listRef} aria-label={ariaLabel}>
          {options.map((o, i) => (
            <li
              key={o.value || `opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`cs-option${o.value === value ? ' selected' : ''}${i === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
