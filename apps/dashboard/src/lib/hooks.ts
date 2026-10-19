"use client";

import { doc, onSnapshot, type DocumentData, type Query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "./firebase";

export type WithId<T> = T & { id: string };

/** Live query results. Build the query with useMemo; pass null to skip. */
export function useQuery<T = DocumentData>(q: Query | null) {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError(e);
        setLoading(false);
      },
    );
  }, [q]);

  return { data, loading, error };
}

/** Live single document. Pass null to skip. */
export function useDocument<T = DocumentData>(path: string | null) {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, path),
      (snap) => {
        setData(snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [path]);

  return { data, loading };
}
