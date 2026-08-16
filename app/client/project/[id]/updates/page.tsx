'use client';

// Screen 22 — Project Updates (client)। শুধু read-only ক্রনোলজিক্যাল ফিড —
// এডমিন পাবলিশ করে (/projects/[id]/updates), ক্লায়েন্ট এখানে দেখে।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject } from '@/lib/clientPortal';
import { formatBnDateLong, relativeTimeBn } from '@/lib/format';
import '../../../client-shared.css';

type Update = { id: string; title: string; description: string | null; attachment_url: string | null; created_at: string };
type ProjectInfo = { id: string; name: string };

export default function ClientUpdatesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        const { data } = await supabase.from('project_updates').select('id, title, description, attachment_url, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
        setUpdates((data as Update[]) ?? []);
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
        <h1 className="cp-page-title">Project Updates</h1>

        {updates.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">No updates yet.</p>
          </div>
        ) : (
          <div className="cp-item-list">
            {updates.map((u) => (
              <div className="cp-dash-card" key={u.id}>
                <div className="cp-item-title">{u.title}</div>
                <div className="cp-item-meta">
                  {formatBnDateLong(u.created_at)} · {relativeTimeBn(u.created_at)}
                </div>
                {u.description && <p className="cp-item-desc">{u.description}</p>}
                {u.attachment_url && (
                  <a href={u.attachment_url} target="_blank" rel="noopener noreferrer" className="cp-item-link">
                    View attachment ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
