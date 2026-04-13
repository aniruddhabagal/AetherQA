import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Terminal,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEvent {
  agent: string;
  message: string;
  specId?: string;
  timestamp: string;
}

interface TestResult {
  specId: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  screenshotPath?: string;
  errorMessage?: string;
  failureTrace?: string;
}

interface TestOutputLine {
  line: string;
  level?: "stderr";
  voiceMode?: boolean;
}

type SseEvent =
  | { type: "agent_update"; data: AgentEvent | Record<string, unknown> }
  | { type: "test_result"; data: TestResult }
  | { type: "test_output"; data: TestOutputLine }
  | { type: "run_complete"; runId: string }
  | { type: "error"; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function RunMonitor() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [outputLines, setOutputLines] = useState<TestOutputLine[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [expandedFail, setExpandedFail] = useState<string | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // SSE connection
  useEffect(() => {
    if (!runId) return;

    const apiBase = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL ?? "";
    const es = new EventSource(`${apiBase}/api/runs/${runId}/stream`);

    es.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as SseEvent;

      if (event.type === "agent_update") {
        const raw = event.data as Record<string, unknown>;
        // Normalize: the data may be a chunk object from langgraph or a structured event
        const agentEvent: AgentEvent = {
          agent: (raw["agent"] as string | undefined) ?? (raw["currentAgent"] as string | undefined) ?? "system",
          message: (raw["message"] as string | undefined) ?? summarizeChunk(raw),
          specId: raw["specId"] as string | undefined,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [...prev, agentEvent]);
      }

      if (event.type === "test_result") {
        setResults((prev) => [...prev, event.data]);
      }

      if (event.type === "test_output") {
        setOutputLines((prev) => [...prev, event.data]);
      }

      if (event.type === "run_complete") {
        setIsComplete(true);
        es.close();
      }

      if (event.type === "error") {
        setRunError(event.error);
        setIsComplete(true);
        es.close();
      }
    };

    es.onerror = () => {
      // Connection dropped — mark complete so spinner stops
      setIsComplete(true);
      es.close();
    };

    return () => es.close();
  }, [runId]);

  // Auto-scroll timeline
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Auto-scroll output
  useEffect(() => {
    if (showOutput) {
      outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [outputLines, showOutput]);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const skipCount = results.filter((r) => r.status === "skip").length;
  const totalCount = results.length;
  const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);

  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-sub)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            padding: "4px 0",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to runs
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Activity size={20} color="var(--color-accent)" strokeWidth={1.5} />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-2xl)",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
            }}
          >
            Run Monitor
          </h1>
          {!isComplete && (
            <Loader2
              size={16}
              color="var(--color-accent)"
              strokeWidth={1.5}
              style={{ animation: "spin 1s linear infinite" }}
            />
          )}
        </div>

        <p
          style={{
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-sub)",
          }}
        >
          Run ID: {runId}
        </p>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Passed"
          value={passCount}
          color="var(--color-pass)"
        />
        <StatCard
          label="Failed"
          value={failCount}
          color="var(--color-fail)"
        />
        <StatCard
          label="Skipped"
          value={skipCount}
          color="var(--color-warn)"
        />
        <StatCard
          label={isComplete ? "Pass rate" : "Elapsed"}
          value={isComplete ? `${passRate}%` : `${elapsedSec}s`}
          color="var(--color-text-sub)"
        />
      </div>

      {/* Progress bar */}
      {!isComplete && totalCount > 0 && (
        <div
          style={{
            height: 4,
            background: "var(--color-border)",
            borderRadius: 2,
            marginBottom: 32,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${passRate}%`,
              background: "var(--color-pass)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}

      {/* Error banner */}
      {runError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid var(--color-fail)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            color: "var(--color-fail)",
          }}
        >
          Run error: {runError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Agent timeline */}
        <div>
          <SectionHeading label="Agent timeline" />
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              overflow: "hidden",
              maxHeight: 420,
              overflowY: "auto",
            }}
          >
            {events.length === 0 && !isComplete ? (
              <div
                style={{
                  padding: 24,
                  color: "var(--color-text-sub)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Loader2
                  size={14}
                  strokeWidth={1.5}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Waiting for pipeline to start…
              </div>
            ) : (
              events.map((ev, i) => <TimelineRow key={i} event={ev} isLast={i === events.length - 1} />)
            )}
            <div ref={timelineEndRef} />
          </div>
        </div>

        {/* Test results */}
        <div>
          <SectionHeading label="Test results" />
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              overflow: "hidden",
              maxHeight: 420,
              overflowY: "auto",
            }}
          >
            {results.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  color: "var(--color-text-sub)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {isComplete ? "No test results recorded." : "Tests have not run yet."}
              </div>
            ) : (
              results.map((r) => (
                <ResultRow
                  key={r.specId}
                  result={r}
                  expanded={expandedFail === r.specId}
                  onToggle={() =>
                    setExpandedFail((prev) =>
                      prev === r.specId ? null : r.specId,
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Raw output panel */}
      {outputLines.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowOutput((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-sub)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              padding: "4px 0",
              marginBottom: 8,
            }}
          >
            <Terminal size={14} strokeWidth={1.5} />
            Raw output ({outputLines.length} lines)
            {showOutput ? (
              <ChevronDown size={14} strokeWidth={1.5} />
            ) : (
              <ChevronRight size={14} strokeWidth={1.5} />
            )}
          </button>

          {showOutput && (
            <div
              style={{
                background: "#0f0f0f",
                borderRadius: 8,
                padding: "16px",
                maxHeight: 320,
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                lineHeight: 1.7,
              }}
            >
              {outputLines.map((l, i) => (
                <div
                  key={i}
                  style={{
                    color: l.level === "stderr" ? "#f87171" : "#d4d4d4",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {l.line}
                </div>
              ))}
              <div ref={outputEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Completion banner */}
      {isComplete && !runError && (
        <div
          style={{
            marginTop: 32,
            background: "var(--color-accent-light)",
            border: "1px solid var(--color-accent)",
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--color-accent)",
          }}
        >
          <CheckCircle2 size={16} strokeWidth={1.5} />
          Run complete — {passCount} passed, {failCount} failed
          {failCount > 0 && (
            <button
              onClick={() => navigate("/triage")}
              style={{
                marginLeft: "auto",
                background: "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              View failures
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: "var(--text-sm)",
        color: "var(--color-text-sub)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 10,
      }}
    >
      {label}
    </h2>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-2xl)",
          fontWeight: 600,
          color,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-sub)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const AGENT_COLOR: Record<string, string> = {
  scoper: "var(--color-warn)",
  explorer: "var(--color-heal)",
  testcase: "var(--color-accent)",
  automation: "var(--color-pass)",
  maintenance: "#8b5cf6",
  system: "var(--color-text-sub)",
};

function TimelineRow({
  event,
  isLast,
}: {
  event: AgentEvent;
  isLast: boolean;
}) {
  const color = AGENT_COLOR[event.agent] ?? "var(--color-text-sub)";

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--color-border)",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color,
            marginBottom: 2,
            textTransform: "lowercase",
          }}
        >
          {event.agent}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            wordBreak: "break-word",
          }}
        >
          {event.message}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-sub)",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {new Date(event.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

function ResultRow({
  result,
  expanded,
  onToggle,
}: {
  result: TestResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isFail = result.status === "fail";
  const statusColor =
    result.status === "pass"
      ? "var(--color-pass)"
      : result.status === "fail"
        ? "var(--color-fail)"
        : "var(--color-warn)";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <button
        onClick={isFail ? onToggle : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: isFail ? "pointer" : "default",
          textAlign: "left",
        }}
      >
        {result.status === "pass" ? (
          <CheckCircle2 size={16} color={statusColor} strokeWidth={1.5} />
        ) : result.status === "fail" ? (
          <XCircle size={16} color={statusColor} strokeWidth={1.5} />
        ) : (
          <Clock size={16} color={statusColor} strokeWidth={1.5} />
        )}

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-sub)",
            flexShrink: 0,
          }}
        >
          {result.specId}
        </span>

        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {result.errorMessage
            ? result.errorMessage.slice(0, 60)
            : result.status}
        </span>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-sub)",
            flexShrink: 0,
          }}
        >
          {result.durationMs}ms
        </span>

        {isFail && (
          expanded ? (
            <ChevronDown size={14} color="var(--color-text-sub)" strokeWidth={1.5} />
          ) : (
            <ChevronRight size={14} color="var(--color-text-sub)" strokeWidth={1.5} />
          )
        )}
      </button>

      {isFail && expanded && (
        <div
          style={{
            padding: "0 16px 16px 42px",
          }}
        >
          {result.errorMessage && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--color-fail)",
                marginBottom: 8,
              }}
            >
              {result.errorMessage}
            </p>
          )}
          {result.failureTrace && (
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-sub)",
                background: "var(--color-bg)",
                borderRadius: 6,
                padding: "12px",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {result.failureTrace}
            </pre>
          )}
          {result.screenshotPath && (
            <img
              src={`/runs/${result.screenshotPath}`}
              alt="Failure screenshot"
              style={{
                marginTop: 8,
                maxWidth: "100%",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summarizeChunk(chunk: Record<string, unknown>): string {
  // LangGraph stream chunks contain the node name as a key
  const nodeKey = Object.keys(chunk).find((k) => k !== "type");
  if (nodeKey) {
    const nodeData = chunk[nodeKey] as Record<string, unknown> | undefined;
    if (nodeData && typeof nodeData === "object") {
      const agent = nodeData["currentAgent"] as string | undefined;
      const errors = nodeData["errors"] as string[] | undefined;
      if (errors && errors.length > 0) return `Error: ${errors[errors.length - 1]}`;
      if (agent) return `Agent "${agent}" completed`;
    }
    return `Node "${nodeKey}" updated`;
  }
  return "Pipeline update";
}
