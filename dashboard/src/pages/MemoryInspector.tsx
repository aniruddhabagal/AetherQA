import { useState } from "react";
import {
  Search,
  Trash2,
  Brain,
  Zap,
  Plus,
  AlertCircle,
  Loader2,
  X,
  Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  id: string;
  memory: string;
  created_at?: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function searchAgentMemory(query: string): Promise<MemoryEntry[]> {
  const res = await fetch(
    `/api/memory/agent?query=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const body = (await res.json()) as { memories: MemoryEntry[] };
  return body.memories ?? [];
}

async function deleteAgentMemory(id: string): Promise<void> {
  const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

async function fetchCriticalFlows(userId: string): Promise<MemoryEntry[]> {
  const res = await fetch(
    `/api/memory/user?query=${encodeURIComponent("critical flows always run smoke")}&userId=${encodeURIComponent(userId)}`,
  );
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const body = (await res.json()) as { memories: MemoryEntry[] };
  return body.memories ?? [];
}

async function addCriticalFlow(route: string, userId: string): Promise<void> {
  const res = await fetch("/api/memory/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `critical flows always run smoke: ${route}`,
      userId,
    }),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

async function deleteCriticalFlow(id: string): Promise<void> {
  const res = await fetch(`/api/memory/user/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Brain;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--color-accent)" : "transparent"}`,
        background: "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        fontWeight: active ? 600 : 400,
        fontSize: "var(--text-sm)",
        color: active ? "var(--color-accent)" : "var(--color-text-sub)",
        transition: "color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}

function MemoryRow({
  entry,
  onDelete,
  deleting,
}: {
  entry: MemoryEntry;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--color-border)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background =
          "var(--color-bg)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            lineHeight: 1.55,
            marginBottom: entry.created_at ? 4 : 0,
            wordBreak: "break-word",
          }}
        >
          {entry.memory}
        </p>
        {entry.created_at && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-sub)",
            }}
          >
            {new Date(entry.created_at).toLocaleString()}
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        disabled={deleting}
        title="Remove this memory"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          background: "none",
          cursor: deleting ? "not-allowed" : "pointer",
          color: deleting ? "var(--color-text-sub)" : "var(--color-fail)",
          flexShrink: 0,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!deleting)
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--color-fail)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--color-border)";
        }}
      >
        {deleting ? (
          <Loader2 size={13} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <Trash2 size={13} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--color-text-sub)",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
      }}
    >
      {message}
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 8,
        background: "var(--color-accent-light)",
        border: "1px solid var(--color-accent)",
        marginBottom: 24,
      }}
    >
      <Info
        size={15}
        strokeWidth={1.5}
        color="var(--color-accent)"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--color-accent)",
          fontFamily: "var(--font-body)",
          lineHeight: 1.55,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 8,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        marginBottom: 20,
      }}
    >
      <AlertCircle
        size={15}
        strokeWidth={1.5}
        color="var(--color-fail)"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-fail)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {message}
      </p>
    </div>
  );
}

// ─── System Memory Tab ────────────────────────────────────────────────────────

function SystemMemoryTab() {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const results = await searchAgentMemory(
        query.trim() || "app structure routes flows overlays bugs",
      );
      setMemories(results);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteAgentMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div>
      <InfoBanner>
        Agent memory persists across all runs. Delete incorrect facts if the
        system learned something wrong — for example, a false positive stored as
        a real bug, or an outdated route structure.
      </InfoBanner>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={15}
            strokeWidth={1.5}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-sub)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="voice routes, flaky selectors, known bugs…"
            style={{
              width: "100%",
              padding: "9px 14px 9px 36px",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--color-accent)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--color-border)")
            }
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 20px",
            background: loading ? "var(--color-border)" : "var(--color-accent)",
            color: loading ? "var(--color-text-sub)" : "#fff",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!loading)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!loading)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent)";
          }}
        >
          {loading ? (
            <Loader2 size={14} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Search size={14} strokeWidth={1.5} />
          )}
          Search
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Results */}
      {!searched && !loading && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-sub)",
            fontFamily: "var(--font-body)",
            textAlign: "center",
            paddingTop: 32,
          }}
        >
          Enter a query above and press Search to inspect system memory.
        </p>
      )}

      {searched && memories.length === 0 && !loading && (
        <EmptyState message="No memories matched your query. The system may not have learned anything related to this topic yet." />
      )}

      {memories.length > 0 && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px",
              background: "var(--color-tag-bg)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-sub)",
              }}
            >
              {memories.length} result{memories.length !== 1 ? "s" : ""}
            </span>
          </div>
          {memories.map((m) => (
            <MemoryRow
              key={m.id}
              entry={m}
              onDelete={() => handleDelete(m.id)}
              deleting={deletingIds.has(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Smoke Mode Tab ───────────────────────────────────────────────────────────

function SmokeModeTab() {
  const [flows, setFlows] = useState<MemoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newRoute, setNewRoute] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const userId = "default";

  async function loadFlows() {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchCriticalFlows(userId);
      setFlows(results);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const route = newRoute.trim();
    if (!route) return;
    if (!route.startsWith("/")) {
      setError("Route must start with /");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addCriticalFlow(route, userId);
      setNewRoute("");
      await loadFlows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add flow");
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteCriticalFlow(id);
      setFlows((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove flow");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Load on first render
  if (!loaded && !loading) {
    void loadFlows();
  }

  return (
    <div>
      <InfoBanner>
        Critical flows run on every smoke test. Define the 10–15 most important
        routes here — login, core user journeys, key API-heavy pages. Smoke
        runs skip everything else for speed.
      </InfoBanner>

      {/* Add new flow */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          value={newRoute}
          onChange={(e) => setNewRoute(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="/login  or  /dashboard  or  /checkout"
          style={{
            flex: 1,
            padding: "9px 14px",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = "var(--color-accent)")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = "var(--color-border)")
          }
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newRoute.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 20px",
            background:
              adding || !newRoute.trim()
                ? "var(--color-border)"
                : "var(--color-accent)",
            color:
              adding || !newRoute.trim() ? "var(--color-text-sub)" : "#fff",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            cursor: adding || !newRoute.trim() ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!adding && newRoute.trim())
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!adding && newRoute.trim())
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent)";
          }}
        >
          {adding ? (
            <Loader2 size={14} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Plus size={14} strokeWidth={1.5} />
          )}
          Add Flow
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Flows list */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-text-sub)", padding: "24px 0" }}>
          <Loader2 size={16} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: "var(--text-sm)", fontFamily: "var(--font-body)" }}>
            Loading critical flows…
          </span>
        </div>
      )}

      {!loading && loaded && flows.length === 0 && (
        <EmptyState message="No critical flows defined. Add route paths above — they will run on every smoke test." />
      )}

      {!loading && flows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px",
              background: "var(--color-tag-bg)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={13} strokeWidth={1.5} color="var(--color-warn)" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-sub)",
                }}
              >
                {flows.length} flow{flows.length !== 1 ? "s" : ""} — run on every smoke test
              </span>
            </div>
          </div>
          {flows.map((m) => {
            // Extract just the route path from the stored memory string
            const routeMatch = m.memory.match(/(\/\S+)/);
            const displayRoute = routeMatch?.[1] ?? m.memory;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--color-border)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    "var(--color-bg)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    "transparent")
                }
              >
                <code
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text)",
                  }}
                >
                  {displayRoute}
                </code>
                {m.created_at && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-sub)",
                    }}
                  >
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingIds.has(m.id)}
                  title="Remove this flow"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    background: "none",
                    cursor: deletingIds.has(m.id) ? "not-allowed" : "pointer",
                    color: deletingIds.has(m.id)
                      ? "var(--color-text-sub)"
                      : "var(--color-fail)",
                    flexShrink: 0,
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!deletingIds.has(m.id))
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--color-fail)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--color-border)";
                  }}
                >
                  {deletingIds.has(m.id) ? (
                    <Loader2 size={12} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <X size={12} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "system" | "smoke";

export function MemoryInspector() {
  const [tab, setTab] = useState<Tab>("system");

  return (
    <div style={{ padding: "40px 48px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Memory Inspector
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-sub)",
            fontFamily: "var(--font-body)",
          }}
        >
          What the system has learned about your app across all runs.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 28,
          gap: 0,
        }}
      >
        <TabButton
          active={tab === "system"}
          onClick={() => setTab("system")}
          icon={Brain}
          label="System Memory"
        />
        <TabButton
          active={tab === "smoke"}
          onClick={() => setTab("smoke")}
          icon={Zap}
          label="Smoke Mode — Critical Flows"
        />
      </div>

      {/* Content */}
      {tab === "system" && <SystemMemoryTab />}
      {tab === "smoke" && <SmokeModeTab />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
