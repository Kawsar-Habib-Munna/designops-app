'use client';

// একটা সার্ভিসের প্রাইসিং কার্ড — Overview-এর সার্চ রেজাল্ট আর Services
// লাইব্রেরি দুই জায়গাতেই ব্যবহৃত (spec §38-এর ServiceCard/ServicePricing
// রেকমেন্ডেশন)। Standard tier "Recommended" ব্যাজ পায়, Advanced tier-এর
// ম্যাক্স প্রাইসের পাশে "+" (প্রাইসিং শিটে প্রতিটা Advanced রেঞ্জের সাথেই
// ছিল — ওপেন-এন্ডেড, ডেটার অংশ না শুধু ডিসপ্লে কনভেনশন)।

import Link from 'next/link';
import { formatBudgetRange } from '@/lib/budgetFormat';

export type ServiceCardData = {
  id: string;
  name: string;
  brief: string | null;
  starter_min: number | null;
  starter_max: number | null;
  standard_min: number | null;
  standard_max: number | null;
  advanced_min: number | null;
  advanced_max: number | null;
  currency: string;
};

export default function ServiceCard({ service, categoryName, actions }: { service: ServiceCardData; categoryName?: string | null; actions?: React.ReactNode }) {
  return (
    <div className="dcard service-card">
      <div className="service-card-head">
        <div>
          <div className="service-card-name">{service.name}</div>
          {categoryName && <div className="service-card-category">{categoryName}</div>}
        </div>
        {actions}
      </div>
      {service.brief && <p className="service-card-brief">{service.brief}</p>}

      <div className="service-tier-grid">
        <div className="service-tier">
          <span className="service-tier-label">Starter</span>
          <span className="service-tier-price tabular">{formatBudgetRange(service.starter_min, service.starter_max, service.currency)}</span>
        </div>
        <div className="service-tier recommended">
          <span className="service-tier-label">
            Standard <span className="recommended-badge">Recommended</span>
          </span>
          <span className="service-tier-price tabular">{formatBudgetRange(service.standard_min, service.standard_max, service.currency)}</span>
        </div>
        <div className="service-tier">
          <span className="service-tier-label">Advanced</span>
          <span className="service-tier-price tabular">{formatBudgetRange(service.advanced_min, service.advanced_max, service.currency, true)}</span>
        </div>
      </div>

      <Link href={`/budget/new?service=${service.id}`} className="btn btn-accent btn-sm btn-block" style={{ marginTop: 14 }}>
        Generate Quote
      </Link>
    </div>
  );
}
