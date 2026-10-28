import type { ReactNode } from "react";
import AppShell from "../components/AppShell";

// One shared shell (sidebar + top bar) for every signed-in dashboard page. It lives in this layout, so it stays mounted
// while you navigate; each page renders only its own content area.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
