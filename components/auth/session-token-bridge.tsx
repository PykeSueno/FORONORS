'use client';

import { useEffect } from 'react';

const COOKIE_NAME = 'foronors_session';
const TOKEN_KEY = 'foronors_session_token';

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function syncCookieFromToken() {
  const token = readToken();
  if (!token) return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function SessionTokenBridge() {
  useEffect(() => {
    syncCookieFromToken();

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = readToken();
      if (!token) return originalFetch(input, init);

      const nextHeaders = new Headers(init?.headers);
      if (!nextHeaders.has('authorization')) nextHeaders.set('authorization', `Bearer ${token}`);
      if (!nextHeaders.has('x-fivem-session')) nextHeaders.set('x-fivem-session', token);

      return originalFetch(input, {
        ...init,
        credentials: init?.credentials ?? 'include',
        headers: nextHeaders
      });
    }) as typeof window.fetch;

    const onFocus = () => syncCookieFromToken();
    window.addEventListener('focus', onFocus);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
