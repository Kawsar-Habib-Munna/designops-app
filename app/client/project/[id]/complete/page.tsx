'use client';

// Screen 24 — Project Completion (client)। শুধু projects.status='completed' হলেই
// (এডমিন প্রজেক্ট ডিটেইল পেজ থেকে "Close Project" চাপার পর) সক্রিয় হয়। Final
// Payment/SOW/Final Delivery স্ট্যাটাস আসল ডেটা থেকে ডেরাইভ করা — কোনো আলাদা
// "completion checklist" টেবিল লাগেনি।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject } from '@/lib/clientPortal';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import { formatBnDateLong } from '@/lib/format';
import '../../../client-shared.css';

type ProjectInfo = { id: string; name: string; status: string; completed_at: string | null; final_delivery_status: string | null };
type Invoice = { status: string };
type Sow = { status: string };
type Payment = { id: string; invoice_id: string; confirmed_at: string | null };
type FileRow = { id: string; name: string; drive_url: string };

export default function ClientCompletionPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sow, setSow] = useState<Sow | null>(null);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        const [projectRes, invoicesRes, sowRes, paymentsRes, filesRes] = await Promise.all([
          supabase.from('projects').select('id, name, status, completed_at, final_delivery_status').eq('id', projectId).maybeSingle(),
          supabase.from('invoices').select('status').eq('project_id', projectId),
          supabase.from('sows').select('status').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('payments').select('id, invoice_id, confirmed_at').eq('project_id', projectId).not('confirmed_at', 'is', null).order('confirmed_at', { ascending: false }).limit(1),
          supabase.from('client_files').select('id, name, drive_url').eq('client_id', own.client.id).eq('category', 'deliverable').order('created_at', { ascending: false }),
        ]);
        setProject((projectRes.data as ProjectInfo) ?? null);
        setInvoices((invoicesRes.data as Invoice[]) ?? []);
        setSow((sowRes.data as Sow) ?? null);
        setLastPayment((paymentsRes.data?.[0] as Payment) ?? null);
        setFiles((filesRes.data as FileRow[]) ?? []);
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

  if (project.status !== 'completed') {
    return (
      <div className="client-portal">
        <div className="cp-page-shell">
          <Link href={`/client/project/${project.id}`} className="cp-page-back">
            ← {project.name}
          </Link>
          <div className="cp-dash-card">
            <p className="cp-page-empty">This project hasn&apos;t been marked complete yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const allPaid = invoices.length > 0 && invoices.every((i) => i.status === 'paid');

  return (
    <div className="client-portal">
      <div className="cp-page-shell">
        <div className="cp-dash-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Project Completed ✓</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>{project.name}</div>
          {project.completed_at && <div className="cp-item-meta" style={{ marginTop: 6 }}>{formatBnDateLong(project.completed_at)}</div>}
        </div>

        <div className="cp-dash-card">
          <div className="cp-item-top">
            <span className="cp-item-title">Final Payment</span>
            <span className={`cp-badge ${allPaid ? 'cp-badge-success' : 'cp-badge-pending'}`}>{allPaid ? 'Paid ✓' : 'Pending'}</span>
          </div>
        </div>
        <div className="cp-dash-card">
          <div className="cp-item-top">
            <span className="cp-item-title">SOW</span>
            <span className={`cp-badge ${sow?.status === 'signed' ? 'cp-badge-success' : 'cp-badge-pending'}`}>{sow?.status === 'signed' ? 'Signed ✓' : 'Not signed'}</span>
          </div>
        </div>
        <div className="cp-dash-card">
          <div className="cp-item-top">
            <span className="cp-item-title">Final Delivery</span>
            <span className={`cp-badge ${project.final_delivery_status === 'approved' ? 'cp-badge-success' : 'cp-badge-pending'}`}>{project.final_delivery_status === 'approved' ? 'Approved ✓' : 'Pending'}</span>
          </div>
        </div>

        <div className="cp-item-actions" style={{ marginTop: 8 }}>
          <Link href={`/client/project/${project.id}/final-delivery`} className="cp-btn cp-btn-secondary">
            Download Final Files
          </Link>
          {lastPayment && (
            <Link href={`/client/project/${project.id}/payments/${lastPayment.id}/receipt`} className="cp-btn cp-btn-secondary">
              Download Receipt
            </Link>
          )}
          <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-secondary">
            View Project Summary
          </Link>
        </div>

        {files.length > 0 && (
          <div className="cp-dash-card" style={{ marginTop: 16 }}>
            <div className="cp-item-title" style={{ marginBottom: 10 }}>
              Final Files
            </div>
            <div className="cp-item-list" style={{ gap: 8 }}>
              {files.map((f) => (
                <a key={f.id} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="cp-item-link" style={{ display: 'block' }}>
                  📁 {f.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
