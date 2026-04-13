import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  Edit3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestSpec {
  id: string;
  title: string;
  module: string;
  bucket: "feature" | "regression";
  content: string;
  testTypes: string[];
  autoApproved: boolean;
}

interface RunState {
  runId: string;
  testSpecs: TestSpec[] | null;
  specsApproved: boolean;
  currentAgent: string;
  errors: string[];
  startedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchRunState(runId: string): Promise<RunState> {
  const res = await fetch(`/api/runs/${runId}/results`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<RunState>;
}

async function approveSpecs(runId: string, approvedSpecs: TestSpec[]): Promise<void> {
  const res = await fetch(`/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvedSpecs }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
}

function agentLabel(agent: string): string {
  const labels: Record<string, string> = {
    explorer: "Explorer — crawling app",
    testcase: "Test Case — generating specs",
    scoper: "Scoper — mapping blast radius",
  };
  return labels[agent] ?? `Running agent: ${agent}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeTag({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    UI: { bg: "var(--color-accent-light)", color: "var(--color-accent)" },
    voice: { bg: "#EFF6FF", color: "#2563EB" },
    API: { bg: "#FEF3C7", color: "#92400E" },
  };
  const style = colors[type] ?? { bg: "var(--color-tag-bg)", color: "var(--color-text-sub)" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        background: style.bg,
        color: style.color,
      }}
    >
      {type}
    </span>
  );
}

function PriorityBadge({ content }: { content: string }) {
  const match = content.match(/\*\*Priority:\*\*\s*(\w+)/i);
  const priority = match?.[1]?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    critical: "var(--color-fail)",
    high: "var(--color-warn)",
    medium: "var(--color-text-sub)",
    low: "var(--color-text-sub)",
  };
  if (!priority) return null;
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-mono)",
        color: colors[priority] ?? "var(--color-text-sub)",
        fontWeight: 500,
      }}
    >
      {priority}
    </span>
  );
}

interface SpecCardProps {
  spec: TestSpec;
  editedContent: string;
  excluded: boolean;
  onToggleExclude: () => void;
  onEdit: (content: string) => void;
}

function SpecCard({ spec, editedContent, excluded, onToggleExclude, onEdit }: SpecCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${excluded ? "var(--color-border)" : "var(--color-border)"}`,
        borderRadius: 12,
        background: excluded ? "var(--color-tag-bg)" : "var(--color-surface)",
        opacity: excluded ? 0.55 : 1,
        transition: "opacity 0.15s",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Approve toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExclude();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
          aria-label={excluded ? "Include spec" : "Exclude spec"}
        >
          {excluded ? (
            <Square size={18} strokeWidth={1.5} color="var(--color-text-sub)" />
          ) : (
            <CheckSquare size={18} strokeWidth={1.5} color="var(--color-accent)" />
          )}
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                color: excluded ? "var(--color-text-sub)" : "var(--color-text)",
              }}
            >
              {spec.title}
            </span>
            {spec.autoApproved && (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  background: "var(--color-accent-light)",
                  color: "var(--color-accent)",
                }}
              >
                auto-approved
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-sub)",
              }}
            >
              {spec.id} · {spec.module}
            </span>
            {spec.testTypes.map((t) => (
              <TypeTag key={t} type={t} />
            ))}
            <PriorityBadge content={editedContent} />
          </div>
        </div>

        {/* Edit toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing((v) => !v);
            if (!expanded) setExpanded(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 6,
            color: editing ? "var(--color-accent)" : "var(--color-text-sub)",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-body)",
            transition: "color 0.1s",
          }}
          aria-label="Edit spec"
        >
          <Edit3 size={14} strokeWidth={1.5} />
          Edit
        </button>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp size={16} strokeWidth={1.5} color="var(--color-text-sub)" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} color="var(--color-text-sub)" />
        )}
      </div>

      {/* Card body */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "16px 20px",
          }}
        >
          {editing ? (
            <textarea
              value={editedContent}
              onChange={(e) => onEdit(e.target.value)}
              style={{
                width: "100%",
                minHeight: 280,
                padding: "12px 14px",
                border: "1px solid var(--color-accent)",
                borderRadius: 8,
                background: "var(--color-bg)",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text)",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {editedContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function BucketSection({
  label,
  specs,
  editedContents,
  excludedIds,
  onToggleExclude,
  onEdit,
}: {
  label: string;
  specs: TestSpec[];
  editedContents: Map<string, string>;
  excludedIds: Set<string>;
  onToggleExclude: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  if (specs.length === 0) return null;
  const isRegression = label === "Regression";
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Tag size={14} strokeWidth={1.5} color="var(--color-text-sub)" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
          }}
        >
          {label} Specs
        </span>
        <span
          style={{
            padding: "1px 8px",
            borderRadius: 10,
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            background: isRegression ? "var(--color-tag-bg)" : "var(--color-accent-light)",
            color: isRegression ? "var(--color-text-sub)" : "var(--color-accent)",
          }}
        >
          {specs.length}
        </span>
        {isRegression && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-sub)",
              fontFamily: "var(--font-body)",
            }}
          >
            — auto-approved, review optional
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {specs.map((spec) => (
          <SpecCard
            key={spec.id}
            spec={spec}
            editedContent={editedContents.get(spec.id) ?? spec.content}
            excluded={excludedIds.has(spec.id)}
            onToggleExclude={() => onToggleExclude(spec.id)}
            onEdit={(content) => onEdit(spec.id, content)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpecReview() {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [editedContents, setEditedContents] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: runState, error: fetchError } = useQuery<RunState, Error>({
    queryKey: ["run", runId],
    queryFn: () => fetchRunState(runId!),
    enabled: !!runId && !submitted,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.testSpecs != null) return false; // specs arrived — stop polling
      return 3000;
    },
    retry: (count, err) => {
      // Stop retrying on 404 (run not started yet) — let polling handle it
      if (err.message.includes("404")) return false;
      return count < 3;
    },
  });

  const specs = runState?.testSpecs ?? null;
  const featureSpecs = useMemo(
    () => specs?.filter((s) => s.bucket === "feature") ?? [],
    [specs],
  );
  const regressionSpecs = useMemo(
    () => specs?.filter((s) => s.bucket === "regression") ?? [],
    [specs],
  );

  const approvedCount = useMemo(() => {
    if (!specs) return 0;
    return specs.filter((s) => !excludedIds.has(s.id)).length;
  }, [specs, excludedIds]);

  function handleToggleExclude(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEdit(id: string, content: string) {
    setEditedContents((prev) => new Map(prev).set(id, content));
  }

  async function handleApprove() {
    if (!runId || !specs) return;
    setSubmitting(true);
    setSubmitError(null);

    const approvedSpecs: TestSpec[] = specs
      .filter((s) => !excludedIds.has(s.id))
      .map((s) => ({
        ...s,
        content: editedContents.get(s.id) ?? s.content,
      }));

    try {
      await approveSpecs(runId, approvedSpecs);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Approval failed");
      setSubmitting(false);
    }
  }

  // ─── No runId ───────────────────────────────────────────────────────────────

  if (!runId) {
    return (
      <div
        style={{
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          color: "var(--color-text-sub)",
        }}
      >
        <AlertCircle size={24} strokeWidth={1.5} color="var(--color-warn)" />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)" }}>
          No run ID specified. Trigger a run from the{" "}
          <a
            href="/"
            style={{ color: "var(--color-accent)", textDecoration: "none" }}
          >
            Run page
          </a>
          .
        </p>
      </div>
    );
  }

  // ─── Post-approval ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ padding: "40px 48px", maxWidth: 640 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "20px 24px",
            borderRadius: 12,
            background: "var(--color-accent-light)",
            border: "1px solid var(--color-accent)",
          }}
        >
          <CheckCircle2
            size={20}
            strokeWidth={1.5}
            color="var(--color-accent)"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                color: "var(--color-accent)",
                marginBottom: 4,
              }}
            >
              Specs approved — pipeline resuming
            </p>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-sub)",
                fontFamily: "var(--font-body)",
              }}
            >
              The Automation agent will now generate and execute Playwright tests.
              Monitor progress in the Run Monitor once it is available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading: waiting for specs ─────────────────────────────────────────────

  if (!specs) {
    const agentRunning = runState?.currentAgent;
    return (
      <div style={{ padding: "40px 48px", maxWidth: 640 }}>
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
            Spec Review
          </h1>
          <p
            style={{
              fontSize: "var(--text-xs)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-sub)",
            }}
          >
            run/{runId}
          </p>
        </div>

        {fetchError ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} color="var(--color-fail)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-fail)", fontFamily: "var(--font-mono)" }}>
              {fetchError.message}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Loader2
              size={18}
              strokeWidth={1.5}
              color="var(--color-accent)"
              style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}
            />
            <div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text)",
                  marginBottom: 2,
                }}
              >
                {agentRunning ? agentLabel(agentRunning) : "Pipeline starting..."}
              </p>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-sub)",
                }}
              >
                This page will update automatically when specs are ready.
              </p>
            </div>
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── No specs generated ─────────────────────────────────────────────────────

  if (specs.length === 0) {
    return (
      <div style={{ padding: "40px 48px", maxWidth: 640 }}>
        <PageHeader runId={runId} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 20px",
            borderRadius: 8,
            background: "var(--color-tag-bg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <AlertCircle size={16} strokeWidth={1.5} color="var(--color-warn)" />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-sub)" }}>
            No specs were generated. Check the Explorer output or verify the target URL is reachable.
          </p>
        </div>
      </div>
    );
  }

  // ─── Spec Review ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "40px 48px", maxWidth: 900 }}>
      <PageHeader runId={runId} />

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "16px 20px",
          borderRadius: 10,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          marginBottom: 36,
          flexWrap: "wrap",
        }}
      >
        <Stat label="Feature specs" value={featureSpecs.length} accent />
        <Stat label="Regression specs" value={regressionSpecs.length} />
        <Stat label="Auto-approved" value={specs.filter((s) => s.autoApproved).length} />
        <Stat label="Excluded" value={excludedIds.size} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={14} strokeWidth={1.5} color="var(--color-text-sub)" />
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-sub)",
            }}
          >
            {runState?.startedAt
              ? new Date(runState.startedAt).toLocaleTimeString()
              : "—"}
          </span>
        </div>
      </div>

      {/* Spec lists */}
      <BucketSection
        label="Feature"
        specs={featureSpecs}
        editedContents={editedContents}
        excludedIds={excludedIds}
        onToggleExclude={handleToggleExclude}
        onEdit={handleEdit}
      />
      <BucketSection
        label="Regression"
        specs={regressionSpecs}
        editedContents={editedContents}
        excludedIds={excludedIds}
        onToggleExclude={handleToggleExclude}
        onEdit={handleEdit}
      />

      {/* Error */}
      {submitError && (
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
          <AlertCircle size={16} strokeWidth={1.5} color="var(--color-fail)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-fail)", fontFamily: "var(--font-mono)" }}>
            {submitError}
          </p>
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingTop: 24,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <button
          onClick={handleApprove}
          disabled={submitting || approvedCount === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            background:
              submitting || approvedCount === 0
                ? "var(--color-border)"
                : "var(--color-accent)",
            color:
              submitting || approvedCount === 0 ? "var(--color-text-sub)" : "#fff",
            border: "none",
            borderRadius: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            cursor: submitting || approvedCount === 0 ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!submitting && approvedCount > 0)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!submitting && approvedCount > 0)
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-accent)";
          }}
        >
          {submitting ? (
            <Loader2 size={16} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <CheckCircle2 size={16} strokeWidth={1.5} />
          )}
          {submitting
            ? "Resuming pipeline..."
            : `Approve ${approvedCount} spec${approvedCount !== 1 ? "s" : ""} & continue`}
        </button>

        {excludedIds.size > 0 && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontFamily: "var(--font-body)",
              color: "var(--color-text-sub)",
            }}
          >
            {excludedIds.size} spec{excludedIds.size !== 1 ? "s" : ""} excluded from this run
          </span>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PageHeader({ runId }: { runId: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: "var(--color-text)",
          letterSpacing: "-0.02em",
          marginBottom: 6,
        }}
      >
        Spec Review
      </h1>
      <p
        style={{
          fontSize: "var(--text-xs)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-sub)",
        }}
      >
        run/{runId}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--text-xl)",
          color: accent ? "var(--color-accent)" : "var(--color-text)",
          lineHeight: 1,
          marginBottom: 2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontFamily: "var(--font-body)",
          color: "var(--color-text-sub)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
