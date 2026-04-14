import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Wrench,
  Bug,
  HelpCircle,
  Terminal,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealedTest {
  specId: string;
  filepath: string;
  action: "healed" | "escalate";
  healAttempted: boolean;
  healExplanation?: string;
  errorMessage?: string;
  componentPath?: string;
}

interface Escalation {
  specId: string;
  reason: string;
  errorMessage: string;
  screenshotPath?: string;
}

interface ApiTestResult {
  endpoint: string;
  testName: string;
  status: "pass" | "fail";
  statusCode?: number;
  durationMs: number;
  errorMessage?: string;
}

interface RunState {
  runId: string;
  healedTests: HealedTest[] | null;
  escalations: Escalation[] | null;
  apiTestResults: ApiTestResult[] | null;
  testResults: Array<{
    specId: string;
    status: "pass" | "fail" | "skip";
    durationMs: number;
    screenshotPath?: string;
    errorMessage?: string;
    failureTrace?: string;
  }> | null;
  errors: string[];
  currentAgent: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL ?? "";

async function fetchRunState(runId: string): Promise<RunState> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/results`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<RunState>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FailureTriage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const runId = searchParams.get("runId") ?? "";

  const [expandedEscalation, setExpandedEscalation] = useState<string | null>(null);
  const [expandedApiFailure, setExpandedApiFailure] = useState<string | null>(null);

  const {
    data: runState,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<RunState>({
    queryKey: ["run-triage", runId],
    queryFn: () => fetchRunState(runId),
    enabled: !!runId,
    refetchInterval: false,
  });

  const escalations = runState?.escalations ?? [];
  const healedTests = (runState?.healedTests ?? []).filter(
    (h) => h.action === "healed",
  );
  const failedHeals = (runState?.healedTests ?? []).filter(
    (h) => h.action === "escalate" && h.healAttempted,
  );
  const apiFailures = (runState?.apiTestResults ?? []).filter(
    (r) => r.status === "fail",
  );

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate("/app")}
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
          <AlertTriangle
            size={20}
            color="var(--color-fail)"
            strokeWidth={1.5}
          />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-2xl)",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
            }}
          >
            Failure Triage
          </h1>
          {runId && (
            <button
              onClick={() => void refetch()}
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                color: "var(--color-text-sub)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
              }}
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Refresh
            </button>
          )}
        </div>

        {runId && (
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
        )}
      </div>

      {/* No run selected */}
      {!runId && (
        <EmptyState message="No run selected. Navigate here from the Run Monitor after a completed run." />
      )}

      {/* Loading */}
      {runId && isLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--color-text-sub)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
          }}
        >
          <Loader2
            size={16}
            strokeWidth={1.5}
            style={{ animation: "spin 1s linear infinite" }}
          />
          Loading triage results…
        </div>
      )}

      {/* Error */}
      {runId && isError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid var(--color-fail)",
            borderRadius: 8,
            padding: "12px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            color: "var(--color-fail)",
          }}
        >
          {(error as Error).message}
        </div>
      )}

      {/* Content */}
      {runState && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <SummaryCard
              label="Escalations"
              value={escalations.length}
              color="var(--color-fail)"
              icon={<Bug size={16} strokeWidth={1.5} color="var(--color-fail)" />}
            />
            <SummaryCard
              label="Auto-healed"
              value={healedTests.length}
              color="var(--color-heal)"
              icon={
                <Wrench
                  size={16}
                  strokeWidth={1.5}
                  color="var(--color-heal)"
                />
              }
            />
            <SummaryCard
              label="Heal failed"
              value={failedHeals.length}
              color="var(--color-warn)"
              icon={
                <HelpCircle
                  size={16}
                  strokeWidth={1.5}
                  color="var(--color-warn)"
                />
              }
            />
            <SummaryCard
              label="API failures"
              value={apiFailures.length}
              color="var(--color-fail)"
              icon={
                <Terminal
                  size={16}
                  strokeWidth={1.5}
                  color="var(--color-fail)"
                />
              }
            />
          </div>

          {/* All-green banner */}
          {escalations.length === 0 &&
            apiFailures.length === 0 &&
            failedHeals.length === 0 && (
              <div
                style={{
                  background: "var(--color-accent-light)",
                  border: "1px solid var(--color-accent)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-accent)",
                  marginBottom: 32,
                }}
              >
                <CheckCircle2 size={18} strokeWidth={1.5} />
                {healedTests.length > 0
                  ? `No failures requiring attention. ${healedTests.length} test${healedTests.length > 1 ? "s" : ""} were auto-healed.`
                  : "No failures — all tests passed."}
              </div>
            )}

          {/* Escalations section */}
          {escalations.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionHeading
                label={`Escalations (${escalations.length})`}
                sublabel="Failures that require human investigation"
                color="var(--color-fail)"
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {escalations.map((e) => {
                  const detail = runState.testResults?.find(
                    (r) => r.specId === e.specId,
                  );
                  const failedHeal = failedHeals.find(
                    (h) => h.specId === e.specId,
                  );
                  const isExpanded = expandedEscalation === e.specId;

                  return (
                    <EscalationCard
                      key={e.specId}
                      escalation={e}
                      detail={detail}
                      failedHeal={failedHeal}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setExpandedEscalation((prev) =>
                          prev === e.specId ? null : e.specId,
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* API failures section */}
          {apiFailures.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionHeading
                label={`API Test Failures (${apiFailures.length})`}
                sublabel="Backend contract, auth, or validation failures"
                color="var(--color-fail)"
              />
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {apiFailures.map((f, i) => {
                  const isExpanded = expandedApiFailure === f.testName;
                  const isLast = i === apiFailures.length - 1;

                  return (
                    <div
                      key={f.testName}
                      style={{
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--color-border)",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedApiFailure((prev) =>
                            prev === f.testName ? null : f.testName,
                          )
                        }
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 20px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <Bug
                          size={14}
                          color="var(--color-fail)"
                          strokeWidth={1.5}
                          style={{ flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-sub)",
                            flexShrink: 0,
                          }}
                        >
                          {f.endpoint}
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
                          {f.testName}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-sub)",
                            flexShrink: 0,
                          }}
                        >
                          {f.durationMs}ms
                        </span>
                        {isExpanded ? (
                          <ChevronDown
                            size={14}
                            color="var(--color-text-sub)"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <ChevronRight
                            size={14}
                            color="var(--color-text-sub)"
                            strokeWidth={1.5}
                          />
                        )}
                      </button>

                      {isExpanded && f.errorMessage && (
                        <div style={{ padding: "0 20px 16px 46px" }}>
                          <pre
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-xs)",
                              color: "var(--color-fail)",
                              background: "var(--color-bg)",
                              borderRadius: 6,
                              padding: "12px",
                              overflowX: "auto",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              margin: 0,
                            }}
                          >
                            {f.errorMessage}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Auto-healed section */}
          {healedTests.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionHeading
                label={`Auto-healed (${healedTests.length})`}
                sublabel="Selector breakages fixed automatically — no action needed"
                color="var(--color-heal)"
              />
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {healedTests.map((h, i) => (
                  <div
                    key={h.specId}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 20px",
                      borderBottom:
                        i < healedTests.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <CheckCircle2
                      size={16}
                      color="var(--color-heal)"
                      strokeWidth={1.5}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-sub)",
                          marginBottom: 4,
                        }}
                      >
                        {h.specId}
                      </div>
                      {h.healExplanation && (
                        <div
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--text-sm)",
                            color: "var(--color-text)",
                          }}
                        >
                          {h.healExplanation}
                        </div>
                      )}
                      {h.componentPath && (
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-sub)",
                            marginTop: 4,
                          }}
                        >
                          Component: {h.componentPath}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pipeline errors */}
          {runState.errors && runState.errors.length > 0 && (
            <section>
              <SectionHeading
                label="Pipeline errors"
                sublabel="Agent-level errors that may have interrupted the run"
                color="var(--color-warn)"
              />
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {runState.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "14px 20px",
                      borderBottom:
                        i < runState.errors.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-warn)",
                    }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
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

function SectionHeading({
  label,
  sublabel,
  color,
}: {
  label: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-base)",
          color,
          marginBottom: 2,
        }}
      >
        {label}
      </h2>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-sub)",
        }}
      >
        {sublabel}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
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
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {icon}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-sub)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-2xl)",
          fontWeight: 600,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EscalationCard({
  escalation,
  detail,
  failedHeal,
  isExpanded,
  onToggle,
}: {
  escalation: Escalation;
  detail?: {
    specId: string;
    status: string;
    durationMs: number;
    screenshotPath?: string;
    errorMessage?: string;
    failureTrace?: string;
  };
  failedHeal?: HealedTest;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "18px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Bug
          size={16}
          color="var(--color-fail)"
          strokeWidth={1.5}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-sub)",
              }}
            >
              {escalation.specId}
            </span>
            {failedHeal && (
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-xs)",
                  background: "#fef3cd",
                  color: "#92400e",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                Heal attempted
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              color: "var(--color-fail)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            {escalation.errorMessage.slice(0, 120)}
            {escalation.errorMessage.length > 120 ? "…" : ""}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-sub)",
            }}
          >
            {escalation.reason}
          </div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          {isExpanded ? (
            <ChevronDown
              size={16}
              color="var(--color-text-sub)"
              strokeWidth={1.5}
            />
          ) : (
            <ChevronRight
              size={16}
              color="var(--color-text-sub)"
              strokeWidth={1.5}
            />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "16px 20px",
          }}
        >
          {/* Full error message */}
          {escalation.errorMessage && (
            <div style={{ marginBottom: 16 }}>
              <DetailLabel label="Error" />
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-fail)",
                  background: "#fef2f2",
                  borderRadius: 6,
                  padding: "12px",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  margin: 0,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {escalation.errorMessage}
              </pre>
            </div>
          )}

          {/* Failure trace */}
          {detail?.failureTrace && (
            <div style={{ marginBottom: 16 }}>
              <DetailLabel label="Stack trace" />
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
                  margin: 0,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {detail.failureTrace}
              </pre>
            </div>
          )}

          {/* Failed heal note */}
          {failedHeal?.healExplanation && (
            <div style={{ marginBottom: 16 }}>
              <DetailLabel label="Auto-heal attempt" />
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "#92400e",
                }}
              >
                {failedHeal.healExplanation}
              </div>
            </div>
          )}

          {/* Reproduce with curl */}
          <div style={{ marginBottom: 16 }}>
            <DetailLabel label="Reproduce" />
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
                margin: 0,
              }}
            >
              {`npx playwright test --grep "${escalation.specId}" --headed`}
            </pre>
          </div>

          {/* Screenshot */}
          {escalation.screenshotPath && (
            <div>
              <DetailLabel label="Screenshot" />
              <img
                src={`/runs/${escalation.screenshotPath}`}
                alt="Failure screenshot"
                style={{
                  maxWidth: "100%",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: "var(--color-text-sub)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 6,
      }}
    >
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
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
