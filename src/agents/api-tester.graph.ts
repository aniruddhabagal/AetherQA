// Agent 5 — API Tester
// Week 4 implementation. This stub passes through state unchanged.

import { QARunStateType } from "../state.types.js";

export async function runApiTester(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  // TODO Week 4: Fetch OpenAPI spec, diff against last run, generate and run API tests
  console.log("[api-tester] stub — Week 4 implementation pending");
  return { currentAgent: "apiTester", apiTestResults: [] };
}
