'use client';

// Which projects and clients actually make money: income received, costs charged to the project, profit and margin.
import { useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/currency';
import { BASE, type Calc } from '@/lib/accountsCore';
import { Donut, RankColumns, VizCard, VizRow } from './viz';

export default function ProfitabilityTab({ calc, visuals = true }: { calc: Calc; visuals?: boolean }) {
  const [by, setBy] = useState<'project' | 'client'>('project');
  const money = (n: number) => formatMoney(n, BASE);
  const totalRevenue = calc.projectRows.reduce((n, r) => n + r.revenue, 0);
  const totalCosts = calc.projectRows.reduce((n, r) => n + r.costs, 0);

  return (
    <>
      <div className="ac-aging">
        <div className="ac-age"><span>Income on projects</span><b className="tabular">{money(totalRevenue)}</b><em>received</em></div>
        <div className="ac-age"><span>Project costs</span><b className="tabular">{money(totalCosts)}</b><em>charged to a project</em></div>
        <div className="ac-age"><span>Project profit</span><b className={`tabular${totalRevenue - totalCosts < 0 ? ' red' : ''}`}>{money(totalRevenue - totalCosts)}</b><em>{totalRevenue > 0 ? `${Math.round(((totalRevenue - totalCosts) / totalRevenue) * 100)}% margin` : 'no income yet'}</em></div>
        <div className="ac-age"><span>Overhead</span><b className="tabular">{money(calc.overhead)}</b><em>costs with no project</em></div>
      </div>
      {visuals && (
<VizRow>
        <VizCard title="Profit by project" sub="Income received minus the costs charged to the project">
          <RankColumns ariaLabel="Profit or loss for each project" fmt={money} items={[...calc.projectRows].sort((a, b) => b.profit - a.profit).slice(0, 6).map((r) => ({ label: r.name, value: r.profit, note: r.profit < 0 ? 'Loss' : 'Profit', color: r.profit < 0 ? 'var(--viz-neg)' : 'var(--viz-1)' }))} />
        </VizCard>
        <VizCard title="Income by client" sub="Money received, biggest clients first">
          <Donut fmt={money} empty="No payments received yet." items={calc.clientRows.map((c) => ({ label: c.name, value: c.revenue }))} />
        </VizCard>
      </VizRow>
)}
      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Profitability</h2>
          <div className="ac-seg ac-right" role="tablist">
            <button type="button" className={by === 'project' ? 'on' : ''} onClick={() => setBy('project')}>By project</button>
            <button type="button" className={by === 'client' ? 'on' : ''} onClick={() => setBy('client')}>By client</button>
          </div>
        </div>
        <div className="ac-scroll">
          {by === 'project' ? (
            <table className="ac-table">
              <thead><tr><th>Project</th><th className="ac-r">Invoiced</th><th className="ac-r">Received</th><th className="ac-r">Costs</th><th className="ac-r">Profit</th><th className="ac-r">Margin</th></tr></thead>
              <tbody>
                {calc.projectRows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/projects/${r.id}/payments`} className="ac-link">{r.name}</Link></td>
                    <td className="ac-r tabular">{money(r.invoiced)}</td>
                    <td className="ac-r tabular">{money(r.revenue)}</td>
                    <td className="ac-r tabular">{money(r.costs)}</td>
                    <td className={`ac-r tabular ac-strong${r.profit < 0 ? ' red' : ''}`}>{money(r.profit)}</td>
                    <td className={`ac-r tabular${r.margin != null && r.margin < 0 ? ' red' : ''}`}>{r.margin != null ? `${r.margin}%` : '-'}</td>
                  </tr>
                ))}
                {calc.projectRows.length === 0 && <tr><td colSpan={6} className="ac-empty-cell">No project income or costs yet.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="ac-table">
              <thead><tr><th>Client</th><th className="ac-r">Received</th><th className="ac-r">Share</th></tr></thead>
              <tbody>
                {calc.clientRows.map((c) => (
                  <tr key={c.name}>
                    <td className="ac-strong">{c.name}</td>
                    <td className="ac-r tabular">{money(c.revenue)}</td>
                    <td className="ac-r tabular">{totalRevenue > 0 ? `${Math.round((c.revenue / totalRevenue) * 100)}%` : '-'}</td>
                  </tr>
                ))}
                {calc.clientRows.length === 0 && <tr><td colSpan={3} className="ac-empty-cell">No payments received yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
