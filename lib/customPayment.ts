// A custom payment plan (installments as a percentage of the project value each), kept in the existing
// projects.payment_structure text column as "custom:Deposit|30;Design approval|30;Final|40", so no new column is needed.
// The plain values 'full', 'deposit_final' and 'milestones' are unchanged.
export type CustomInstallment = { name: string; percent: number };

export function encodeCustomPlan(rows: CustomInstallment[]): string {
  const clean = rows.filter((r) => r.name.trim() && r.percent > 0).map((r) => `${r.name.trim().replace(/[|;]/g, ' ')}|${r.percent}`);
  return clean.length ? `custom:${clean.join(';')}` : 'custom';
}

export function decodeCustomPlan(text: string | null | undefined): CustomInstallment[] | null {
  if (!text || !text.startsWith('custom:')) return null;
  const rows = text
    .slice('custom:'.length)
    .split(';')
    .map((part) => {
      const [name, percent] = part.split('|');
      return { name: (name ?? '').trim(), percent: Number(percent) };
    })
    .filter((r) => r.name && Number.isFinite(r.percent) && r.percent > 0);
  return rows.length ? rows : null;
}

// the rows of a SOW's payment schedule ("• description || amount || due date") for a custom plan
export function customPlanToSowTerms(rows: CustomInstallment[]): string {
  return rows.map((r) => `• ${r.name} || ${r.percent}% || `).join('\n');
}
