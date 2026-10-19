import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

type Fetch<T> = () => PromiseLike<{ data: T | null; error: { message: string } | null }>;

/**
 * Runs a query and runs it again whenever one of `tables` changes (Supabase Realtime).
 * `key` identifies the query's inputs: the query reruns when it changes, and null skips it.
 */
export function useLive<T>(key: string | null, fetch: Fetch<T>, tables: string[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(key !== null);
  const [error, setError] = useState<Error | null>(null);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const tableList = tables.join(',');

  const refresh = useCallback(async () => {
    const { data, error } = await fetchRef.current();
    if (error) {
      console.error(error);
      setError(new Error(error.message));
    } else {
      setData(data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (key === null) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`);
    // An empty list means "don't refetch on changes", not "every table".
    for (const table of tableList.split(',').filter(Boolean)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 150);
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [key, tableList, refresh]);

  return { data, loading, error, refresh };
}

/** useLive for lists: data is never null. */
export function useRows<T>(key: string | null, fetch: Fetch<T[]>, tables: string[]) {
  const live = useLive<T[]>(key, fetch, tables);
  return { ...live, data: live.data ?? [] };
}
