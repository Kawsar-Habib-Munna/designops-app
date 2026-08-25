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

// ---- currency conversion (BDT → USD/GBP/INR) ----
// সব সার্ভিস BDT-তে প্রাইস করা। এডমিন Settings-এ রেট সেট না করলে সেই কারেন্সিতে
// কনভার্শন করাই যাবে না (null রিটার্ন করে) — কখনো কোনো লাইভ API বা আন্দাজি
// রেট ব্যবহার হয় না (স্পেক §11)।

export type ConvertibleCurrency = 'USD' | 'GBP' | 'INR';
export type ExchangeRates = { USD: number | null; GBP: number | null; INR: number | null };

export function getExchangeRate(currency: ConvertibleCurrency, rates: ExchangeRates): number | null {
  return rates[currency] ?? null;
}

// rate = "১ ইউনিট ওই কারেন্সি = কত BDT" (যেমন USD রেট ১২২ মানে ১ ডলার ≈ ১২২ টাকা)
export function convertFromBdt(amountBdt: number, targetCurrency: string, rates: ExchangeRates): number | null {
  if (targetCurrency === 'BDT') return amountBdt;
  const rate = getExchangeRate(targetCurrency as ConvertibleCurrency, rates);
  if (!rate) return null;
  return Math.round(amountBdt / rate);
}
