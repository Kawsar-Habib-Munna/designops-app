// The next payment the client still has to make, shown on the receipt as "Next payment due".
// 1. the earliest-due invoice that is not paid, cancelled, failed or already submitted for verification (and not the one
//    being shown). On the client side every invoice the client can see counts, scheduled ones included (includeScheduled);
//    on the admin side unsent drafts are left out.
// 2. when no such invoice exists yet but the project value is not fully covered, the remaining balance (project value
//    minus everything already paid or submitted), so the client always sees what is still to come.
export type NextDue = { amount: number; currency: string; dueDate: string | null; description: string; kind: 'invoice' | 'balance' };

type InvoiceLike = { id: string; status: string; amount: number; currency: string; due_date: string | null; description?: string | null; payment_type: string };

export function pickNextDue(invoices: InvoiceLike[], excludeId?: string | null, includeScheduled = false, project?: { value: number | null; currency?: string | null }): NextDue | null {
  const skip = includeScheduled ? ['paid', 'cancelled', 'failed', 'processing'] : ['paid', 'cancelled', 'failed', 'processing', 'draft'];
  const open = invoices.filter((i) => !skip.includes(i.status) && i.id !== excludeId);
  if (open.length > 0) {
    open.sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'));
    const n = open[0];
    const type = n.payment_type.replace(/_/g, ' ');
    return { amount: n.amount, currency: n.currency, dueDate: n.due_date, description: n.description || type.charAt(0).toUpperCase() + type.slice(1), kind: 'invoice' };
  }
  const value = project?.value ?? null;
  if (value && value > 0) {
    const covered = invoices.filter((i) => i.status === 'paid' || i.status === 'processing').reduce((sum, i) => sum + i.amount, 0);
    const remaining = value - covered;
    if (remaining > 0.5) {
      const pct = Math.round((remaining / value) * 100);
      return { amount: remaining, currency: project?.currency || invoices[0]?.currency || 'BDT', dueDate: null, description: `Remaining balance (${pct}% of the project value)`, kind: 'balance' };
    }
  }
  return null;
}
