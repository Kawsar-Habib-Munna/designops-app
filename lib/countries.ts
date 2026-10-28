// Country calling codes for the phone input (PhoneInput.tsx). `iso` is the ISO 3166 alpha-2 code, `dial` the calling
// code without "+". Several countries share a code (+1, +7 ...); the first one listed wins when a stored number is
// matched back to a country.
export type Country = { iso: string; name: string; dial: string };

export const COUNTRIES: Country[] = [
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'NP', name: 'Nepal', dial: '977' },
  { iso: 'BT', name: 'Bhutan', dial: '975' },
  { iso: 'MV', name: 'Maldives', dial: '960' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'BH', name: 'Bahrain', dial: '973' },
  { iso: 'US', name: 'United States', dial: '1' },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'GB', name: 'United Kingdom', dial: '44' },
  { iso: 'IE', name: 'Ireland', dial: '353' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'NZ', name: 'New Zealand', dial: '64' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'ID', name: 'Indonesia', dial: '62' },
  { iso: 'TH', name: 'Thailand', dial: '66' },
  { iso: 'VN', name: 'Vietnam', dial: '84' },
  { iso: 'PH', name: 'Philippines', dial: '63' },
  { iso: 'HK', name: 'Hong Kong', dial: '852' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'JP', name: 'Japan', dial: '81' },
  { iso: 'KR', name: 'South Korea', dial: '82' },
  { iso: 'TR', name: 'Türkiye', dial: '90' },
  { iso: 'DE', name: 'Germany', dial: '49' },
  { iso: 'FR', name: 'France', dial: '33' },
  { iso: 'IT', name: 'Italy', dial: '39' },
  { iso: 'ES', name: 'Spain', dial: '34' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'NL', name: 'Netherlands', dial: '31' },
  { iso: 'BE', name: 'Belgium', dial: '32' },
  { iso: 'CH', name: 'Switzerland', dial: '41' },
  { iso: 'AT', name: 'Austria', dial: '43' },
  { iso: 'SE', name: 'Sweden', dial: '46' },
  { iso: 'NO', name: 'Norway', dial: '47' },
  { iso: 'DK', name: 'Denmark', dial: '45' },
  { iso: 'FI', name: 'Finland', dial: '358' },
  { iso: 'PL', name: 'Poland', dial: '48' },
  { iso: 'RU', name: 'Russia', dial: '7' },
  { iso: 'UA', name: 'Ukraine', dial: '380' },
  { iso: 'EG', name: 'Egypt', dial: '20' },
  { iso: 'ZA', name: 'South Africa', dial: '27' },
  { iso: 'NG', name: 'Nigeria', dial: '234' },
  { iso: 'KE', name: 'Kenya', dial: '254' },
  { iso: 'BR', name: 'Brazil', dial: '55' },
  { iso: 'MX', name: 'Mexico', dial: '52' },
  { iso: 'AR', name: 'Argentina', dial: '54' },
];

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
// longest dial code first, so "+880…" matches Bangladesh (880) and not some shorter prefix
const BY_DIAL_LONGEST = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function countryByIso(iso: string): Country {
  return BY_ISO.get(iso) ?? COUNTRIES[0];
}

// Splits a stored value into a country + the national part.
//  - "+880 1712345678" / "+8801712345678" -> BD + "1712345678"
//  - digits mode ("8801712345678", as the site settings store it) is always treated as international
//  - anything else (old free text like "01712345678") is treated as a number of `fallbackIso`, unchanged
export function splitPhone(value: string, fallbackIso: string, digitsMode: boolean): { iso: string; national: string } {
  const raw = (value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || (digitsMode && digits.length > 0);
  if (international) {
    const hit = BY_DIAL_LONGEST.find((c) => digits.startsWith(c.dial));
    if (hit) return { iso: hit.iso, national: digits.slice(hit.dial.length) };
  }
  return { iso: fallbackIso, national: raw };
}

// Builds the stored value. "+880 1712345678" normally; digits-only "8801712345678" for the site settings.
// A leading 0 of the national number is dropped (0171… -> +880 171…), the way international numbers are written.
export function joinPhone(iso: string, national: string, digitsMode: boolean): string {
  const nat = national.replace(/\D/g, '').replace(/^0+/, '');
  if (!nat) return '';
  const dial = countryByIso(iso).dial;
  return digitsMode ? `${dial}${nat}` : `+${dial} ${nat}`;
}
