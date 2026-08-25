// Budget & Quote Generator-এর একমাত্র currency formatter — spec §39: "Never
// duplicate currency-formatting logic across components." প্রতিটা জায়গায়
// প্রাইস রেঞ্জ দেখাতে এই একটা ফাংশনই ব্যবহার হয়।

const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', INR: '₹', USD: '$', GBP: '£' };

export function formatBudgetAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${sym}${amount.toLocaleString('en-US')}`;
}

// openEnded=true শুধু ডিসপ্লে-তে একটা "+" জোড়া দেয় (Advanced tier-এর জন্য —
// প্রাইসিং শিটে প্রতিটা Advanced ম্যাক্সের পাশে "+" ছিল, মানে "এর বেশিও হতে
// পারে")। DB-তে সবসময় প্লেইন সংখ্যাই সেভ থাকে, "+" কখনো ডেটার অংশ না।
export function formatBudgetRange(min: number | null, max: number | null, currency: string, openEnded = false): string {
  if (min == null && max == null) return 'Not set';
  const suffix = openEnded ? '+' : '';
  if (min != null && max != null) {
    if (min === max) return `${formatBudgetAmount(min, currency)}${suffix}`;
    return `${formatBudgetAmount(min, currency)} – ${formatBudgetAmount(max, currency)}${suffix}`;
  }
  const only = min ?? max;
  return `${formatBudgetAmount(only as number, currency)}${suffix}`;
}
