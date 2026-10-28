'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// The last known user, kept for the lifetime of the tab. A page that mounts after navigation starts from it instead of
// blanking while the session is looked up again, so moving between dashboard pages does not flash an empty content area.
// (undefined = the session has not been fetched yet.)
let cachedUser: User | null | undefined;

export function useSession() {
  const [user, setUser] = useState<User | null>(cachedUser ?? null);
  const [loading, setLoading] = useState(cachedUser === undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      cachedUser = data.user;
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedUser = session?.user ?? null;
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
