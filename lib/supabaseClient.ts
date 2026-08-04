import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This single client is imported everywhere you need to talk to Supabase
// (fetching tasks, subscribing to realtime changes, auth, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
