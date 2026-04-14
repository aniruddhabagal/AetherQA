import { MemoryClient } from "mem0ai";
import { config } from "../config.js";

const AGENT_ID = "aetherqa-system";

function createClient(): MemoryClient | null {
  if (config.mem0ApiKey) {
    return new MemoryClient({ apiKey: config.mem0ApiKey });
  }
  if (config.mem0SelfHostedUrl) {
    return new MemoryClient({
      apiKey: "no-key",
      host: config.mem0SelfHostedUrl,
    });
  }
  // Mem0 not configured — memory features disabled, agents will run without memory context
  console.warn("[mem0] MEM0_API_KEY and MEM0_SELF_HOSTED_URL are not set — running without memory");
  return null;
}

let _client: MemoryClient | null | undefined = undefined;

function getClient(): MemoryClient | null {
  if (_client === undefined) _client = createClient();
  return _client;
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  memory: string;
  created_at?: string;
}

// ─── Agent scope ─────────────────────────────────────────────────────────────
// Permanent system knowledge — survives across all runs

export const agentMemory = {
  async recall(query: string): Promise<string> {
    const client = getClient();
    if (!client) return "";
    const res = await client.search(query, {
      agent_id: AGENT_ID,
      limit: 10,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as MemoryEntry[]).map((r) => r.memory).join("\n");
  },

  async search(query: string): Promise<MemoryEntry[]> {
    const client = getClient();
    if (!client) return [];
    const res = await client.search(query, {
      agent_id: AGENT_ID,
      limit: 20,
    } as Parameters<MemoryClient["search"]>[1]);
    return res as MemoryEntry[];
  },

  async learn(fact: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.add(
      [{ role: "user", content: fact }],
      { agent_id: AGENT_ID } as Parameters<MemoryClient["add"]>[1],
    );
  },

  async forget(memoryId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.delete(memoryId);
  },
};

// ─── Session scope ────────────────────────────────────────────────────────────
// Per run — cleaned up after the run completes

export const sessionMemory = {
  async recall(query: string, runId: string): Promise<string> {
    const client = getClient();
    if (!client) return "";
    const res = await client.search(query, {
      run_id: runId,
      limit: 5,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as Array<{ memory: string }>)
      .map((r) => r.memory)
      .join("\n");
  },

  async save(content: string, runId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.add(
      [{ role: "assistant", content }],
      { run_id: runId } as Parameters<MemoryClient["add"]>[1],
    );
  },
};

// ─── User scope ───────────────────────────────────────────────────────────────
// Per QA engineer — persists indefinitely

export const userMemory = {
  async recall(query: string, userId: string): Promise<string> {
    const client = getClient();
    if (!client) return "";
    const res = await client.search(query, {
      user_id: userId,
      limit: 5,
    } as Parameters<MemoryClient["search"]>[1]);
    return (res as MemoryEntry[]).map((r) => r.memory).join("\n");
  },

  async search(query: string, userId: string): Promise<MemoryEntry[]> {
    const client = getClient();
    if (!client) return [];
    const res = await client.search(query, {
      user_id: userId,
      limit: 20,
    } as Parameters<MemoryClient["search"]>[1]);
    return res as MemoryEntry[];
  },

  async save(content: string, userId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.add(
      [{ role: "user", content }],
      { user_id: userId } as Parameters<MemoryClient["add"]>[1],
    );
  },

  async forget(memoryId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.delete(memoryId);
  },
};
