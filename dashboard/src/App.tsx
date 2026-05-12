import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { LayoutDashboard, Play, FileText, Activity, Bug, Database } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { RunTrigger } from "./pages/RunTrigger.js";
import { SpecReview } from "./pages/SpecReview.js";
import { RunMonitor } from "./pages/RunMonitor.js";
import { FailureTriage } from "./pages/FailureTriage.js";
import { MemoryInspector } from "./pages/MemoryInspector.js";
import { Landing } from "./pages/Landing.js";
import { Login } from "./pages/auth/Login.js";
import { Register } from "./pages/auth/Register.js";

const NAV_ITEMS = [
  { to: "/app", icon: Play, label: "Run" },
  { to: "/app/specs", icon: FileText, label: "Specs" },
  { to: "/app/monitor", icon: Activity, label: "Monitor" },
  { to: "/app/triage", icon: Bug, label: "Triage" },
  { to: "/app/memory", icon: Database, label: "Memory" },
] as const;

function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "24px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "0 24px 28px" }}>
          <NavLink to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <LayoutDashboard size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "var(--text-base)",
                color: "var(--color-text)",
                letterSpacing: "-0.01em",
              }}
            >
              AetherQA
            </span>
          </NavLink>
        </div>

        <div style={{ flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/app"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 24px",
                textDecoration: "none",
                color: isActive ? "var(--color-accent)" : "var(--color-text-sub)",
                background: isActive ? "var(--color-accent-light)" : "transparent",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                fontWeight: isActive ? 600 : 400,
                borderRight: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                transition: "color 0.15s, background 0.15s",
              })}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </div>

        <div
          style={{
            padding: "16px 24px 0",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {user && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-sub)", marginBottom: "2px", fontFamily: "var(--font-mono)" }}>
                {user.email}
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", fontWeight: 500 }}>
                {user.name}
              </p>
            </div>
          )}
          <button
            onClick={() => void logout()}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-sub)",
              fontFamily: "var(--font-body)",
            }}
          >
            Sign out
          </button>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-sub)", fontFamily: "var(--font-mono)", marginTop: "8px" }}>
            v1.0.0 — Week 6
          </p>
        </div>
      </nav>

      <main style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route index element={<RunTrigger />} />
          <Route path="specs" element={<SpecReview />} />
          <Route path="monitor" element={<RunMonitor />} />
          <Route path="monitor/:runId" element={<RunMonitor />} />
          <Route path="triage" element={<FailureTriage />} />
          <Route path="memory" element={<MemoryInspector />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />

          {/* Protected */}
          <Route
            path="/app/*"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
