export function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem('gst_session_id');
  } catch (e) {
    return null;
  }
}

export function setStoredSessionId(sessionId: string): void {
  try {
    localStorage.setItem('gst_session_id', sessionId);
  } catch (e) {
    console.warn('Could not store session ID:', e);
  }
}

export function removeStoredSessionId(): void {
  try {
    localStorage.removeItem('gst_session_id');
  } catch (e) {
    console.warn('Could not remove session ID:', e);
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const sessionId = getStoredSessionId();
  const headers = new Headers(init?.headers || {});

  if (sessionId && !headers.has('x-session-id')) {
    headers.set('x-session-id', sessionId);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
