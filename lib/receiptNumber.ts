// Receipt numbers are "F53-2FD238". Older ones were saved as "RCPT-20261029-2FD238" or "RC-2FD238"; they are shown in the new
// form too, so every receipt reads the same. Anything else is left exactly as it is.
export function shortReceiptNo(n: string | null | undefined): string | null {
  if (!n) return null;
  const m = /^(?:RCPT-\d{8}|RC)-([A-Z0-9]+)$/i.exec(n.trim());
  return m ? `F53-${m[1].toUpperCase()}` : n;
}
