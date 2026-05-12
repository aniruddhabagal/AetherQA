import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import type { ReactNode, ReactElement } from "react";

export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--color-bg)",
          fontFamily: "var(--font-body)",
          color: "var(--color-text-sub)",
          fontSize: "var(--text-sm)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
