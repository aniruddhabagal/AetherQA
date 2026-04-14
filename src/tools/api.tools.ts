// src/tools/api.tools.ts
// HTTP client, schema validator, OpenAPI spec diff utilities.
// Used directly by the API Tester agent and imported by generated API tests.

import AjvModule from "ajv";
import { EventEmitter } from "events";

// Ajv v8 ships CJS — construct signatures may not resolve in strict ESM tsconfig.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajv = new (AjvModule as any)({ allErrors: true }) as {
  compile: (schema: object) => { (data: unknown): boolean; errors: unknown[] | null };
};

// Shared webhook event bus — tests register listeners with waitForWebhook()
export const webhookBus = new EventEmitter();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiRequestOptions {
  body?: object;
  token?: string;
  expectStatus?: number | number[];
  validateSchema?: object;
  headers?: Record<string, string>;
}

export interface ApiTest {
  testName: string;
  method: string;
  path: string;
  requestBody?: object;
  headers?: Record<string, string>;
  expectedStatus: number | number[];
  validateSchema?: object;
}

export interface EndpointSchema {
  method: string;
  path: string;
  security?: unknown[];
  requestBody?: {
    content: {
      "application/json": {
        schema: {
          required?: string[];
          properties?: Record<string, { type: string; [k: string]: unknown }>;
        };
      };
    };
  };
  responses?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface SpecChange {
  type: "added" | "removed" | "modified";
  endpoint: string;
  path: string;
  method: string;
  detail: string;
}

export interface SpecDiff {
  type: "first-run" | "changed" | "unchanged";
  changes: SpecChange[];
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

export async function apiRequest(
  method: string,
  url: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Test-Run": "true",
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const expectedStatuses: number[] = Array.isArray(options.expectStatus)
    ? options.expectStatus
    : options.expectStatus !== undefined
      ? [options.expectStatus]
      : [200, 201];

  if (!expectedStatuses.includes(res.status)) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected status ${expectedStatuses.join("|")}, got ${res.status}\nURL: ${method} ${url}\nBody: ${text}`,
    );
  }

  if (options.validateSchema) {
    const body = (await res.json()) as unknown;
    const validate = ajv.compile(options.validateSchema);
    if (!validate(body)) {
      throw new Error(
        `Schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}`,
      );
    }
    return body;
  }

  return res.json().catch(() => null);
}

// ─── Async webhook helper ─────────────────────────────────────────────────────

export function waitForWebhook(
  path: string,
  timeout = 5000,
): Promise<{ body: unknown; headers: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Webhook to ${path} not received within ${timeout}ms`)),
      timeout,
    );
    webhookBus.once(path, (data: { body: unknown; headers: unknown }) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ─── Rate limit tester ────────────────────────────────────────────────────────

export async function testRateLimit(
  method: string,
  url: string,
  token: string,
  expectedLimit: number,
): Promise<void> {
  const requests = Array.from({ length: expectedLimit + 10 }, () =>
    apiRequest(method, url, {
      token,
      expectStatus: [200, 201, 429],
    })
      .then(() => 200 as const)
      .catch((err: Error) => {
        if (err.message.includes("429")) return 429 as const;
        throw err;
      }),
  );

  const results = await Promise.all(requests);
  const tooMany = results.filter((s) => s === 429);

  if (tooMany.length === 0) {
    throw new Error(
      `Rate limit of ${expectedLimit} not enforced on ${method} ${url}`,
    );
  }
}

// ─── OpenAPI spec diffing ─────────────────────────────────────────────────────

export function computeSpecDiff(
  oldSpec: unknown,
  newSpec: unknown,
): SpecDiff {
  const old = (oldSpec ?? {}) as Record<string, any>;
  const current = (newSpec ?? {}) as Record<string, any>;
  const changes: SpecChange[] = [];

  const oldPaths = (old.paths ?? {}) as Record<string, Record<string, unknown>>;
  const newPaths = (current.paths ?? {}) as Record<string, Record<string, unknown>>;

  // Added endpoints
  for (const [path, methods] of Object.entries(newPaths)) {
    for (const method of Object.keys(methods ?? {})) {
      if (!oldPaths[path]?.[method]) {
        changes.push({
          type: "added",
          endpoint: `${method.toUpperCase()} ${path}`,
          path,
          method,
          detail: "Endpoint added",
        });
      }
    }
  }

  // Removed endpoints
  for (const [path, methods] of Object.entries(oldPaths)) {
    for (const method of Object.keys(methods ?? {})) {
      if (!newPaths[path]?.[method]) {
        changes.push({
          type: "removed",
          endpoint: `${method.toUpperCase()} ${path}`,
          path,
          method,
          detail: "Endpoint removed",
        });
      }
    }
  }

  // Modified endpoint schemas
  for (const [path, methods] of Object.entries(newPaths)) {
    for (const [method, schema] of Object.entries(methods ?? {})) {
      const oldSchema = oldPaths[path]?.[method];
      if (oldSchema && JSON.stringify(oldSchema) !== JSON.stringify(schema)) {
        changes.push({
          type: "modified",
          endpoint: `${method.toUpperCase()} ${path}`,
          path,
          method,
          detail: "Schema changed",
        });
      }
    }
  }

  return {
    type: changes.length > 0 ? "changed" : "unchanged",
    changes,
  };
}

// ─── OpenAPI spec helpers ─────────────────────────────────────────────────────

export function getAllEndpoints(spec: unknown): EndpointSchema[] {
  const s = (spec ?? {}) as Record<string, any>;
  const endpoints: EndpointSchema[] = [];
  const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

  for (const [path, methods] of Object.entries(s.paths ?? {})) {
    for (const [method, schema] of Object.entries(
      (methods as Record<string, unknown>) ?? {},
    )) {
      if (HTTP_METHODS.includes(method)) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          ...(schema as object),
        });
      }
    }
  }

  return endpoints;
}

export function getEndpointSchema(
  spec: unknown,
  endpointStr: string,
): EndpointSchema | null {
  const s = (spec ?? {}) as Record<string, any>;
  const spaceIdx = endpointStr.indexOf(" ");
  const method = endpointStr.slice(0, spaceIdx).toLowerCase();
  const path = endpointStr.slice(spaceIdx + 1);
  const schema = s?.paths?.[path]?.[method];
  if (!schema) return null;
  return { method: method.toUpperCase(), path, ...(schema as object) };
}

// ─── Test generation helpers (used by API Tester agent) ──────────────────────

export function generateContractTests(endpoint: EndpointSchema): ApiTest[] {
  const expectedStatus: number[] =
    endpoint.method === "POST" ? [200, 201] : [200];
  return [
    {
      testName: `${endpoint.method} ${endpoint.path} — happy path`,
      method: endpoint.method,
      path: endpoint.path,
      headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
      expectedStatus,
    },
  ];
}

export function generateAuthTests(endpoint: EndpointSchema): ApiTest[] {
  const security = endpoint.security as unknown[] | undefined;
  if (!security || security.length === 0) return [];

  return [
    {
      testName: `${endpoint.method} ${endpoint.path} — no token → 401`,
      method: endpoint.method,
      path: endpoint.path,
      headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
      expectedStatus: 401,
    },
    {
      testName: `${endpoint.method} ${endpoint.path} — malformed token → 401`,
      method: endpoint.method,
      path: endpoint.path,
      headers: {
        "Content-Type": "application/json",
        "X-Test-Run": "true",
        Authorization: "Bearer invalid.token.value",
      },
      expectedStatus: 401,
    },
  ];
}

export function generateInputValidationTests(
  endpoint: EndpointSchema,
): ApiTest[] {
  const tests: ApiTest[] = [];
  const bodySchema =
    endpoint.requestBody?.content?.["application/json"]?.schema;

  if (!bodySchema) return tests;

  const requiredFields = bodySchema.required ?? [];
  const properties = bodySchema.properties ?? {};

  // Missing required field tests
  for (const field of requiredFields) {
    tests.push({
      testName: `${endpoint.method} ${endpoint.path} — missing "${field}" → 400`,
      method: endpoint.method,
      path: endpoint.path,
      headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
      requestBody: Object.fromEntries(
        requiredFields
          .filter((f) => f !== field)
          .map((f) => [f, "placeholder"]),
      ),
      expectedStatus: 400,
    });
  }

  // Security probes on string fields (cap at 3 to avoid explosion)
  const stringFields = Object.entries(properties)
    .filter(([, schema]) => (schema as any).type === "string")
    .map(([name]) => name)
    .slice(0, 3);

  for (const field of stringFields) {
    tests.push(
      {
        testName: `${endpoint.method} ${endpoint.path} — XSS in "${field}" → 400`,
        method: endpoint.method,
        path: endpoint.path,
        headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
        requestBody: { [field]: "<script>alert(1)</script>" },
        expectedStatus: [400, 422],
      },
      {
        testName: `${endpoint.method} ${endpoint.path} — SQL injection in "${field}" → 400`,
        method: endpoint.method,
        path: endpoint.path,
        headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
        requestBody: { [field]: "'; DROP TABLE users;--" },
        expectedStatus: [400, 422],
      },
    );
  }

  return tests;
}
