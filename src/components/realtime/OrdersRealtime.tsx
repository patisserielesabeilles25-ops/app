'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to changes on the orders table and refreshes the current route
 * when an order changes. Debounced to coalesce bursts. Realtime honors RLS, and
 * only the non-sensitive orders table is published — finance data is never
 * broadcast.
 *
 * Uses a unique channel topic per mount so React Strict Mode's double-mount (and
 * HMR) can't collide two subscriptions on the same topic.
 */
export function OrdersRealtime() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Generate the topic INSIDE the effect so Strict Mode's double-mount (and
    // HMR) never reuse the same topic on overlapping subscribe/remove cycles.
    const topic = `orders-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => router.refresh(), 300);
          },
        )
        .subscribe();
    });

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
