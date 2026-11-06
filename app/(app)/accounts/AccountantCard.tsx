'use client';

// Accounts > Settings (admin): choose which team member is the accountant. The accountant can edit the Accountant page;
// what they add or change waits for an admin's approval. Only one accountant at a time.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ACCOUNTS_SQL } from '@/lib/accountsCore';

type Member = { id: string; full_name: string; role: string | null; is_accountant: boolean | null };

async function fetchMembers() {
  const r = await supabase.from('profiles').select('id, full_name, role, is_accountant').order('full_name');
  return { rows: (r.data as Member[]) ?? [], failed: !!r.error };
}

export default function AccountantCard({ audit, onChanged }: { audit: (action: string, entity: string, entityId: string | null, detail: string) => Promise<void>; onChanged: () => Promise<void> }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetchMembers();
    setMembers(r.rows);
    setFailed(r.failed);
    setPick(r.rows.find((m) => m.is_accountant)?.id ?? '');
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchMembers();
      if (cancelled) return;
      setMembers(r.rows);
      setFailed(r.failed);
      setPick(r.rows.find((m) => m.is_accountant)?.id ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = members.find((m) => m.is_accountant);

  async function save() {
    const { error } = await supabase.rpc('set_accountant', { p_profile: pick || null });
    if (error) {
      setMsg(error.message);
    } else {
      const who = members.find((m) => m.id === pick)?.full_name;
      await audit('accountant_set', 'profile', pick || null, who ? `${who} is now the accountant` : 'No accountant');
      setMsg('Saved.');
      await Promise.all([reload(), onChanged()]);
    }
    window.setTimeout(() => setMsg(null), 2600);
  }

  return (
    <section className="ac-drawer-plain">
      <p className="ac-drawer-desc" style={{ marginTop: 0 }}><b>{current ? `${current.full_name} is the accountant.` : 'No accountant is chosen yet.'}</b></p>
      <div className="ac-card-body">
        {failed ? (
          <>
            <p className="ac-note ac-warn">One-time setup: copy this SQL, run it in the Supabase SQL editor, then reload. It is safe to run again.</p>
            <button type="button" className="ac-btn" onClick={() => { void navigator.clipboard?.writeText(ACCOUNTS_SQL); setMsg('SQL copied.'); window.setTimeout(() => setMsg(null), 2000); }}>Copy SQL</button>
            {msg && <p className="ac-note">{msg}</p>}
          </>
        ) : (
          <>
            <ul className="ac-set-points">
              <li>The accountant can edit the Accountant page.</li>
              <li>Everyone else on the team can only view it.</li>
              <li>What the accountant adds or changes needs your approval before it counts.</li>
            </ul>
            <label className="ac-pf-field" style={{ maxWidth: 520 }}><span>Team member</span>
            <div className="ac-pf-inline" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
              <select className="ac-select" style={{ height: 40, width: '100%' }} value={pick ?? ''} onChange={(e) => setPick(e.target.value)}>
                <option value="">No accountant</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.role ? ` · ${m.role}` : ''}</option>)}
              </select>
              <button type="button" className="ac-primary" onClick={() => void save()} disabled={(pick ?? '') === (current?.id ?? '')}>Save</button>
            </div></label>
            {msg && <p className="ac-note">{msg}</p>}
          </>
        )}
      </div>
    </section>
  );
}
