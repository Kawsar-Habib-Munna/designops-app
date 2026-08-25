// Budget & Quote Generator-এর একমাত্র currency formatter — spec §39: "Never
// duplicate currency-formatting logic across components." প্রতিটা জায়গায়
// প্রাইস রেঞ্জ দেখাতে এই একটা ফাংশনই ব্যবহার হয়।

const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', INR: '₹', USD: '$', GBP: '£' };

export function formatBudgetAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${sym}${amount.toLocaleString('en-US')}`;
}

export function formatBudgetRange(min: number | null, max: number | null, currency: string): string {
  if (min == null && max == null) return 'Not set';
  if (min != null && max != null) {
    if (min === max) return formatBudgetAmount(min, currency);
    return `${formatBudgetAmount(min, currency)} – ${formatBudgetAmount(max, currency)}`;
  }
  const only = min ?? max;
  return formatBudgetAmount(only as number, currency);
}
