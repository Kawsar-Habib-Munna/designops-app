'use client';

// Screen 11 — SOW Signature, ক্লায়েন্ট সাইড। sows.status='sent' হলে সাইনিং ফর্ম
// দেখায়; sign_sow() RPC কল করে (sql/schema.sql-এ ডিফাইন করা, security definer) —
// সরাসরি sows টেবিলে UPDATE পলিসি ক্লায়েন্টকে দেওয়া হয়নি, যাতে সাইন করা ছাড়া
// scope/deliverables/terms কেউ বদলাতে না পারে। টাইপ করা নাম-ই এখানে "সিগনেচার"
// (script ফন্টে দেখানো) — ড্র-করা ক্যানভাস সিগনেচার এই ধাপে ওভারকিল, স্পেকের
// "Signature field" আক্ষরিক ক্যানভাসের কথা বলেনি।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './sow.css';

type ProjectBrief = { id: string; name: string; client_id: string };
type Sow = {
  id: string;
  version: number;
  scope: string | null;
  objectives: string | null;
  deliverables: string | null;
  timeline: string | null;
  payment_terms: string | null;
  revision_policy: string | null;
  client_responsibilities: string | null;
  terms: string | null;
  document_url: string | null;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
};

const FIELDS: [keyof Sow, string][] = [
  ['scope', 'Scope'],
  ['objectives', 'Objectives'],
  ['deliverables', 'Deliverables'],
  ['timeline', 'Timeline'],
  ['payment_terms', 'Payment Terms'],
  ['revision_policy', 'Revision Policy'],
  ['client_responsibilities', 'Client Responsibilities'],
  ['terms', 'Terms & Conditions'],
];

export default function ClientSowPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sow, setSow] = useState<Sow | null>(null);

  const [fullName, setFullName] = useState('');
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle();
        if (!projectData || (projectData as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as ProjectBrief);
        setClient(own);
        setFullName(own.primary_contact ?? '');

        const { data: sowData } = await supabase.from('sows').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
        setSow((sowData as Sow) ?? null);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId]);

  async function handleSign(e: FormEvent) {
    e.preventDefault();
    if (!sow) return;
    setSignError(null);
    if (!agreed) {
      setSignError('চালিয়ে যেতে "I have reviewed and agree" নিশ্চিত করুন।');
      return;
    }
    if (!fullName.trim() || !signature.trim()) {
      setSignError('নাম ও সিগনেচার দুটোই আবশ্যক।');
      return;
    }
    setSigning(true);
    const { error } = await supabase.rpc('sign_sow', { p_sow_id: sow.id, p_full_name: fullName.trim(), p_signature: signature.trim() });
    setSigning(false);
    if (error) {
      setSignError(error.message);
      return;
    }
    setJustSigned(true);
    setSow((prev) => (prev ? { ...prev, status: 'signed', signed_at: new Date().toISOString(), signed_by_name: fullName.trim() } : prev));
  }

  if (loading || !project || !client) {
    return (
      <div className="client-portal client-sow-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal client-sow-root">
      <div className="sw-shell">
        <Link href={`/client/project/${project.id}`} className="sw-back">
          ← {project.name}
        </Link>
        <h1 className="sw-title">Statement of Work</h1>

        {!sow || sow.status === 'draft' ? (
          <div className="cp-dash-card sw-empty">
            <p>আপনার SOW এখনো তৈরি হয়নি বা পাঠানো হয়নি। এজেন্সি প্রস্তুত হলে এখানে দেখা যাবে।</p>
          </div>
        ) : (
          <>
            {sow.status === 'signed' && (
              <div className="sw-signed-banner">
                {justSigned ? '✓ SOW Signed Successfully' : '✓ Signed'}
                {sow.signed_by_name && (
                  <span className="sw-signed-meta">
                    by {sow.signed_by_name} on {formatBnDateLong(sow.signed_at)}
                  </span>
                )}
              </div>
            )}

            <div className="cp-dash-card">
              <div className="sw-version-label">Version {sow.version}</div>
              {sow.document_url && (
                <a href={sow.document_url} target="_blank" rel="noopener noreferrer" className="sw-doc-link">
                  📄 View full document ↗
                </a>
              )}
              {FIELDS.map(([key, label]) =>
                sow[key] ? (
                  <div className="sw-field" key={key}>
                    <div className="sw-field-label">{label}</div>
                    <p className="sw-field-text">{sow[key] as string}</p>
                  </div>
                ) : null
              )}
            </div>

            {sow.status === 'sent' && (
              <form className="cp-dash-card" onSubmit={handleSign}>
                <p className="sw-agree-text">I have reviewed and agree to the Statement of Work.</p>
                {signError && <div className="cp-alert cp-alert-error">{signError}</div>}

                <label className="cp-checkbox-row" style={{ marginBottom: 16 }}>
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I confirm I have reviewed and agree to this Statement of Work.
                </label>

                <div className="cp-field">
                  <label className="cp-label">Full Name</label>
                  <input className="cp-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Signature</label>
                  <input className="cp-input sw-signature-input" type="text" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your name as signature" required />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Date</label>
                  <input className="cp-input" type="text" value={formatBnDateLong(todayISO())} disabled />
                </div>

                <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={signing}>
                  {signing && <span className="cp-spinner" />}
                  {signing ? 'সাইন হচ্ছে…' : 'Sign & Accept'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
