import { MemoryClient } from "mem0ai";
import { config } from "../config.js";

const AGENT_ID = "aetherqa-system";

function createClient(): MemoryClient {
  if (config.mem0ApiKey) {
    return new MemoryClient({ apiKey: config.mem0ApiKey });
  }
  if (config.mem0SelfHostedUrl) {
    return new MemoryClient({
      apiKey: "no-key",
      host: config.mem0SelfHostedUrl,
    });
  }
  throw new Error(
    "Mem0 not configured. Set MEM0_API_KEY or MEM0_SELF_HOSTED_URL in .env",
  );
}

let _client: MemoryClient | null = null;

function getClient(): MemoryClient {
  if (!_client) _client = createClient();
  return _client;
}

// ─── Agent scope ─────────────────────────────────────────────────────────────
// Permanent system knowledge — survives across all runs

export const agentMemory = {
  async recall(query: string): Promise<string> {
    const res = await getClient().search(query, {
      agent_id: AGENT_ID,
      limit: 10,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as Array<{ memory: string }>)
      .map((r) => r.memory)
      .join("\n");
  },

  async learn(fact: string): Promise<void> {
    await getClient().add(
      [{ role: "user", content: fact }],
      { agent_id: AGENT_ID } as Parameters<MemoryClient["add"]>[1],
    );
  },

  async forget(memoryId: string): Promise<void> {
    await getClient().delete(memoryId);
  },
};

// ─── Session scope ────────────────────────────────────────────────────────────
// Per run — cleaned up after the run completes

export const sessionMemory = {
  async recall(query: string, runId: string): Promise<string> {
    const res = await getClient().search(query, {
      run_id: runId,
      limit: 5,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as Array<{ memory: string }>)
      .map((r) => r.memory)
      .join("\n");
  },

  async save(content: string, runId: string): Promise<void> {
    await getClient().add(
      [{ role: "assistant", content }],
      { run_id: runId } as Parameters<MemoryClient["add"]>[1],
    );
  },
};

// ─── User scope ───────────────────────────────────────────────────────────────
// Per QA engineer — persists indefinitely

export const userMemory = {
  async recall(query: string, userId: string): Promise<string> {
    const res = await getClient().search(query, {
      user_id: userId,
      limit: 5,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as Array<{ memory: string }>)
      .map((r) => r.memory)
      .join("\n");
  },

  async save(content: string, userId: string): Promise<void> {
    await getClient().add(
      [{ role: "user", content }],
      { user_id: userId } as Parameters<MemoryClient["add"]>[1],
    );
  },
};
