'use client';

// সাইডবার/টপবারের বেল আইকনে real unread notification count দেখানোর জন্য —
// প্রতিটা পেজের নিজস্ব বেল আইকন এই হুক দিয়ে সত্যিকারের সংখ্যা দেখায় (আগে কিছু
// পেজে একটা স্ট্যাটিক লাল ডট সবসময় দেখাত, আসল অবস্থা নির্বিশেষে — এখন বাদ)।

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

export function useUnreadCount(user: User | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { count: c } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .eq('is_read', false);
      if (!cancelled) setCount(c ?? 0);
    }
    load();

    const channel = supabase
      .channel(`notif-count-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return user ? count : 0;
}
