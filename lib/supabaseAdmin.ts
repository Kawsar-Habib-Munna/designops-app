import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// শুধু সার্ভার-সাইড কোডে (API route handler) ইম্পোর্ট করার জন্য — service_role
// কী দিয়ে RLS বাইপাস হয়ে যায়, তাই এই ফাইল কখনো 'use client' কম্পোনেন্টে
// ইম্পোর্ট করা যাবে না।
//
// লেজি ভাবে তৈরি করা হয় (module-scope-এ createClient() কল করা হয় না) যাতে
// SUPABASE_SERVICE_ROLE_KEY এখনো .env.local-এ না বসালেও build/other route
// crash না করে — শুধু এই route actually কল হলেই key মিসিং হলে error দেবে।
let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY সেট করা নেই — .env.local দেখুন।');
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

// team/* admin route-গুলোতে বার বার লাগে: Authorization হেডারের বিয়ারার
// টোকেন যাচাই করে caller-এর profile (বিশেষত is_admin) ফেরত দেয়।
export async function getCallerProfile(supabaseAdmin: SupabaseClient, token: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await supabaseAdmin.from('profiles').select('id, is_admin').eq('id', userData.user.id).single();
  if (!profile) return null;

  return { userId: userData.user.id, isAdmin: !!profile.is_admin };
}
