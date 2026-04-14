// src/tools/db-seeder.tools.ts
// Calls POST /api/test/seed on the main backend to create isolated fixture data.
// All seeded data is wrapped in a DB transaction that auto-rolls back after the request.

import { config } from "../config.js";

export async function seedTestData(
  scenario: string,
  targetUrl: string = config.defaultTargetUrl,
): Promise<Record<string, string>> {
  const res = await fetch(`${targetUrl}/api/test/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Run": "true",
    },
    body: JSON.stringify({ scenario }),
  });

  if (!res.ok) {
    throw new Error(
      `Seed failed for scenario "${scenario}": ${await res.text()}`,
    );
  }

  return res.json() as Promise<Record<string, string>>;
}

// Fixture catalog — maintained by the Test Case agent, grows over time.
// The scenarios here map 1:1 to the SCENARIOS object in /api/test/seed.
export const FIXTURE_SCENARIOS = {
  "lesson-with-pronunciation":
    "A lesson with pronunciation exercise, no prior attempts",
  "lesson-completed": "A lesson already marked complete with score 85",
  "user-with-streak": "A user with a 7-day streak active",
  "user-streak-at-risk": "A user whose streak expires in 2 hours",
  "vocabulary-set-empty": "A vocabulary module with 0 words added",
  "vocabulary-set-full": "A vocabulary module at max capacity (500 words)",
  "leaderboard-with-10-users":
    "10 users with varying scores for leaderboard testing",
  "premium-user": "A user with premium subscription active",
  "expired-subscription": "A user whose subscription expired yesterday",
} as const;

export type FixtureScenario = keyof typeof FIXTURE_SCENARIOS;
