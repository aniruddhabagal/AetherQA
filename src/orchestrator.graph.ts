import { StateGraph, END, START } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { QARunState, QARunStateType } from "./state.types.js";
import { runScoper } from "./agents/scoper.graph.js";
import { runExplorer } from "./agents/explorer.graph.js";
import { runTestCase } from "./agents/testcase.graph.js";
import { runAutomation } from "./agents/automation.graph.js";
import { runMaintenance } from "./agents/maintenance.graph.js";
import { runApiTester } from "./agents/api-tester.graph.js";
import { config } from "./config.js";

const checkpointer = PostgresSaver.fromConnString(config.databaseUrl);

// Run checkpointer setup (creates the required tables if they don't exist)
let checkpointerReady = false;

export async function initCheckpointer(): Promise<void> {
  if (checkpointerReady) return;
  await checkpointer.setup();
  checkpointerReady = true;
}

// ─── Safe node wrapper ───────────────────────────────────────────────────────
// Wraps agent nodes so errors are captured into state.errors instead of crashing
// the entire graph. Without this, a throwing subgraph (e.g., Explorer hitting a
// Gemini 429) kills the stream and no state update is ever persisted.

function safeNode(
  name: string,
  agent:
    | ((state: QARunStateType) => Promise<Partial<QARunStateType>>)
    | { invoke: (input: QARunStateType) => Promise<Record<string, unknown>> },
): (state: QARunStateType) => Promise<Partial<QARunStateType>> {
  return async (state: QARunStateType): Promise<Partial<QARunStateType>> => {
    try {
      console.log(`[${name}] Starting`);
      const result =
        typeof agent === "function"
          ? await agent(state)
          : await agent.invoke(state);
      console.log(`[${name}] Completed`);
      return result as Partial<QARunStateType>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Truncate very long error messages (e.g., Gemini full error payloads)
      const truncated =
        message.length > 500 ? message.slice(0, 500) + "..." : message;
      console.error(`[${name}] Error:`, truncated);
      return {
        currentAgent: name,
        errors: [...(state.errors ?? []), `[${name}] ${truncated}`],
      };
    }
  };
}

// ─── Conditional edges ────────────────────────────────────────────────────────

function routeFromStart(
  state: QARunStateType,
): "scoper" | "explorer" {
  return state.runMode === "feature" ? "scoper" : "explorer";
}

function routeAfterTestCase(
  state: QARunStateType,
): "automation" | typeof END {
  // After the interruptAfter["testcase"] pause and human approval via POST /runs/:id/approve,
  // the approve endpoint sets specsApproved: true before resuming. If approval was rejected
  // (or the state is somehow resumed without approval), end the run gracefully.
  return state.specsApproved ? "automation" : END;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

const graph = new StateGraph(QARunState)
  .addNode("scoper", safeNode("scoper", runScoper))
  .addNode("explorer", safeNode("explorer", runExplorer))
  .addNode("testcase", safeNode("testcase", runTestCase))
  .addNode("automation", safeNode("automation", runAutomation))
  .addNode("maintenance", safeNode("maintenance", runMaintenance))
  .addNode("apiTester", safeNode("apiTester", runApiTester))

  // Entry: feature mode goes through scoper first; apiTester fans out in parallel
  .addConditionalEdges(START, routeFromStart, {
    scoper: "scoper",
    explorer: "explorer",
  })

  // apiTester runs in parallel from START — its results land in state before
  // maintenance runs, so maintenance always has both UI and API test outcomes
  .addEdge(START, "apiTester")

  .addEdge("scoper", "explorer")
  .addEdge("explorer", "testcase")

  // Human checkpoint: graph suspends until specsApproved = true
  .addConditionalEdges("testcase", routeAfterTestCase, {
    automation: "automation",
    [END]: END,
  })

  // Both branches converge at maintenance for unified reporting
  .addEdge("automation", "maintenance")
  .addEdge("apiTester", "maintenance")
  .addEdge("maintenance", END);

// interruptAfter: ["testcase"] suspends the graph after the testcase node completes.
// The apiTester branch completes before this checkpoint fires (it starts from START
// in parallel). When the human approves and the graph resumes, automation runs, then
// maintenance receives both testResults (from automation) and apiTestResults (from
// apiTester which is already in the persisted checkpoint state).
export const qaGraph = graph.compile({
  checkpointer,
  interruptAfter: ["testcase"],
});
