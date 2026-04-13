import type { Response } from "express";

type SseEvent = Record<string, unknown>;
type Unsubscribe = () => void;

class SseManager {
  private readonly subscribers = new Map<string, Set<(event: SseEvent) => void>>();

  subscribe(runId: string, callback: (event: SseEvent) => void): Unsubscribe {
    if (!this.subscribers.has(runId)) {
      this.subscribers.set(runId, new Set());
    }
    this.subscribers.get(runId)!.add(callback);

    return () => {
      this.subscribers.get(runId)?.delete(callback);
      if (this.subscribers.get(runId)?.size === 0) {
        this.subscribers.delete(runId);
      }
    };
  }

  broadcast(runId: string, event: SseEvent): void {
    this.subscribers.get(runId)?.forEach((cb) => cb(event));
  }

  pipe(runId: string, res: Response): Unsubscribe {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send a heartbeat every 15 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15_000);

    const unsubscribe = this.subscribe(runId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    return () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
  }
}

export const sseManager = new SseManager();
