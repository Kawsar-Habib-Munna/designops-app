'use client';

// Screen 16 — Project Progress। Screen 9-এর ড্যাশবোর্ডেও milestone সামারি আছে,
// এটা তার ফুল ভার্সন (প্রতিটা milestone-এর description + date সহ, pending
// milestone-ও দেখায়) — routing স্পেক অনুযায়ী নিজের রুট (/progress), একই
// বিদ্যমান milestones টেবিল রিইউজ করে।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject } from '@/lib/clientPortal';
import { formatBnDate } from '@/lib/format';
import '../../../client-shared.css';

type Milestone = { id: string; title: string; description: string | null; due_date: string | null; completed_at: string | null; progress: number | null };
type ProjectInfo = { id: string; name: string; progress: number | null };

export default function ClientProgressPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        const [projectRes, milestonesRes] = await Promise.all([
          supabase.from('projects').select('id, name, progress').eq('id', projectId).maybeSingle(),
          supabase.from('milestones').select('id, title, description, due_date, completed_at, progress').eq('project_id', projectId).order('position'),
        ]);
        setProject((projectRes.data as ProjectInfo) ?? null);
        setMilestones((milestonesRes.data as Milestone[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId]);

  if (loading || !project) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal">
      <div className="cp-page-shell">
        <Link href={`/client/project/${project.id}`} className="cp-page-back">
          ← {project.name}
        </Link>
        <h1 className="cp-page-title">Project Progress</h1>

        <div className="cp-dash-card" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--accent)' }}>{project.progress ?? 0}%</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Overall Progress</div>
        </div>

        {milestones.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">Your project milestones will appear here once our team sets them up.</p>
          </div>
        ) : (
          <div className="cp-item-list">
            {milestones.map((m) => {
              const status = m.completed_at ? 'done' : (m.progress ?? 0) > 0 ? 'active' : 'pending';
              return (
                <div className="cp-dash-card" key={m.id}>
                  <div className="cp-item-top">
                    <div>
                      <span className="cp-item-title">
                        {status === 'done' ? '✓ ' : status === 'active' ? '● ' : '○ '}
                        {m.title}
                      </span>
                      {m.completed_at && <div className="cp-item-meta">Completed {formatBnDate(m.completed_at)}</div>}
                      {!m.completed_at && m.due_date && <div className="cp-item-meta">Expected {formatBnDate(m.due_date)}</div>}
                    </div>
                    <span className={`cp-badge ${status === 'done' ? 'cp-badge-success' : 'cp-badge-pending'}`}>{status === 'done' ? 'Done' : status === 'active' ? 'In Progress' : 'Pending'}</span>
                  </div>
                  {m.description && <p className="cp-item-desc">{m.description}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
