// GitHub MCP integration — Week 3
// This module bridges the GitHub MCP Server to LangGraph tools via @langchain/mcp-adapters.
// In Week 1 this returns an empty tool list so agents degrade gracefully.

import type { StructuredTool } from "@langchain/core/tools";
import { config } from "../config.js";

let _cachedTools: StructuredTool[] | null = null;

export async function getGithubTools(): Promise<StructuredTool[]> {
  if (!config.github.token || !config.github.owner || !config.github.repo) {
    // GitHub not configured — return empty. Agents that call this will skip GitHub paths.
    return [];
  }

  if (_cachedTools) return _cachedTools;

  // Dynamically import to avoid crashing when the package isn't fully configured
  try {
    const { MultiServerMCPClient } = await import("@langchain/mcp-adapters");

    const client = new MultiServerMCPClient({
      github: {
        transport: "sse",
        url: config.github.mcpUrl,
        headers: {
          Authorization: `Bearer ${config.github.token}`,
        },
      },
    });

    const tools = await client.getTools();
    _cachedTools = tools as unknown as StructuredTool[];
    return _cachedTools;
  } catch (err) {
    console.warn("GitHub MCP tools unavailable:", (err as Error).message);
    return [];
  }
}
