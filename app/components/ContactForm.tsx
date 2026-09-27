'use client';

import { useState } from 'react';

// Figma-র form-এ (node 918:3546) লেবেলগুলো unfinished placeholder ছিল - দুই সারিতেই
// "Full Name"/"Email" পুনরাবৃত্তি আর টেক্সটএরিয়ার প্লেসহোল্ডারে টাইপো ("Enter your
// namexz")। ভিজ্যুয়াল লেআউট (2-column grid + full-width textarea + gradient button)
// হুবহু রাখা হয়েছে, কিন্তু real ভিজিটর যেন আসলে ফর্মটা ব্যবহার করতে পারে তার জন্য
// লেবেলগুলো অর্থপূর্ণ করা হয়েছে (Name/Email/Phone/Subject/Message)। সাবমিটে কোনো
// নতুন backend বানানো হয়নি - সাইটের বিদ্যমান লিড-জেন চ্যানেল (WhatsApp, BookCallButton-
// এ যেভাবে ব্যবহৃত) reuse করে ফর্মের তথ্য প্রি-ফিলড মেসেজ আকারে wa.me লিংকে পাঠানো হয়।
const WHATSAPP_NUMBER = '8801804409235';

export default function ContactForm() {
  const [values, setValues] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

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
      values.phone && `Phone: ${values.phone}`,
      values.subject && `Subject: ${values.subject}`,
      values.message && `Message: ${values.message}`,
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
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
          <span className="contact-field-label">Phone Number</span>
          <input className="contact-field-input" type="tel" placeholder="Enter your phone number" value={values.phone} onChange={update('phone')} />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Subject</span>
          <input className="contact-field-input" type="text" placeholder="What's this about?" value={values.subject} onChange={update('subject')} />
        </label>
      </div>
      <label className="contact-field">
        <span className="contact-field-label">Message</span>
        <textarea className="contact-field-input contact-field-textarea" placeholder="Tell us about your project" required value={values.message} onChange={update('message')} />
      </label>
      <button type="submit" className="contact-submit">
        <span>Send Inquiry</span>
        <img src="/faq/arrow-send.svg" alt="" />
      </button>
    </form>
  );
}
