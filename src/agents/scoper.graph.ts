// Agent 0 — Scoper (feature run mode only)
// Parses the feature description, queries Mem0 for known app structure,
// and uses a git diff of changed files to produce a precise blast radius.

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { agentMemory, sessionMemory } from "../memory/mem0.client.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import { getGithubTools } from "../tools/github.tools.js";
import {
  QARunStateType,
  FeatureScope,
} from "../state.types.js";
import { config } from "../config.js";

const llm = new ChatGoogleGenerativeAI({
  model: config.llmModel,
  maxOutputTokens: 4000,
});

// ─── Exported agent function ──────────────────────────────────────────────────

export async function runScoper(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const appKnowledge = await agentMemory.recall(
    RECALL_KEYS.scoper.agentContext,
  );

  // Check session memory for a cached scope (re-runs after a bug fix)
  const cacheKey = `${RECALL_KEYS.scoper.scopeCache}${state.featureDescription?.slice(0, 50) ?? ""}`;
  const cachedScope = await sessionMemory.recall(cacheKey, state.runId);

  if (cachedScope) {
    try {
      const scope = JSON.parse(cachedScope) as FeatureScope;
      return { currentAgent: "scoper", scope };
    } catch {
      // Cache parse failure — re-scope
    }
  }

  // Step 1: Fetch git diff for precise blast radius detection
  const gitDiff = await fetchGitDiff();

  // Step 2: Resolve scope using memory + git diff
  const scope = await resolveScope(state, appKnowledge, gitDiff?.changedFiles ?? []);

  // Cache scope in session memory for re-runs within this run
  await sessionMemory.save(
    `${cacheKey}: ${JSON.stringify(scope)}`,
    state.runId,
  );

  // Persist blast radius relationships durably
  await agentMemory.learn(
    `Blast radius: ${scope.directScope.routes.join(",")} affects ${scope.blastRadius.routes.join(",")}`,
  );

  return {
    currentAgent: "scoper",
    scope,
    gitDiff: gitDiff ?? null,
  };
}

// ─── fetchGitDiff ─────────────────────────────────────────────────────────────

async function fetchGitDiff(): Promise<{
  changedFiles: string[];
  base: string;
  head: string;
} | null> {
  const ghTools = await getGithubTools();
  const listCommits = ghTools.find((t) => t.name === "list_commits");
  const compareFiles = ghTools.find(
    (t) => t.name === "compare_commits" || t.name === "compare_files",
  );

  if (!listCommits) {
    console.warn("[scoper] GitHub tools unavailable — scoping from memory only");
    return null;
  }

  let commits: Array<{ sha: string }> = [];
  try {
    commits = (await listCommits.invoke({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      sha: process.env.GITHUB_DEFAULT_BRANCH ?? config.github.defaultBranch,
      per_page: 2,
    })) as Array<{ sha: string }>;
  } catch (err) {
    console.warn("[scoper] list_commits failed:", (err as Error).message);
    return null;
  }

  if (!commits || commits.length < 2) {
    return null;
  }

  const base = commits[1].sha;
  const head = commits[0].sha;

  if (!compareFiles) {
    // No compare tool available — return commit SHAs without file list
    return { changedFiles: [], base, head };
  }

  try {
    const diff = (await compareFiles.invoke({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      base,
      head,
    })) as { files?: Array<{ filename: string }> };

    const changedFiles = diff?.files?.map((f) => f.filename) ?? [];
    return { changedFiles, base, head };
  } catch (err) {
    console.warn("[scoper] compare failed:", (err as Error).message);
    return { changedFiles: [], base, head };
  }
}

// ─── resolveScope ─────────────────────────────────────────────────────────────

async function resolveScope(
  state: QARunStateType,
  appKnowledge: string,
  changedFiles: string[],
): Promise<FeatureScope> {
  const gitDiffContext =
    changedFiles.length > 0
      ? `\n\nGit diff — files changed since last commit:\n${changedFiles.join("\n")}\n
Use these paths to identify which components and routes actually changed.
Changed files override memory-based blast radius guesses — trust the diff.`
      : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a QA scoping expert. Given a feature description and knowledge of
an app's structure, you identify:
1. directScope: exact routes, API endpoints, components this feature touches
2. blastRadius: existing features that share data/state with this feature
3. skip: modules with zero overlap (no need to test)
4. testTypes: which test types are needed ["UI", "voice", "API"]

Be conservative with blast radius — better to include too much than miss a regression.

Known app structure from memory:
${appKnowledge}${gitDiffContext}

Output ONLY a JSON object matching this shape:
{
  "directScope": { "routes": [], "apiEndpoints": [], "components": [], "testTypes": [] },
  "blastRadius": { "routes": [], "reason": "", "riskLevel": "low|medium|high" },
  "skip": []
}`,
    },
    {
      role: "user",
      content: `Feature to scope: ${state.featureDescription ?? "(none — full regression)"}`,
    },
  ]);

  try {
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM response");
    return JSON.parse(jsonMatch[0]) as FeatureScope;
  } catch (err) {
    console.warn("[scoper] LLM parse failed:", (err as Error).message);
    // Fallback: broad scope from memory-based routes
    const routeMatches = appKnowledge.match(/Route (\/\S+) has flows/g) ?? [];
    const routes = routeMatches.map((m) =>
      m.replace("Route ", "").replace(" has flows", ""),
    );

    return {
      directScope: {
        routes: routes.slice(0, 10),
        apiEndpoints: [],
        components: [],
        testTypes: ["UI"],
      },
      blastRadius: {
        routes: [],
        reason: "Scoper LLM failed — using memory fallback",
        riskLevel: "low",
      },
      skip: [],
    };
  }
}
