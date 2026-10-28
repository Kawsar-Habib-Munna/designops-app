// Reads a project's currency (projects.currency). Done as its own small query that falls back to 'BDT' on ANY error,
// so pages keep working before the migration that adds the column has been run (and for projects created before it).
import { supabase } from './supabaseClient';

export async function getProjectCurrency(projectId: string): Promise<string> {
  try {
    const { data, error } = await supabase.from('projects').select('currency').eq('id', projectId).maybeSingle();
    if (error || !data) return 'BDT';
    return (data as { currency?: string | null }).currency || 'BDT';
  } catch {
    return 'BDT';
  }
}

// currency per project id for a list of projects (e.g. a client's projects); missing/failed -> empty map
export async function getProjectCurrencies(projectIds: string[]): Promise<Record<string, string>> {
  if (projectIds.length === 0) return {};
  try {
    const { data, error } = await supabase.from('projects').select('id, currency').in('id', projectIds);
    if (error || !data) return {};
    return Object.fromEntries((data as { id: string; currency: string | null }[]).map((r) => [r.id, r.currency || 'BDT']));
  } catch {
    return {};
  }
}
