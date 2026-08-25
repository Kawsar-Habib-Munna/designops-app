// Budget & Quote Generator-এর deterministic মেসেজ রেন্ডারার (কোনো AI API না,
// স্পেক §13-এর দাবি অনুযায়ী)। {{variable}}-স্টাইল প্লেসহোল্ডার — অচেনা
// ভ্যারিয়েবল থাকলে খালি স্ট্রিং দিয়ে রিপ্লেস হয়, কখনো crash করে না (স্পেক §26)।
//
// greeting_line আলাদা করে কম্পিউট করা হয় কারণ client_name খালি থাকলে পুরো
// প্রথম লাইনটাই বদলে যায় ("Hi [নাম]," → "Hello,") — শুধু ভ্যারিয়েবল
// সাবস্টিটিউশন দিয়ে এটা করা যায় না।

export type BudgetPackageKey = 'starter' | 'standard' | 'advanced';

export type BudgetMessageVars = {
  client_name: string;
  service_name: string;
  service_brief: string;
  starter_price: string;
  standard_price: string;
  advanced_price: string;
  team_name: string;
  price_block: string;
  greeting_line: string;
};

export function buildGreetingLine(clientName: string): string {
  const trimmed = clientName.trim();
  return trimmed ? `Hi ${trimmed},` : 'Hello,';
}

export function buildPriceBlock(prices: { key: BudgetPackageKey; label: string; range: string }[], selected: BudgetPackageKey[]): string {
  return prices
    .filter((p) => selected.includes(p.key))
    .map((p) => `${p.label}: ${p.range}${p.key === 'standard' ? ' — Recommended' : ''}`)
    .join('\n');
}

export function renderBudgetMessage(template: string, vars: BudgetMessageVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in vars ? vars[key as keyof BudgetMessageVars] : '';
  });
}

export type MessageStyle = 'professional' | 'friendly' | 'short' | 'whatsapp';

export const MESSAGE_STYLE_LABEL: Record<MessageStyle, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  short: 'Short',
  whatsapp: 'WhatsApp',
};

// admin সেটিংস (Phase 7) থেকে budget_message_templates এডিট করা না হলে এই
// ডিফল্টগুলোই ব্যবহার হয় — টেবিলটা ফেজ ২২-এ ঠিক এই টেক্সটগুলো দিয়েই সিড করা।
export const DEFAULT_MESSAGE_TEMPLATES: Record<MessageStyle, string> = {
  professional: `{{greeting_line}}

Thank you for sharing your requirements with us.

Based on your requirements, we recommend our {{service_name}} service.

{{service_brief}}

Estimated Budget
{{price_block}}

The final quotation may vary depending on the number of pages/screens, functionality, user flows, responsive requirements and overall project complexity.

Once we review the complete requirements, we can provide a fixed quotation and estimated timeline.

Best regards,
{{team_name}}`,
  friendly: `{{greeting_line}}

Thanks so much for reaching out about your project!

Based on what you're looking for, our {{service_name}} package would be a great fit.

{{service_brief}}

Here's a quick look at the investment:
{{price_block}}

Keep in mind these are estimated ranges — once we go over the full details together, we'll lock in an exact price and timeline.

Talk soon,
{{team_name}}`,
  short: `{{greeting_line}}

For {{service_name}}, our estimated pricing is:
{{price_block}}

Happy to share more details or hop on a quick call — just let us know!

{{team_name}}`,
  whatsapp: `{{greeting_line}}

For *{{service_name}}*, here's our estimated pricing:

{{price_block}}

Let me know if you'd like more details!
— {{team_name}}`,
};
