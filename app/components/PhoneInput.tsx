'use client';

// Phone number field with a country-code picker. The stored value stays ONE plain text string in the field's
// existing column, so nothing in the database changes:
//   format="plus"   -> "+880 1712345678"   (clients, registration, onboarding, contact forms)
//   format="digits" -> "8801712345678"      (the site settings, which build WhatsApp links from digits)
// Old values typed without a code ("01712345678") still load: they are shown as a number of the default country
// and are only rewritten once the user edits the field.
import { useEffect, useRef, useState } from 'react';
import { COUNTRIES, countryByIso, joinPhone, splitPhone } from '@/lib/countries';
import './phone-input.css';

export default function PhoneInput({
  value,
  onChange,
  inputClassName,
  id,
  placeholder = 'Phone number',
  required,
  autoComplete = 'tel',
  format = 'plus',
  defaultCountry = 'BD',
}: {
  value: string;
  onChange: (next: string) => void;
  inputClassName?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  format?: 'plus' | 'digits';
  defaultCountry?: string;
}) {
  const digitsMode = format === 'digits';
  const initial = splitPhone(value, defaultCountry, digitsMode);
  const [iso, setIso] = useState(initial.iso);
  const [national, setNational] = useState(initial.national);
  // the last value this component sent up; a different incoming value (e.g. a form reset or a saved record
  // loading) re-syncs the fields, while our own echo does not (it would eat the leading 0 while typing)
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = splitPhone(value, defaultCountry, digitsMode);
    setIso(next.iso);
    setNational(next.national);
  }, [value, defaultCountry, digitsMode]);

  function emit(nextIso: string, nextNational: string) {
    const composed = joinPhone(nextIso, nextNational, digitsMode);
    lastEmitted.current = composed;
    onChange(composed);
  }

  const country = countryByIso(iso);

  return (
    <div className="phone-input">
      <label className="phone-code">
        <span className="phone-code-text">
          {country.iso} <b>+{country.dial}</b>
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
        {/* the native list does the picking; it sits invisibly over the visible chip */}
        <select
          aria-label="Country code"
          value={iso}
          onChange={(e) => {
            setIso(e.target.value);
            emit(e.target.value, national);
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        className={inputClassName}
        value={national}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => {
          setNational(e.target.value);
          emit(iso, e.target.value);
        }}
      />
    </div>
  );
}
