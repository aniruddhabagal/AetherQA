import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Globe,
  Zap,
  Layers,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

type RunMode = "full" | "smoke" | "feature";

const MODE_CONFIG: Record<
  RunMode,
  { icon: typeof Play; label: string; description: string }
> = {
  full: {
    icon: Layers,
    label: "Full",
    description: "All known routes, full spec suite, complete API coverage.",
  },
  smoke: {
    icon: Zap,
    label: "Smoke",
    description: "Critical flows only — fast confidence check before release.",
  },
  feature: {
    icon: Play,
    label: "Feature",
    description: "Scope to a new feature. Explorer maps blast radius via git.",
  },
};

export function RunTrigger() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<RunMode>("full");
  const [targetUrl, setTargetUrl] = useState(
    (import.meta as unknown as { env: Record<string, string> }).env
      .VITE_DEFAULT_URL ?? "https://staging.yourapp.com",
  );
  const [featureDesc, setFeatureDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !loading && targetUrl.trim().length > 0 && (mode !== "feature" || featureDesc.trim().length > 0);

  async function handleRun() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          runMode: mode,
          featureDescription: featureDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const { runId } = (await res.json()) as { runId: string };
      navigate(`/app/specs?runId=${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
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
          New QA Run
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-sub)",
          }}
        >
          Configure and trigger the agent pipeline against your staging environment.
        </p>
      </div>

      {/* Target URL */}
      <Section label="Target URL">
        <div style={{ position: "relative" }}>
          <Globe
            size={16}
            strokeWidth={1.5}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-sub)",
              pointerEvents: "none",
            }}
          />
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://staging.yourapp.com"
            style={{
              width: "100%",
              padding: "10px 14px 10px 40px",
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
        </div>
      </Section>

      {/* Run mode selector */}
      <Section label="Run Mode">
        <div style={{ display: "flex", gap: 12 }}>
          {(Object.keys(MODE_CONFIG) as RunMode[]).map((m) => {
            const { icon: Icon, label, description } = MODE_CONFIG[m];
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "16px",
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                  borderRadius: 12,
                  background: active
                    ? "var(--color-accent-light)"
                    : "var(--color-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    color={
                      active ? "var(--color-accent)" : "var(--color-text-sub)"
                    }
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: active ? 600 : 400,
                      fontSize: "var(--text-sm)",
                      color: active
                        ? "var(--color-accent)"
                        : "var(--color-text)",
                    }}
                  >
                    {label}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-sub)",
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Feature description (feature mode only) */}
      {mode === "feature" && (
        <Section label="Feature Description">
          <textarea
            value={featureDesc}
            onChange={(e) => setFeatureDesc(e.target.value)}
            placeholder="Describe the new feature: what it does, which routes it adds or changes, which API endpoints it introduces..."
            rows={5}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.6,
              resize: "vertical",
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
          <p
            style={{
              marginTop: 6,
              fontSize: "var(--text-xs)",
              color: "var(--color-text-sub)",
            }}
          >
            The Scoper agent uses this description to resolve blast radius from git diff.
          </p>
        </Section>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            marginBottom: 24,
          }}
        >
          <AlertCircle
            size={16}
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
            {error}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleRun}
        disabled={!canSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          background: canSubmit ? "var(--color-accent)" : "var(--color-border)",
          color: canSubmit ? "#fff" : "var(--color-text-sub)",
          border: "none",
          borderRadius: 8,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (canSubmit)
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-accent-hover)";
        }}
        onMouseLeave={(e) => {
          if (canSubmit)
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-accent)";
        }}
      >
        {loading ? (
          <Loader2 size={16} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <ChevronRight size={16} strokeWidth={1.5} />
        )}
        {loading ? "Starting run..." : "Start Run"}
      </button>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <label
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          color: "var(--color-text)",
          marginBottom: 10,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
