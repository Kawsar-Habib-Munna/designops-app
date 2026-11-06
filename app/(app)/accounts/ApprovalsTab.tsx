'use client';

// Accounts > Approvals (admin): everything the accountant added or changed waits here. Nothing counts in the totals
// until an admin approves it. Rejected items go back to the accountant to fix or delete.

import { formatMoney } from '@/lib/currency';
import { formatDateLong } from '@/lib/format';
import { BASE, monthLabel, one, waitingCount, type Pending } from '@/lib/accountsCore';
import { RankColumns, SLOT, VizCard } from './viz';

export type DecideKind = 'expense' | 'slip' | 'ledger' | 'staff' | 'round';

type Props = {
  pending: Pending;
  onDecide: (kind: DecideKind, id: string, ok: boolean, label: string, expenseId?: string | null) => Promise<void>;
  onApproveAll: () => Promise<void>;
};

const payTo = (p: { pay_method: string | null; pay_account_name: string | null; pay_account_no: string | null; pay_code: string | null; pay_bank: string | null } | null) => {
  if (!p?.pay_method) return '-';
  const bits = [p.pay_method, p.pay_account_name, p.pay_code, p.pay_method === 'Card' && p.pay_account_no ? `•••• ${p.pay_account_no}` : p.pay_account_no, p.pay_bank].filter(Boolean);
  return bits.join(' · ');
};

function Buttons({ state, onApprove, onReject }: { state: string; onApprove: () => void; onReject: () => void }) {
  return (
    <td className="ac-r ac-nowrap">
      <button type="button" className="ac-link ac-linkbtn" onClick={onApprove}>Approve</button>
      {state === 'pending' && <button type="button" className="ac-link ac-linkbtn danger" onClick={onReject}>Reject</button>}
    </td>
  );
}
const Status = ({ state }: { state: string }) => <span className={`ac-status${state === 'rejected' ? ' late' : ''}`}>{state === 'rejected' ? 'Rejected' : 'Awaiting approval'}</span>;

export default function ApprovalsTab({ pending, onDecide, onApproveAll }: Props) {
  const waiting = waitingCount(pending);
  const total = pending.expenses.length + pending.slips.length + pending.ledger.length + pending.staff.length + pending.rounds.length;

  if (total === 0) {
    return (
      <section className="ac-card">
        <div className="ac-card-head"><h2>Approvals</h2></div>
        <div className="ac-card-body"><p className="ac-empty">Nothing is waiting for approval. What the accountant adds will show up here.</p></div>
      </section>
    );
  }

  return (
    <>
      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Waiting for you</h2><span className="ac-count tabular">{waiting}</span>
          <button type="button" className="ac-primary ac-right" disabled={waiting === 0} onClick={() => void onApproveAll()}>Approve all ({waiting})</button>
        </div>
        <div className="ac-card-body"><p className="ac-note" style={{ margin: 0 }}>The accountant&apos;s entries are kept out of the totals, the profit and loss and the fund accounts until you approve them.</p></div>
      </section>

      <VizCard title="What is waiting" sub="Items by type, waiting for or refused by an admin">
        <RankColumns
          ariaLabel="Items waiting for approval, by type"
          fmt={(n) => String(n)}
          items={[
            { label: 'Pay rounds', value: pending.rounds.length, color: SLOT[0], note: 'Items' },
            { label: 'Expenses', value: pending.expenses.length, color: SLOT[1], note: 'Items' },
            { label: 'Payslips', value: pending.slips.length, color: SLOT[2], note: 'Items' },
            { label: 'Salaries', value: pending.staff.length, color: SLOT[3], note: 'Items' },
            { label: 'Fund entries', value: pending.ledger.length, color: SLOT[4], note: 'Items' },
          ]}
        />
      </VizCard>

      {pending.rounds.length > 0 && (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Pay rounds</h2><span className="ac-count tabular">{pending.rounds.length}</span></div>
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>Round</th><th>Date</th><th className="ac-r">Money shared</th><th className="ac-r">Each part</th><th className="ac-r">Extra to fund</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pending.rounds.map((r) => {
                  const label = `Pay round #${r.round_no}: ${formatMoney(Number(r.pool), BASE)}`;
                  return (
                    <tr key={r.id}>
                      <td className="ac-strong">#{r.round_no}<div className="ac-faint">{r.parts} parts</div></td>
                      <td>{formatDateLong(r.round_date)}</td>
                      <td className="ac-r tabular ac-strong">{formatMoney(Number(r.pool), BASE)}</td>
                      <td className="ac-r tabular">{formatMoney(Number(r.share), BASE)}</td>
                      <td className="ac-r tabular">{formatMoney(Number(r.remainder), BASE)}</td>
                      <td><Status state={r.approval} /></td>
                      <Buttons state={r.approval} onApprove={() => void onDecide('round', r.id, true, label)} onReject={() => void onDecide('round', r.id, false, label)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ac-note" style={{ padding: '0 18px 14px' }}>Approving a round also approves its team salaries and the Allah and Agency fund deposits.</p>
        </section>
      )}

      {pending.expenses.length > 0 && (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Expenses</h2><span className="ac-count tabular">{pending.expenses.length}</span></div>
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th className="ac-r">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pending.expenses.map((e) => {
                  const label = `${e.category}: ${formatMoney(e.amount, e.currency)}`;
                  return (
                    <tr key={e.id}>
                      <td>{formatDateLong(e.expense_date)}</td>
                      <td>{e.category}</td>
                      <td>{e.vendor ?? '-'}{e.description && <em className="ac-sub-line">{e.description}</em>}</td>
                      <td className="ac-r tabular ac-strong">{formatMoney(e.amount, e.currency)}</td>
                      <td><Status state={e.approval ?? 'pending'} /></td>
                      <Buttons state={e.approval ?? 'pending'} onApprove={() => void onDecide('expense', e.id, true, label)} onReject={() => void onDecide('expense', e.id, false, label)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pending.slips.length > 0 && (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Payslips and salary payments</h2><span className="ac-count tabular">{pending.slips.length}</span></div>
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>Name</th><th>Month</th><th className="ac-r">Net pay</th><th>Paid to</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pending.slips.map((p) => {
                  const st = one(p.staff_salaries);
                  const cur = st?.currency ?? BASE;
                  const net = Number(p.base) + Number(p.bonus) - Number(p.deduction);
                  const label = `${st?.name ?? 'Payslip'} ${monthLabel(p.month)}: ${formatMoney(net, cur)}`;
                  return (
                    <tr key={p.id}>
                      <td className="ac-strong">{st?.name ?? '-'}</td>
                      <td>{monthLabel(p.month)}</td>
                      <td className="ac-r tabular ac-strong">{formatMoney(net, cur)}<em className="ac-sub-line">{p.status === 'paid' ? `Paid ${p.paid_on ?? ''}` : 'Not paid yet'}</em></td>
                      <td>{payTo(st)}</td>
                      <td><Status state={p.approval} /></td>
                      <Buttons state={p.approval} onApprove={() => void onDecide('slip', p.id, true, label, p.expense_id)} onReject={() => void onDecide('slip', p.id, false, label, p.expense_id)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pending.staff.length > 0 && (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Salary and payout changes</h2><span className="ac-count tabular">{pending.staff.length}</span></div>
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>Name</th><th className="ac-r">Monthly salary</th><th>Receives by</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pending.staff.map((s) => {
                  const label = `Salary: ${s.name} ${formatMoney(Number(s.base_salary), s.currency)}`;
                  return (
                    <tr key={s.id}>
                      <td className="ac-strong">{s.name}{s.role && <div className="ac-faint">{s.role}</div>}</td>
                      <td className="ac-r tabular ac-strong">{formatMoney(Number(s.base_salary), s.currency)}</td>
                      <td>{payTo(s)}</td>
                      <td><Status state={s.approval} /></td>
                      <Buttons state={s.approval} onApprove={() => void onDecide('staff', s.id, true, label)} onReject={() => void onDecide('staff', s.id, false, label)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ac-note" style={{ padding: '0 18px 14px' }}>No payslip is created for a person until their salary is approved.</p>
        </section>
      )}

      {pending.ledger.length > 0 && (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Allah and Agency fund entries</h2><span className="ac-count tabular">{pending.ledger.length}</span></div>
          <div className="ac-scroll">
            <table className="ac-table">
              <thead><tr><th>Account</th><th>Date</th><th>Note</th><th className="ac-r">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pending.ledger.map((l) => {
                  const label = `${l.fund === 'allah' ? 'Allah' : 'Agency fund'} ${l.kind}: ${formatMoney(Number(l.amount), BASE)}`;
                  return (
                    <tr key={l.id}>
                      <td className="ac-strong">{l.fund === 'allah' ? 'For Allah' : 'Agency fund'}</td>
                      <td className="ac-nowrap">{l.entry_date}</td>
                      <td>{l.note || '-'}</td>
                      <td className="ac-r tabular ac-strong">{l.kind === 'withdrawal' ? '− ' : ''}{formatMoney(Number(l.amount), BASE)}</td>
                      <td><Status state={l.approval} /></td>
                      <Buttons state={l.approval} onApprove={() => void onDecide('ledger', l.id, true, label)} onReject={() => void onDecide('ledger', l.id, false, label)} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
