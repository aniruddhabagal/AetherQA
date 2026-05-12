// Access token is held in module memory — never written to localStorage.
// The AuthProvider calls setAccessToken after login/refresh.

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  const res = await fetch(`/api${path}`, { ...options, headers, credentials: "include" });

  // On 401: attempt a single token refresh and retry
  if (res.status === 401 && _accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed && _accessToken) {
      headers["Authorization"] = `Bearer ${_accessToken}`;
      return fetch(`/api${path}`, { ...options, headers, credentials: "include" });
    }
  }

  return res;
}
