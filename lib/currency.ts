// Currencies offered when a project / SOW is priced, plus one formatter so an amount always shows with the right
// symbol. A project stores its currency code in projects.currency (default 'BDT'); the SOW and its invoices start
// from it. Codes follow ISO 4217.
export type CurrencyOption = { code: string; symbol: string; name: string };

export const CURRENCIES: CurrencyOption[] = [
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound (UK)' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
];

export const CURRENCY_SYMBOL: Record<string, string> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]));

export function currencySymbol(code?: string | null): string {
  const c = code || 'BDT';
  return CURRENCY_SYMBOL[c] ?? c;
}

// "৳50,000", "$1,200", "AED 3,000" (letter symbols get a space so they don't run into the digits)
export function formatMoney(amount: number, code?: string | null): string {
  const sym = currencySymbol(code);
  const sep = /^[A-Za-z]{2,}$/.test(sym) ? ' ' : '';
  return `${sym}${sep}${amount.toLocaleString('en-US')}`;
}

// option label used by every currency <select>: "BDT — ৳ Bangladeshi Taka"
export function currencyLabel(c: CurrencyOption): string {
  return `${c.code} — ${c.symbol} ${c.name}`;
}
