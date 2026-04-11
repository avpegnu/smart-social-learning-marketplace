'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth-store';

/**
 * Fetches a file through the backend proxy (bypasses Cloudinary delivery restrictions)
 * and returns a local blob URL safe for use in <iframe>, <img>, etc.
 *
 * The blob URL is automatically revoked when the component unmounts.
 */
export function useFileProxy(fileUrl: string | null): {
  blobUrl: string | null;
  loading: boolean;
  error: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    const token = useAuthStore.getState().accessToken;
    const proxyUrl = `${apiUrl}/media/proxy?url=${encodeURIComponent(fileUrl)}`;

    setLoading(true);
    setError(false);
    setBlobUrl(null);

    fetch(proxyUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Proxy error ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  return { blobUrl, loading, error };
}
