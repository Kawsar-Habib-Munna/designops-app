'use client';

// What the shared dashboard shell (AppShell) offers to the pages inside it: the theme, the signed-in user/profile, and two
// top-bar slots. A page that needs something extra in the top bar renders <TopbarLeft> (replaces the default search box)
// or <TopbarActions> (buttons placed before the bell); both are portalled into the persistent top bar.
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';

export type ShellProfile = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; is_admin?: boolean; [key: string]: unknown };

export type AppShellValue = {
  dark: boolean;
  setDark: (next: boolean | ((prev: boolean) => boolean)) => void;
  user: User | null;
  profile: ShellProfile | null;
  leftEl: HTMLElement | null;
  actionsEl: HTMLElement | null;
  setLeftOverride: (on: boolean) => void;
};

export const AppShellContext = createContext<AppShellValue | null>(null);

export function useAppShell(): AppShellValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell must be used inside the dashboard shell');
  return ctx;
}

export function TopbarLeft({ children }: { children: ReactNode }) {
  const { leftEl, setLeftOverride } = useAppShell();
  useEffect(() => {
    setLeftOverride(true);
    return () => setLeftOverride(false);
  }, [setLeftOverride]);
  return leftEl ? createPortal(children, leftEl) : null;
}

export function TopbarActions({ children }: { children: ReactNode }) {
  const { actionsEl } = useAppShell();
  return actionsEl ? createPortal(children, actionsEl) : null;
}
