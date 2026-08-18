'use client';

// SOW সাইনিং সাব-রুট — Screen 10-এর "Review & Sign" বাটনের আসল টার্গেট। এটা
// পূর্ণাঙ্গ "Screen 11" স্পেক (যেটা এখনো তৈরি করতে বলা হয়নি) না — বিদ্যমান
// sign_sow() RPC-ভিত্তিক টাইপ-করা-নাম সিগনেচার ফ্লো, যেটা আগে Screen 10-এর
// combined পেজে ছিল, সেটাই এখানে সরানো হয়েছে যাতে নতুন read-only Screen 10-এর
// "Review & Sign" CTA কখনো dead link না হয়। Screen 11 আলাদাভাবে চাইলে এই
// রুটটাই richer করা হবে।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../../client-shared.css';
import './sign.css';

type ProjectBrief = { id: string; name: string; client_id: string };
type Sow = { id: string; version: number; status: string; signed_at: string | null; signed_by_name: string | null };

export default function SowSignPage() {
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

        const { data: sowData } = await supabase.from('sows').select('id, version, status, signed_at, signed_by_name').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
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
      <div className="client-portal client-sow-sign-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal client-sow-sign-root">
      <div className="sgn-shell">
        <Link href={`/client/project/${project.id}/sow`} className="sgn-back">
          ← Statement of Work
        </Link>
        <h1 className="sgn-title">Review &amp; Sign</h1>

        {!sow || (sow.status !== 'sent' && sow.status !== 'signed') ? (
          <div className="cp-dash-card sgn-empty">
            <p>এই SOW এখন সাইন করার মতো অবস্থায় নেই।</p>
            <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary" style={{ marginTop: 12 }}>
              Back to SOW
            </Link>
          </div>
        ) : sow.status === 'signed' ? (
          <div className="cp-dash-card">
            <div className="sgn-signed-banner">
              {justSigned ? '✓ SOW Signed Successfully' : '✓ Already Signed'}
              {sow.signed_by_name && (
                <span className="sgn-signed-meta">
                  by {sow.signed_by_name} on {formatBnDateLong(sow.signed_at)}
                </span>
              )}
            </div>
            <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary">
              View SOW
            </Link>
          </div>
        ) : (
          <form className="cp-dash-card" onSubmit={handleSign}>
            <p className="sgn-agree-text">I have reviewed the Statement of Work and agree to its terms.</p>
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
              <input className="cp-input sgn-signature-input" type="text" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your name as signature" required />
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
      </div>
    </div>
  );
}
