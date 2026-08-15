import { supabase } from './supabaseClient';

// Client Portal-এর প্রতিটা পেজে (sign-in redirect, onboarding guard, dashboard)
// বার বার লাগে: লগইন করা ইউজারের নিজের clients রো + requirements জমা হয়েছে
// কিনা যাচাই করা — তাই এখানে শেয়ার্ড করা হলো, বাকি সব পেজের CSS/UI নিজস্বই থাকে।

export type ClientRecord = {
  id: string;
  user_id: string;
  company_name: string;
  primary_contact: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  website: string | null;
  designation: string | null;
  company_size: string | null;
  status: string;
};

export async function fetchOwnClient(): Promise<ClientRecord | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from('clients')
    .select('id, user_id, company_name, primary_contact, contact_email, contact_phone, industry, website, designation, company_size, status')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  return (data as ClientRecord) ?? null;
}

export async function hasSubmittedRequirements(clientId: string): Promise<boolean> {
  const { data } = await supabase.from('client_requirements').select('id').eq('client_id', clientId).maybeSingle();
  return !!data;
}

// সাইন-ইন/রেজিস্ট্রেশনের পর ক্লায়েন্ট কোথায় যাবে সেটার single source of truth —
// onboarding সম্পূর্ণ না করা থাকলে সেখানে পাঠায়, নাহলে ড্যাশবোর্ডে।
export async function resolveClientLandingRoute(): Promise<string> {
  const client = await fetchOwnClient();
  if (!client) return '/client/register';
  const submitted = await hasSubmittedRequirements(client.id);
  return submitted ? '/client/dashboard' : '/client/onboarding';
}
