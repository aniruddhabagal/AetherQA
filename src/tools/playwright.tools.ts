import { chromium, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs/promises";

// ─── Auth context ─────────────────────────────────────────────────────────────

export async function createAuthContext(
  role: "user" | "admin" | "viewer" = "user",
): Promise<BrowserContext> {
  const statePath = path.resolve(`tests/.auth/${role}.json`);

  try {
    await fs.access(statePath);
    const browser = await chromium.launch({ headless: true });
    return browser.newContext({ storageState: statePath });
  } catch {
    // No saved state — create a fresh context (auth setup hasn't run yet)
    const browser = await chromium.launch({ headless: true });
    return browser.newContext();
  }
}

// ─── Overlay dismissal ────────────────────────────────────────────────────────

const OVERLAY_SELECTORS = [
  // Cookie consent banners
  '[aria-label*="cookie" i] button',
  '[aria-label*="consent" i] button',
  'button[id*="accept" i]',
  'button[id*="cookie" i]',
  '#onetrust-accept-btn-handler',
  '.cookie-consent button',
  // Generic modals / dialogs
  '[role="dialog"] button[aria-label*="close" i]',
  '[role="dialog"] button[aria-label*="dismiss" i]',
  '.modal-close',
  '[data-testid="modal-close"]',
  // Notification prompts
  '[aria-label*="notification" i] button[aria-label*="no" i]',
  // Generic "Got it" / "Dismiss" / "Close" buttons that appear over content
  'button:has-text("Got it")',
  'button:has-text("Dismiss")',
  'button:has-text("No thanks")',
  'button:has-text("Skip")',
];

export async function dismissOverlays(
  page: Page,
  agentMemory = "",
): Promise<void> {
  // Try selectors in parallel — only click the first visible one
  for (const selector of OVERLAY_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      const visible = await el.isVisible({ timeout: 500 }).catch(() => false);
      if (visible) {
        await el.click({ timeout: 1000 });
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      }
    } catch {
      // Not present — continue
    }
  }

  // Also handle any patterns the Explorer has learned from memory
  if (agentMemory) {
    const learnedSelectors = extractLearnedSelectors(agentMemory);
    for (const selector of learnedSelectors) {
      try {
        const el = page.locator(selector).first();
        const visible = await el.isVisible({ timeout: 500 }).catch(() => false);
        if (visible) await el.click({ timeout: 1000 });
      } catch {
        // Skip
      }
    }
  }
}

function extractLearnedSelectors(memory: string): string[] {
  const matches = memory.match(/overlay selector: ([^\n]+)/g) ?? [];
  return matches.map((m) => m.replace("overlay selector: ", "").trim());
}

// ─── Animation / transition waits ────────────────────────────────────────────

export async function waitForAnimationEnd(
  page: Page,
  selector: string,
): Promise<void> {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return true;
    const style = getComputedStyle(el);
    return (
      style.animationPlayState === "paused" ||
      style.animationName === "none"
    );
  }, selector);
}

// ─── Token refresh handler ────────────────────────────────────────────────────

export function handleTokenRefresh(page: Page): void {
  page.on("response", async (response) => {
    if (response.status() === 401 && response.url().includes("/api/")) {
      await page.evaluate(() => localStorage.removeItem("token"));
      await page.reload();
    }
  });
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

export async function takeScreenshot(
  page: Page,
  runId: string,
  route: string,
): Promise<string> {
  const safeName = route.replace(/\//g, "_").replace(/^_/, "");
  const screenshotDir = path.resolve(`runs/${runId}`);
  await fs.mkdir(screenshotDir, { recursive: true });

  const screenshotPath = path.join(screenshotDir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}
