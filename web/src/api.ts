import { useEffect, useState } from 'react';

export async function getJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'We couldn’t find this page.' : 'The dashboard couldn’t load data.');
  }
  return response.json();
}

type Load<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: T };

export function useJson<T>(path: string): Load<T> {
  const [result, setResult] = useState<{ path: string; value: Load<T> }>();
  useEffect(() => {
    const controller = new AbortController();
    getJson<T>(path, { signal: controller.signal }).then(
      (data) => setResult({ path, value: { kind: 'ready', data } }),
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ path, value: { kind: 'error', message: error.message } });
      },
    );
    return () => controller.abort();
  }, [path]);
  return result?.path === path ? result.value : { kind: 'loading' };
}
