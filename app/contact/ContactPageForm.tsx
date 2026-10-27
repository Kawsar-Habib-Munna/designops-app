'use client';

import { useState } from 'react';
import { DEFAULT_SITE_SETTINGS, buildWhatsappUrl } from '@/lib/siteSettings';

// /contact পেজের ফর্ম - app/components/ContactForm.tsx-এর থেকে আলাদা কারণ
// Figma-তে (node 2718:4970) ফিল্ড সেট ভিন্ন (Full Name/Email/Project Budget/
// Whatsapp Number/Project Details, Phone/Subject/Message না)। visual স্টাইল
// (2-column grid + full-width textarea + gradient button) আর সাবমিট-লজিক
// (কোনো নতুন ব্যাকএন্ড ছাড়াই, prefilled wa.me লিংক) হুবহু ContactForm.tsx-এর
// মতোই - একই home.css ক্লাস (.contact-form/.contact-field*/.contact-submit)
// রিইউজ করা হয়েছে।
export default function ContactPageForm({ whatsappNumber = DEFAULT_SITE_SETTINGS.bookCallPhone }: { whatsappNumber?: string }) {
  const [values, setValues] = useState({ name: '', email: '', budget: '', whatsapp: '', details: '' });

  function update(key: keyof typeof values) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = [
      `Hi FLOW53, I'd like to get in touch.`,
      values.name && `Name: ${values.name}`,
      values.email && `Email: ${values.email}`,
      values.budget && `Project Budget: ${values.budget}`,
      values.whatsapp && `Whatsapp Number: ${values.whatsapp}`,
      values.details && `Project Details: ${values.details}`,
    ].filter(Boolean);
    const url = buildWhatsappUrl(whatsappNumber, lines.join('\n'));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form-grid">
        <label className="contact-field">
          <span className="contact-field-label">Full Name</span>
          <input className="contact-field-input" type="text" placeholder="Enter your name" required value={values.name} onChange={update('name')} />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Email</span>
          <input className="contact-field-input" type="email" placeholder="Enter your email" required value={values.email} onChange={update('email')} />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Project Budget</span>
          <input className="contact-field-input" type="text" placeholder="Enter your budget" value={values.budget} onChange={update('budget')} />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Whatsapp Number</span>
          <input className="contact-field-input" type="tel" placeholder="Enter your whatsapp number" value={values.whatsapp} onChange={update('whatsapp')} />
        </label>
      </div>
      <label className="contact-field">
        <span className="contact-field-label">Project Details</span>
        <textarea className="contact-field-input contact-field-textarea" placeholder="Tell us about your project" required value={values.details} onChange={update('details')} />
      </label>
      <button type="submit" className="contact-submit">
        <span>Send Inquiry</span>
        <span className="contact-submit-icon" aria-hidden="true" />
      </button>
    </form>
  );
}
