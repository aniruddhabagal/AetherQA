import { StateGraph, END, START } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { QARunState, QARunStateType } from "./state.types.js";
import { runScoper } from "./agents/scoper.graph.js";
import { runExplorer } from "./agents/explorer.graph.js";
import { runTestCase } from "./agents/testcase.graph.js";
import { runAutomation } from "./agents/automation.graph.js";
import { runMaintenance } from "./agents/maintenance.graph.js";
// apiTester imported in Week 4 when wired in parallel
import { config } from "./config.js";

const checkpointer = PostgresSaver.fromConnString(config.databaseUrl);

// Run checkpointer setup (creates the required tables if they don't exist)
let checkpointerReady = false;

export async function initCheckpointer(): Promise<void> {
  if (checkpointerReady) return;
  await checkpointer.setup();
  checkpointerReady = true;
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
  .addNode("scoper", runScoper)
  .addNode("explorer", runExplorer)
  .addNode("testcase", runTestCase)
  .addNode("automation", runAutomation)
  .addNode("maintenance", runMaintenance)
  // apiTester added in Week 4 (runs in parallel with UI agents)

  // Entry: feature mode goes through scoper first
  .addConditionalEdges(START, routeFromStart, {
    scoper: "scoper",
    explorer: "explorer",
  })

  .addEdge("scoper", "explorer")
  .addEdge("explorer", "testcase")

  // Human checkpoint: graph suspends until specsApproved = true
  .addConditionalEdges("testcase", routeAfterTestCase, {
    automation: "automation",
    [END]: END,
  })

  .addEdge("automation", "maintenance")
  .addEdge("maintenance", END);

// interruptAfter: ["testcase"] suspends the graph after the testcase node completes.
// The run resumes when POST /runs/:id/approve is called, which sets specsApproved: true
// and calls qaGraph.stream(null, { configurable: { thread_id: runId } }).
export const qaGraph = graph.compile({
  checkpointer,
  interruptAfter: ["testcase"],
});
