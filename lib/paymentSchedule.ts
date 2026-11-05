// Payment schedule rows of a SOW are stored in one text column, one "• description || amount || due date" line per row.
// This file reads those lines safely and turns a percentage into an amount of the project value.
import { formatMoney } from '@/lib/currency';

export type ScheduleFields = { description: string; amount: string; dueDate: string };

// a stray "|" or space left at the end of a field (an empty last field used to leave a "||" behind) is dropped
const clean = (v: string | undefined) => (v ?? '').replace(/^[|\s]+|[|\s]+$/g, '');

export function parseScheduleLine(line: string): ScheduleFields {
  const [description, amount, dueDate] = line.replace(/^[•\-]\s*/, '').trim().split(/\s*\|\|\s*/);
  return { description: clean(description), amount: clean(amount), dueDate: clean(dueDate) };
}

// "30%" or "30 %" or "12.5%" -> 30 / 12.5; anything else (a fixed amount like "৳5,000") -> null
export function percentValue(amountText: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(amountText);
  return m ? Number(m[1]) : null;
}

// the amount of a percentage row, worked out from the project value ("30%" of 40,000 = 12,000)
export function percentAmount(amountText: string, projectValue: number | null | undefined): number | null {
  const pct = percentValue(amountText);
  if (pct == null || !projectValue || projectValue <= 0) return null;
  return Math.round(projectValue * pct) / 100;
}

// what the document shows in the Amount column: "30% · ৳12,000" for a percentage, the text as typed otherwise
export function scheduleAmountText(amountText: string, projectValue: number | null | undefined, currency: string | null | undefined): string {
  const calc = percentAmount(amountText, projectValue);
  if (calc == null) return amountText;
  return `${amountText.replace(/\s+/g, '')} · ${formatMoney(calc, currency ?? 'BDT')}`;
}
