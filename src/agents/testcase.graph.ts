// Agent 2 — Test Case Generator
// Week 2 implementation. This stub passes through state unchanged.

import { QARunStateType } from "../state.types.js";

export async function runTestCase(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  // TODO Week 2: Generate Markdown specs from appContext, pause for human review
  console.log("[testcase] stub — Week 2 implementation pending");
  return { currentAgent: "testcase", testSpecs: [] };
}
