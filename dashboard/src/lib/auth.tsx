import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type ReactElement,
} from "react";
import { setAccessToken } from "./api.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  orgName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

function applyAuthResponse(data: AuthResponse, setUser: (u: AuthUser) => void): void {
  setAccessToken(data.accessToken);
  setUser(data.user);
}

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore the session using the httpOnly refresh token cookie.
  // If the cookie is present and valid, the server issues a new access token.
  const restoreSession = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as AuthResponse;
      applyAuthResponse(data, setUser);
    } catch {
      // No valid session — user stays logged out
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error ?? "Login failed");
    }
    applyAuthResponse((await res.json()) as AuthResponse, setUser);
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<void> => {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error ?? "Registration failed");
    }
    applyAuthResponse((await res.json()) as AuthResponse, setUser);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
