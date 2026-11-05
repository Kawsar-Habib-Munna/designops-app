'use client';

// Accounts > Payroll: team salaries. Staff with a monthly base salary, one payslip per person per month
// (base + bonus - deduction = net), and "Mark paid" which books the net amount as a "Salaries" expense
// so it shows up in the profit & loss automatically. Tables: staff_salaries, payslips (see lib/accountsCore.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney } from '@/lib/currency';
import '@/app/components/receipt-document.css';
import '@/app/components/receipt-preview-modal.css';
import { formatDateLong } from '@/lib/format';
import { renderReceiptPdf } from '@/lib/receiptPdf';
import { AGENCY_INFO } from '@/lib/agencyInfo';
import { BASE, CURRENCY_CHOICES, monthLabel, type FxRate } from '@/lib/accountsCore';

type StaffRow = { id: string; profile_id: string | null; name: string; role: string | null; base_salary: number; currency: string; active: boolean };
type Staff = StaffRow & { virtual?: boolean }; // virtual: a team member whose salary is not set yet
type Member = { id: string; full_name: string; role: string | null };

async function fetchPayroll() {
  const [st, sl, pr] = await Promise.all([
    supabase.from('staff_salaries').select('id, profile_id, name, role, base_salary, currency, active').order('name'),
    supabase.from('payslips').select('id, staff_id, month, base, bonus, deduction, status, paid_on, expense_id'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ]);
  return { ready: !st.error && !sl.error, rows: (st.data as StaffRow[]) ?? [], slips: (sl.data as Slip[]) ?? [], members: (pr.data as Member[]) ?? [] };
}
type Slip = { id: string; staff_id: string; month: string; base: number; bonus: number; deduction: number; status: 'pending' | 'paid'; paid_on: string | null; expense_id: string | null };

type Props = {
  rates: FxRate[];
  today: string;
  audit: (action: string, entity: string, entityId: string | null, detail: string) => Promise<void>;
  userId: string | null;
  onChanged: () => Promise<void>;
};

const net = (s: Slip) => Number(s.base) + Number(s.bonus) - Number(s.deduction);

export default function PayrollTab({ rates, today, audit, userId, onChanged }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [ready, setReady] = useState(true);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState('');
  const [cur, setCur] = useState(BASE);
  const [view, setView] = useState<Slip | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [adj, setAdj] = useState<Record<string, { bonus?: string; deduction?: string }>>({});

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  };

  const reload = useCallback(async () => {
    const r = await fetchPayroll();
    setReady(r.ready);
    setRows(r.rows);
    setSlips(r.slips);
    setMembers(r.members);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPayroll();
      if (cancelled) return;
      setReady(r.ready);
      setRows(r.rows);
      setSlips(r.slips);
      setMembers(r.members);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // every team member (profile) is listed automatically; the salary is saved the first time you set it
  const staff: Staff[] = [
    ...members.map((m): Staff => {
      const r = rows.find((x) => x.profile_id === m.id);
      return r ? { ...r, name: m.full_name, role: m.role } : { id: 'p:' + m.id, profile_id: m.id, name: m.full_name, role: m.role, base_salary: 0, currency: BASE, active: true, virtual: true };
    }),
    ...rows.filter((r) => !r.profile_id || !members.some((m) => m.id === r.profile_id)),
  ];

  const rateMap = new Map(rates.map((r) => [r.currency, Number(r.rate_to_base)]));
  const toBase = (amount: number, c: string) => (c === BASE ? amount : amount * (rateMap.get(c) ?? 0));
  const byId = new Map(staff.map((s) => [s.id, s]));
  const monthSlips = slips.filter((s) => s.month === month && byId.has(s.staff_id)).sort((a, b) => (byId.get(a.staff_id)?.name ?? '').localeCompare(byId.get(b.staff_id)?.name ?? ''));
  const missingSlips = staff.filter((s) => !s.virtual && s.active && !monthSlips.some((p) => p.staff_id === s.id));
  const total = monthSlips.reduce((n, p) => n + toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE), 0);
  const paid = monthSlips.filter((p) => p.status === 'paid').reduce((n, p) => n + toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE), 0);
  const monthlyBase = staff.filter((s) => s.active).reduce((n, s) => n + toBase(Number(s.base_salary), s.currency), 0);

  function shiftMonth(delta: number) {
    const d = new Date(month + '-01T00:00:00');
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  async function saveStaff() {
    const base = Number(salary);
    if (!name.trim()) return flash('Enter the name.');
    if (!salary || Number.isNaN(base) || base < 0) return flash('Enter a valid salary.');
    const target = editId ? staff.find((x) => x.id === editId) : null;
    if (target?.virtual) {
      const { data: row, error } = await supabase.from('staff_salaries').insert({ profile_id: target.profile_id, name: target.name, role: target.role, base_salary: base, currency: cur }).select('id').single();
      if (error) return flash(error.message);
      await audit('salary_set', 'staff', (row as { id: string }).id, `${target.name}: ${formatMoney(base, cur)} / month`);
    } else if (editId) {
      const { error } = await supabase.from('staff_salaries').update({ ...(target?.profile_id ? {} : { name: name.trim(), role: role.trim() || null }), base_salary: base, currency: cur }).eq('id', editId);
      if (error) return flash(error.message);
      await audit('staff_updated', 'staff', editId, `${name.trim()}: ${formatMoney(base, cur)} / month`);
    } else {
      const { data: row, error } = await supabase.from('staff_salaries').insert({ name: name.trim(), role: role.trim() || null, base_salary: base, currency: cur }).select('id').single();
      if (error) return flash(error.message);
      await audit('staff_added', 'staff', (row as { id: string }).id, `${name.trim()}: ${formatMoney(base, cur)} / month`);
    }
    setName('');
    setRole('');
    setSalary('');
    setEditId(null);
    flash('Saved.');
    await reload();
  }
  async function toggleActive(s: Staff) {
    await supabase.from('staff_salaries').update({ active: !s.active }).eq('id', s.id);
    await audit(s.active ? 'staff_paused' : 'staff_resumed', 'staff', s.id, s.name);
    await reload();
  }
  async function removeStaff(s: Staff) {
    if (!window.confirm(`Delete ${s.name} and all their payslips? Expenses already booked stay.`)) return;
    await supabase.from('staff_salaries').delete().eq('id', s.id);
    await audit('staff_deleted', 'staff', s.id, s.name);
    await reload();
  }

  async function generate() {
    if (missingSlips.length === 0) return;
    const rows = missingSlips.map((s) => ({ staff_id: s.id, month, base: s.base_salary, bonus: 0, deduction: 0 }));
    const { error } = await supabase.from('payslips').insert(rows);
    if (error) return flash(error.message);
    await audit('payslips_generated', 'payroll', null, `${rows.length} payslip${rows.length === 1 ? '' : 's'} for ${monthLabel(month)}`);
    flash(`${rows.length} payslip${rows.length === 1 ? '' : 's'} created.`);
    await reload();
  }
  async function saveAdjust(p: Slip) {
    const a = adj[p.id];
    if (!a) return;
    const bonus = a.bonus !== undefined ? Number(a.bonus) || 0 : p.bonus;
    const deduction = a.deduction !== undefined ? Number(a.deduction) || 0 : p.deduction;
    if (bonus < 0 || deduction < 0) return flash('Amounts cannot be negative.');
    await supabase.from('payslips').update({ bonus, deduction }).eq('id', p.id);
    await audit('payslip_adjusted', 'payslip', p.id, `${byId.get(p.staff_id)?.name ?? ''} ${monthLabel(p.month)}: bonus ${bonus}, deduction ${deduction}`);
    setAdj((x) => {
      const { [p.id]: _drop, ...rest } = x;
      void _drop;
      return rest;
    });
    await reload();
  }
  async function markPaid(p: Slip) {
    const s = byId.get(p.staff_id);
    if (!s) return;
    const { data: exp, error } = await supabase
      .from('expenses')
      .insert({ expense_date: today, amount: net(p), currency: s.currency, category: 'Salaries', vendor: s.name, description: `Salary ${monthLabel(p.month)}`, created_by: userId })
      .select('id')
      .single();
    if (error) return flash(error.message);
    await supabase.from('payslips').update({ status: 'paid', paid_on: today, expense_id: (exp as { id: string }).id }).eq('id', p.id);
    await audit('salary_paid', 'payslip', p.id, `${s.name} ${monthLabel(p.month)}: ${formatMoney(net(p), s.currency)}`);
    await Promise.all([reload(), onChanged()]);
  }
  async function markUnpaid(p: Slip) {
    if (!window.confirm('Undo this payment? The salary expense is removed.')) return;
    if (p.expense_id) await supabase.from('expenses').delete().eq('id', p.expense_id);
    await supabase.from('payslips').update({ status: 'pending', paid_on: null, expense_id: null }).eq('id', p.id);
    await audit('salary_unpaid', 'payslip', p.id, `${byId.get(p.staff_id)?.name ?? ''} ${monthLabel(p.month)}`);
    await Promise.all([reload(), onChanged()]);
  }
  async function payAll() {
    const todo = monthSlips.filter((p) => p.status === 'pending');
    if (todo.length === 0) return;
    if (!window.confirm(`Mark ${todo.length} payslip${todo.length === 1 ? '' : 's'} as paid?`)) return;
    for (const p of todo) await markPaid(p);
    flash('All paid.');
  }

  async function downloadPdf(p: Slip) {
    if (!docRef.current) return;
    setPdfBusy(true);
    try {
      const { blob } = await renderReceiptPdf(docRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${(byId.get(p.staff_id)?.name ?? 'staff').replace(/s+/g, '-').toLowerCase()}-${p.month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash('Could not create the PDF.');
    }
    setPdfBusy(false);
  }

  function exportCsv() {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows: (string | number)[][] = [['Name', 'Role', 'Currency', 'Base', 'Bonus', 'Deduction', 'Net', 'Status', 'Paid on']];
    for (const p of monthSlips) {
      const s = byId.get(p.staff_id);
      rows.push([s?.name ?? '', s?.role ?? '', s?.currency ?? '', p.base, p.bonus, p.deduction, net(p), p.status, p.paid_on ?? '']);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <section className="ac-card">
        <div className="ac-card-head"><h2>Payroll</h2></div>
        <div className="ac-card-body"><p className="ac-note ac-warn">The payroll tables are missing. Run the accounts SQL (Settings tab, or the end of sql/schema.sql) in the Supabase SQL editor, then reload.</p></div>
      </section>
    );
  }

  return (
    <>
      {msg && <div className="ac-toast">{msg}</div>}
      <div className="ac-kpis ac-kpis-3">
        <div className="ac-kpi"><span className="ac-kpi-label">Monthly base payroll</span><b className="tabular">{formatMoney(monthlyBase, BASE)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">{monthLabel(month)} net payroll</span><b className="tabular">{formatMoney(total, BASE)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">Paid / still to pay</span><b className="tabular">{formatMoney(paid, BASE)} / {formatMoney(Math.max(total - paid, 0), BASE)}</b></div>
      </div>

      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Payslips</h2>
          <div className="ac-seg ac-noprint">
            <button type="button" onClick={() => shiftMonth(-1)}>‹</button>
            <button type="button" className="on">{monthLabel(month)}</button>
            <button type="button" onClick={() => shiftMonth(1)}>›</button>
          </div>
          <span className="ac-right" style={{ display: 'inline-flex', gap: 8 }}>
            <button type="button" className="ac-btn" onClick={exportCsv} disabled={monthSlips.length === 0}>Export CSV</button>
            <button type="button" className="ac-btn" onClick={() => void generate()} disabled={missingSlips.length === 0}>Generate ({missingSlips.length})</button>
            <button type="button" className="ac-primary" onClick={() => void payAll()} disabled={!monthSlips.some((p) => p.status === 'pending')}>Pay all</button>
          </span>
        </div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Name</th><th className="ac-r">Base</th><th className="ac-r">Bonus</th><th className="ac-r">Deduction</th><th className="ac-r">Net</th><th>Status</th><th /></tr></thead>
            <tbody>
              {monthSlips.map((p) => {
                const s = byId.get(p.staff_id) as Staff;
                const a = adj[p.id];
                const locked = p.status === 'paid';
                return (
                  <tr key={p.id}>
                    <td className="ac-strong">{s.name}{s.role && <div className="ac-faint">{s.role}</div>}</td>
                    <td className="ac-r tabular">{formatMoney(p.base, s.currency)}</td>
                    <td className="ac-r"><input className="ac-input" style={{ width: 96, textAlign: 'right' }} inputMode="decimal" disabled={locked} value={a?.bonus ?? String(p.bonus)} onChange={(e) => setAdj({ ...adj, [p.id]: { ...a, bonus: e.target.value } })} onBlur={() => void saveAdjust(p)} /></td>
                    <td className="ac-r"><input className="ac-input" style={{ width: 96, textAlign: 'right' }} inputMode="decimal" disabled={locked} value={a?.deduction ?? String(p.deduction)} onChange={(e) => setAdj({ ...adj, [p.id]: { ...a, deduction: e.target.value } })} onBlur={() => void saveAdjust(p)} /></td>
                    <td className="ac-r tabular ac-strong">{formatMoney(net(p), s.currency)}</td>
                    <td>{locked ? <>Paid{p.paid_on && <div className="ac-faint">{p.paid_on}</div>}</> : 'Pending'}</td>
                    <td className="ac-r ac-nowrap"><button type="button" className="ac-link ac-linkbtn" style={{ marginRight: 12 }} onClick={() => setView(p)}>Payslip</button>{locked ? <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void markUnpaid(p)}>Undo</button> : <button type="button" className="ac-link ac-linkbtn" onClick={() => void markPaid(p)}>Mark paid</button>}</td>
                  </tr>
                );
              })}
              {monthSlips.length === 0 && <tr><td colSpan={7} className="ac-empty-cell">{staff.every((x) => x.virtual) ? 'Set each team member salary below, then generate the payslips.' : `No payslips for ${monthLabel(month)} yet. Press Generate.`}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ac-card">
        <div className="ac-card-head"><h2>Team salaries</h2><span className="ac-count tabular">{staff.length}</span></div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Name</th><th>Role</th><th className="ac-r">Monthly salary</th><th>Status</th><th /></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'ac-off'}>
                  <td className="ac-strong">{s.name}</td>
                  <td>{s.role || '-'}</td>
                  <td className="ac-r tabular">{s.virtual ? <span className="ac-faint">Not set</span> : formatMoney(Number(s.base_salary), s.currency)}</td>
                  <td>{s.virtual ? 'Needs salary' : s.active ? 'Active' : 'Paused'}</td>
                  <td className="ac-r ac-nowrap">
                    <button type="button" className="ac-link ac-linkbtn" onClick={() => { setEditId(s.id); setName(s.name); setRole(s.role ?? ''); setSalary(s.virtual ? '' : String(s.base_salary)); setCur(s.currency); }}>{s.virtual ? 'Set salary' : 'Edit'}</button>
                    {!s.virtual && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void toggleActive(s)}>{s.active ? 'Pause' : 'Resume'}</button>}
                    {!s.virtual && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeStaff(s)}>{s.profile_id ? 'Clear' : 'Delete'}</button>}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={5} className="ac-empty-cell">No team members yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ac-card-body ac-staff-form">
          <input className="ac-input" placeholder="Full name" disabled={!!staff.find((x) => x.id === editId)?.profile_id} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="ac-input" placeholder="Role" disabled={!!staff.find((x) => x.id === editId)?.profile_id} value={role} onChange={(e) => setRole(e.target.value)} />
          <input className="ac-input" placeholder="Monthly salary" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <select className="ac-select" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button type="button" className="ac-primary" onClick={() => void saveStaff()}>{editId ? 'Save' : 'Add outside person'}</button>
          {editId && <button type="button" className="ac-btn" onClick={() => { setEditId(null); setName(''); setRole(''); setSalary(''); }}>Cancel</button>}
        </div>
      </section>
      {view && byId.get(view.staff_id) && (() => {
        const p = view;
        const st = byId.get(p.staff_id) as Staff;
        return (
          <div role="dialog" aria-modal="true" className="ac-noprint" style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(16,16,20,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: 24 }} onClick={() => setView(null)}>
            <div style={{ background: '#fff', borderRadius: 14, width: 'min(834px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <button type="button" className="ac-primary" disabled={pdfBusy} onClick={() => void downloadPdf(p)}>{pdfBusy ? 'Creating…' : 'Download PDF'}</button>
                <button type="button" className="ac-btn" onClick={() => setView(null)}>Close</button>
              </div>
              <div className="rpm-sheet">
              <div className="receipt-document theme-light rd-fixed" ref={docRef}>
                <div className="rd-card rd3">
                  <div className="rd3-head">
                    <div className="rd3-brand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/New%20Logo.png" alt="FLOW 53" className="rd-logo rd3-logo" />
                    </div>
                    <div className="rd3-ref">
                      <div className="rd3-ref-label">Payslip</div>
                      <div className="rd3-ref-date">{monthLabel(p.month)}</div>
                      <div className="rd3-ref-number">{p.status === 'paid' ? 'Paid' : 'Pending'}</div>
                    </div>
                  </div>
                  <hr className="rd3-rule" />

                  <table className="rd3-pair">
                    <tbody>
                      <tr>
                        <td>
                          <div className="rd3-cap">Employee</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Name</th><td>{st.name}</td></tr>
                              <tr><th>Role</th><td>{st.role || '—'}</td></tr>
                              <tr><th>Pay period</th><td>{monthLabel(p.month)}</td></tr>
                            </tbody>
                          </table>
                        </td>
                        <td>
                          <div className="rd3-cap">Paid by</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Name</th><td>{AGENCY_INFO.name}</td></tr>
                              <tr><th>Address</th><td>{AGENCY_INFO.address}</td></tr>
                              <tr><th>Email</th><td>{AGENCY_INFO.email}</td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      <tr className="rd3-pair-row2">
                        <td colSpan={2}>
                          <div className="rd3-cap">Payment details</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Status</th><td>{p.status === 'paid' ? 'Paid' : 'Pending'}</td></tr>
                              <tr><th>Paid on</th><td>{p.paid_on ? formatDateLong(p.paid_on) : '—'}</td></tr>
                              <tr><th>Currency</th><td>{st.currency}</td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="rd3-cap rd3-cap-items">Salary summary</div>
                  <table className="rd3-items">
                    <thead>
                      <tr><th className="rd3-n">#</th><th>Description</th><th className="rd3-r">Amount</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="rd3-n">1</td><td className="rd3-desc">Base salary</td><td className="rd3-r rd3-strong">{formatMoney(Number(p.base), st.currency)}</td></tr>
                      <tr><td className="rd3-n">2</td><td className="rd3-desc">Bonus</td><td className="rd3-r rd3-strong">{formatMoney(Number(p.bonus), st.currency)}</td></tr>
                      <tr><td className="rd3-n">3</td><td className="rd3-desc">Deductions</td><td className="rd3-r rd3-strong">− {formatMoney(Number(p.deduction), st.currency)}</td></tr>
                    </tbody>
                  </table>

                  <table className="rd3-totals">
                    <tbody>
                      <tr>
                        <td className="rd3-totals-spacer"></td>
                        <td>
                          <table className="rd3-totals-inner">
                            <tbody>
                              <tr className="rd3-sub"><th>Gross pay</th><td>{formatMoney(Number(p.base) + Number(p.bonus), st.currency)}</td></tr>
                              <tr className="rd3-sub"><th>Deductions</th><td>− {formatMoney(Number(p.deduction), st.currency)}</td></tr>
                              <tr className="rd3-grand"><th>Net pay</th><td>{formatMoney(net(p), st.currency)}</td></tr>
                            </tbody>
                          </table>
                          <div className="rd3-paid">{p.status === 'paid' ? 'Paid' : 'Pending'}{p.paid_on ? ` · ${formatDateLong(p.paid_on)}` : ''}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="rd3-cap rd3-cap-items">Notes</div>
                  <ul className="rd3-notes">
                    <li>This payslip is a computer-generated record of the salary for {monthLabel(p.month)} from {AGENCY_INFO.name}, so no signature is needed.</li>
                    <li>If any detail looks wrong, please contact the accounts team.</li>
                  </ul>

                  <div className="rd3-thanks">
                    <div className="rd3-thanks-title">Thank you for your work!</div>
                    <div className="rd3-thanks-sub">Questions about this payslip? Contact {AGENCY_INFO.name}.</div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
