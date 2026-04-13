// Agent 0 — Scoper (feature run mode only)
// Week 5 implementation. This stub passes through state unchanged.

import { QARunStateType } from "../state.types.js";

export async function runScoper(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  // TODO Week 5: Parse feature description, query Mem0, map blast radius via git diff
  console.log("[scoper] stub — Week 5 implementation pending");
  return { currentAgent: "scoper", scope: null };
}
