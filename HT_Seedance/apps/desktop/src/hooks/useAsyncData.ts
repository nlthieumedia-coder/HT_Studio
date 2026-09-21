import { useCallback, useEffect, useState } from 'react';

export interface AsyncData<T> { data: T | null; loading: boolean; error: string | null; reload: () => void; }

export function useAsyncData<T>(loader: () => Promise<T>): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loader().then((value) => { if (active) { setData(value); setError(null); } }).catch(() => { if (active) setError('Unable to load this view. Please try again.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader, revision]);
  return { data, loading, error, reload };
}
