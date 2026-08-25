'use client';

// Service Library (Phase 2)। সবাই সার্চ/ফিল্টার করে দেখতে পারে; Add/Edit/
// Archive শুধু is_admin — কিন্তু এটা শুধু UI hide, আসল প্রোটেকশন RLS-এর
// is_admin() পলিসি (sql/schema.sql, ফেজ ২০)। মিন/ম্যাক্স ভ্যালিডেশন এখানে
// DB CHECK constraint-এর সাথে মিরর করা হয়েছে (দ্রুত ফিডব্যাক), কিন্তু আসল
// গ্যারান্টি ডেটাবেজেই।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '@/lib/useSession';
import { supabase } from '@/lib/supabaseClient';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';
import ServiceCard, { type ServiceCardData } from '../components/ServiceCard';

const CURRENCIES = ['BDT', 'INR', 'USD', 'GBP'];

type CategoryRow = { id: string; name: string; slug: string };
type ServiceRow = ServiceCardData & { category_id: string | null; keywords: string | null; status: string; slug: string };

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

type FormState = {
  id: string | null;
  name: string;
  categoryId: string;
  newCategoryName: string;
  brief: string;
  keywords: string;
  starterMin: string;
  starterMax: string;
  standardMin: string;
  standardMax: string;
  advancedMin: string;
  advancedMax: string;
  currency: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  categoryId: '',
  newCategoryName: '',
  brief: '',
  keywords: '',
  starterMin: '',
  starterMax: '',
  standardMin: '',
  standardMax: '',
  advancedMin: '',
  advancedMax: '',
  currency: 'BDT',
  status: 'active',
};

export default function BudgetServicesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = !!profile?.is_admin;

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [profileRes, categoriesRes, servicesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
        supabase.from('budget_categories').select('id, name, slug').order('name'),
        supabase.from('budget_services').select('*').order('name'),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      if (categoriesRes.error) setError(categoriesRes.error.message);
      setCategories((categoriesRes.data as CategoryRow[]) ?? []);
      setServices((servicesRes.data as ServiceRow[]) ?? []);
      setLoading(false);
    }
    run();
  }, [user]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (s.status !== statusFilter) return false;
      if (categoryFilter && s.category_id !== categoryFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.brief ?? '').toLowerCase().includes(q) || (s.keywords ?? '').toLowerCase().includes(q);
    });
  }, [services, search, categoryFilter, statusFilter]);

  function openAddForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(s: ServiceRow) {
    setForm({
      id: s.id,
      name: s.name,
      categoryId: s.category_id ?? '',
      newCategoryName: '',
      brief: s.brief ?? '',
      keywords: s.keywords ?? '',
      starterMin: s.starter_min?.toString() ?? '',
      starterMax: s.starter_max?.toString() ?? '',
      standardMin: s.standard_min?.toString() ?? '',
      standardMax: s.standard_max?.toString() ?? '',
      advancedMin: s.advanced_min?.toString() ?? '',
      advancedMax: s.advanced_max?.toString() ?? '',
      currency: s.currency,
      status: s.status,
    });
    setFormError(null);
    setShowForm(true);
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Service name is required.';
    if (!form.categoryId && !form.newCategoryName.trim()) return 'Choose a category or add a new one.';
    const pairs: [string, string, string][] = [
      ['Starter', form.starterMin, form.starterMax],
      ['Standard', form.standardMin, form.standardMax],
      ['Advanced', form.advancedMin, form.advancedMax],
    ];
    for (const [label, minStr, maxStr] of pairs) {
      if (minStr && Number(minStr) < 0) return `${label} minimum cannot be negative.`;
      if (maxStr && Number(maxStr) < 0) return `${label} maximum cannot be negative.`;
      if (minStr && maxStr && Number(minStr) > Number(maxStr)) return `${label} minimum cannot be greater than maximum.`;
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError(null);

    let categoryId = form.categoryId;
    if (!categoryId && form.newCategoryName.trim()) {
      const name = form.newCategoryName.trim();
      const { data: newCat, error: catError } = await supabase.from('budget_categories').insert({ name, slug: slugify(name) }).select('id, name, slug').single();
      if (catError || !newCat) {
        setSaving(false);
        setFormError(catError?.message ?? 'Could not create category.');
        return;
      }
      categoryId = newCat.id;
      setCategories((prev) => [...prev, newCat as CategoryRow].sort((a, b) => a.name.localeCompare(b.name)));
    }

    const num = (v: string) => (v.trim() ? Number(v) : null);
    const payload = {
      category_id: categoryId,
      name: form.name.trim(),
      slug: slugify(form.name),
      brief: form.brief.trim() || null,
      keywords: form.keywords.trim() || null,
      starter_min: num(form.starterMin),
      starter_max: num(form.starterMax),
      standard_min: num(form.standardMin),
      standard_max: num(form.standardMax),
      advanced_min: num(form.advancedMin),
      advanced_max: num(form.advancedMax),
      currency: form.currency,
      status: form.status,
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    };

    if (form.id) {
      const { data, error: updateError } = await supabase.from('budget_services').update(payload).eq('id', form.id).select('*').single();
      setSaving(false);
      if (updateError) {
        setFormError(updateError.message);
        return;
      }
      setServices((prev) => prev.map((s) => (s.id === form.id ? (data as ServiceRow) : s)));
    } else {
      const { data, error: insertError } = await supabase
        .from('budget_services')
        .insert({ ...payload, created_by: user!.id })
        .select('*')
        .single();
      setSaving(false);
      if (insertError) {
        setFormError(insertError.message.includes('duplicate key') ? 'A service with this name already exists.' : insertError.message);
        return;
      }
      setServices((prev) => [...prev, data as ServiceRow]);
    }

    setShowForm(false);
  }

  async function handleToggleArchive(s: ServiceRow) {
    const nextStatus = s.status === 'active' ? 'archived' : 'active';
    const confirmMsg = nextStatus === 'archived' ? `Archive "${s.name}"? It will no longer appear in search or the quote flow.` : `Restore "${s.name}" to active?`;
    if (!window.confirm(confirmMsg)) return;
    const { error: updateError } = await supabase.from('budget_services').update({ status: nextStatus, updated_by: user!.id, updated_at: new Date().toISOString() }).eq('id', s.id).select('*').single();
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setServices((prev) => prev.map((row) => (row.id === s.id ? { ...row, status: nextStatus } : row)));
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <BudgetShell active="services" topbarTitle="Services" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-sub">The team&apos;s approved service catalog and pricing.</p>
        </div>
        {isAdmin && (
          <div className="header-actions">
            <button type="button" className="btn btn-accent" onClick={openAddForm}>
              <Icon name="plus" size={14} /> Add Service
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={13} />
          <input placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Category: All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Status: Active</option>
            <option value="archived">Status: Archived</option>
          </select>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '12px 0' }}>লোড হচ্ছে…</p>
      ) : filtered.length === 0 ? (
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="search" />
            </div>
            <div className="empty-title">No matching service found</div>
            <p className="empty-sub">Try another keyword or browse service categories.</p>
            {isAdmin && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={openAddForm}>
                Add Service
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {filtered.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              categoryName={s.category_id ? categoryById.get(s.category_id) : null}
              actions={
                isAdmin ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditForm(s)}>
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => handleToggleArchive(s)}>
                      {s.status === 'active' ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowForm(false);
          }}
        >
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <div className="modal-title">{form.id ? 'Edit Service' : 'Add Service'}</div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="field">
                  <label className="field-label">Service Name</label>
                  <input className="field-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>

                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Category</label>
                    <select
                      className="field-select"
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, newCategoryName: '' }))}
                    >
                      <option value="">Choose category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Or new category</label>
                    <input
                      className="field-input"
                      placeholder="e.g. Branding"
                      value={form.newCategoryName}
                      onChange={(e) => setForm((f) => ({ ...f, newCategoryName: e.target.value, categoryId: '' }))}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Brief</label>
                  <textarea className="field-textarea" value={form.brief} onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))} />
                </div>

                <div className="field">
                  <label className="field-label">Keywords</label>
                  <input className="field-input" placeholder="comma, separated, tags" value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} />
                </div>

                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Starter Minimum</label>
                    <input className="field-input" type="number" min="0" value={form.starterMin} onChange={(e) => setForm((f) => ({ ...f, starterMin: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Starter Maximum</label>
                    <input className="field-input" type="number" min="0" value={form.starterMax} onChange={(e) => setForm((f) => ({ ...f, starterMax: e.target.value }))} />
                  </div>
                </div>
                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Standard Minimum</label>
                    <input className="field-input" type="number" min="0" value={form.standardMin} onChange={(e) => setForm((f) => ({ ...f, standardMin: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Standard Maximum</label>
                    <input className="field-input" type="number" min="0" value={form.standardMax} onChange={(e) => setForm((f) => ({ ...f, standardMax: e.target.value }))} />
                  </div>
                </div>
                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Advanced Minimum</label>
                    <input className="field-input" type="number" min="0" value={form.advancedMin} onChange={(e) => setForm((f) => ({ ...f, advancedMin: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Advanced Maximum</label>
                    <input className="field-input" type="number" min="0" value={form.advancedMax} onChange={(e) => setForm((f) => ({ ...f, advancedMax: e.target.value }))} />
                  </div>
                </div>

                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Currency</label>
                    <select className="field-select" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.id && (
                    <div className="field">
                      <label className="field-label">Status</label>
                      <select className="field-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  )}
                </div>

                {formError && <div className="error-banner" style={{ marginBottom: 0 }}>{formError}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={saving}>
                  {saving ? 'সেভ হচ্ছে…' : form.id ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </BudgetShell>
  );
}
