import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { LayoutDashboard, Play, FileText, Activity, Bug, Database } from "lucide-react";
import { RunTrigger } from "./pages/RunTrigger.js";
import { SpecReview } from "./pages/SpecReview.js";
import { RunMonitor } from "./pages/RunMonitor.js";

// Placeholder pages for Week 3–5
function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--color-text-sub)" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
        {label} — coming in a future week
      </p>
    </div>
  );
}

const NAV_ITEMS = [
  { to: "/", icon: Play, label: "Run" },
  { to: "/specs", icon: FileText, label: "Specs" },
  { to: "/monitor", icon: Activity, label: "Monitor" },
  { to: "/triage", icon: Bug, label: "Triage" },
  { to: "/memory", icon: Database, label: "Memory" },
] as const;

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
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
          {/* Logo */}
          <div style={{ padding: "0 24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LayoutDashboard
                size={20}
                color="var(--color-accent)"
                strokeWidth={1.5}
              />
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
            </div>
          </div>

          {/* Nav links */}
          <div style={{ flex: 1 }}>
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
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

          {/* Version */}
          <div
            style={{
              padding: "16px 24px 0",
              borderTop: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-sub)",
              fontFamily: "var(--font-mono)",
            }}
          >
            v1.0.0 — Week 3
          </div>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflow: "auto" }}>
          <Routes>
            <Route path="/" element={<RunTrigger />} />
            <Route path="/specs" element={<SpecReview />} />
            <Route path="/monitor" element={<RunMonitor />} />
            <Route path="/monitor/:runId" element={<RunMonitor />} />
            <Route path="/triage" element={<ComingSoon label="Failure Triage" />} />
            <Route path="/memory" element={<ComingSoon label="Memory Inspector" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
