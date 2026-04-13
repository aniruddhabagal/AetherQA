/**
 * Voice / mic testing utilities for AetherQA.
 *
 * Two strategies:
 *   A — Web Speech API mock (injectSpeechMock / injectSpeechErrorMock)
 *       For apps that use window.SpeechRecognition directly.
 *       Must be called BEFORE page.goto().
 *
 *   B — getUserMedia + fake audio file (launchWithFakeAudio)
 *       For apps that send raw audio to a backend (Deepgram, Whisper, etc.).
 *       Forces workers: 1 because the audio file path is set at browser launch.
 *
 * Use mockTranscriptionEndpoint when you only need to test the app's reaction
 * to a transcript — not the capture itself. Much simpler and parallelizable.
 */

import { Page, chromium, BrowserContext } from "playwright";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpeechError =
  | "not-allowed"
  | "no-speech"
  | "aborted"
  | "network"
  | "audio-capture"
  | "service-not-allowed";

// ─── Strategy A — Web Speech API mock ────────────────────────────────────────

/**
 * Inject a fully controllable SpeechRecognition stub before page load.
 * MUST be called before page.goto().
 *
 * The mock fires:
 *   1. onstart + onspeechstart immediately
 *   2. interim onresult events (word by word) if interimResults: true
 *   3. final onresult with isFinal: true after delayMs
 *   4. onend after the final result
 */
export async function injectSpeechMock(
  page: Page,
  transcript: string,
  options: {
    confidence?: number;
    delayMs?: number;
    interimResults?: boolean;
  } = {},
): Promise<void> {
  const { confidence = 0.95, delayMs = 800, interimResults = false } = options;

  await page.addInitScript(
    ({ transcript, confidence, delayMs, interimResults }) => {
      class MockSpeechRecognition extends EventTarget {
        continuous = false;
        interimResults = interimResults;
        lang = "en-US";
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onstart: (() => void) | null = null;
        onspeechstart: (() => void) | null = null;
        onspeechend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onstart?.();
            this.onspeechstart?.();
          }, 50);

          if (interimResults) {
            const words = transcript.split(" ");
            words.forEach((word, i) => {
              setTimeout(() => {
                const partial = words.slice(0, i + 1).join(" ");
                this.onresult?.({
                  resultIndex: 0,
                  results: {
                    0: [{ transcript: partial, confidence: 0.5, isFinal: false }],
                    length: 1,
                  },
                });
              }, (delayMs / words.length) * i);
            });
          }

          // Final result
          setTimeout(() => {
            this.onspeechend?.();
            this.onresult?.({
              resultIndex: 0,
              results: {
                0: [{ transcript, confidence, isFinal: true }],
                length: 1,
                item: (_i: number) => [{ transcript, confidence, isFinal: true }],
              },
            });
            setTimeout(() => this.onend?.(), 100);
          }, delayMs);
        }

        stop() {
          this.onspeechend?.();
          this.onend?.();
        }

        abort() {
          this.onend?.();
        }
      }

      Object.defineProperty(window, "SpeechRecognition", {
        value: MockSpeechRecognition,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        value: MockSpeechRecognition,
        writable: true,
        configurable: true,
      });
    },
    { transcript, confidence, delayMs, interimResults },
  );
}

/**
 * Inject a speech recognition error stub.
 * Use for testing: not-allowed, no-speech, aborted, network, audio-capture errors.
 * MUST be called before page.goto().
 */
export async function injectSpeechErrorMock(
  page: Page,
  errorType: SpeechError,
): Promise<void> {
  await page.addInitScript((errorType) => {
    class ErrorSpeechRecognition extends EventTarget {
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;

      start() {
        setTimeout(() => this.onstart?.(), 50);
        setTimeout(() => {
          this.onerror?.({
            error: errorType,
            message: `Speech recognition error: ${errorType}`,
          });
          this.onend?.();
        }, 300);
      }

      stop() {}
      abort() {}
    }

    Object.defineProperty(window, "SpeechRecognition", {
      value: ErrorSpeechRecognition,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: ErrorSpeechRecognition,
      writable: true,
      configurable: true,
    });
  }, errorType);
}

// ─── Strategy B — getUserMedia + fake audio file ──────────────────────────────

/**
 * Launch a browser context with a fake audio device backed by a WAV file.
 *
 * IMPORTANT constraints:
 * - The WAV file path is set at browser launch — cannot change mid-test.
 * - Forces sequential execution: use workers: 1 in the Playwright project config.
 * - The %noloop flag ensures the file plays exactly once.
 * - Auto-grants microphone permission so no dialog appears.
 */
export async function launchWithFakeAudio(
  wavFilePath: string,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${path.resolve(wavFilePath)}%noloop`,
    ],
    permissions: ["microphone"],
  });
}

// ─── Mock backend transcription endpoint ──────────────────────────────────────

/**
 * Intercept the transcription API and return a controlled transcript.
 * Use this when testing the app's RESPONSE to transcripts — not the capture itself.
 * Much simpler than fake audio injection and safe to parallelize.
 */
export async function mockTranscriptionEndpoint(
  page: Page,
  transcript: string,
  endpoint = "**/api/transcribe",
): Promise<void> {
  await page.route(endpoint, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transcript,
        confidence: 0.95,
        words: transcript.split(" ").map((w, i) => ({
          word: w,
          start: i * 0.3,
          end: (i + 1) * 0.3,
          confidence: 0.95,
        })),
      }),
    });
  });
}

// ─── Test fixture manifest ────────────────────────────────────────────────────

/**
 * Manifest for the audio fixture library in tests/fixtures/audio/.
 * Run `npx tsx src/tools/voice.tools.ts` to generate the WAV files.
 */
export const AUDIO_FIXTURE_MANIFEST: Record<
  string,
  { transcript?: string; lang?: string; expectError?: string; noisy?: boolean; label?: string; confidence?: number }
> = {
  "clear-english.wav": {
    transcript: "show me blue running shoes",
    lang: "en-US",
  },
  "accented-query.wav": {
    transcript: "what is the weather today",
    lang: "en-IN",
  },
  "silence-3s.wav": {
    transcript: "",
    expectError: "no-speech",
  },
  "background-noise.wav": {
    transcript: "order pizza",
    noisy: true,
  },
  "very-long-utterance.wav": {
    transcript: "a ".repeat(200).trim(),
    label: "input overflow",
  },
  "non-english.wav": {
    transcript: "¿cuál es el clima hoy?",
    lang: "es-ES",
  },
  "whispered-input.wav": {
    transcript: "reminder at five pm",
    confidence: 0.62,
  },
};

// ─── Test matrix ──────────────────────────────────────────────────────────────

/**
 * Used by the Test Case agent to generate a comprehensive voice test suite.
 * Covers happy path, edge cases, and all error states.
 */
export const VOICE_TEST_MATRIX = [
  // Happy path
  { type: "happy", transcript: "show me blue running shoes", confidence: 0.97 },
  { type: "happy", transcript: "what lessons are available today", confidence: 0.91 },
  // Edge: input characteristics
  { type: "edge", transcript: "a", confidence: 0.99, label: "single character" },
  { type: "edge", transcript: "a ".repeat(500).trim(), confidence: 0.85, label: "extremely long" },
  { type: "edge", transcript: "", confidence: 0.0, label: "empty transcript" },
  // Error states
  { type: "error", error: "not-allowed" as SpeechError, expectedUI: /microphone.*denied|permission/i },
  { type: "error", error: "no-speech" as SpeechError, expectedUI: /nothing heard|try again/i },
  { type: "error", error: "aborted" as SpeechError, expectedUI: /recording stopped/i },
  { type: "error", error: "network" as SpeechError, expectedUI: /unavailable|connection/i },
  { type: "error", error: "audio-capture" as SpeechError, expectedUI: /microphone.*problem/i },
];

// ─── WAV fixture generator ────────────────────────────────────────────────────

/**
 * Generate a minimal valid WAV file containing silence.
 * Called during fixture setup — not during tests themselves.
 *
 * @param durationSeconds  Length of silence in seconds
 * @param sampleRate       Default 44100 Hz
 */
export function buildSilenceWav(
  durationSeconds: number,
  sampleRate = 44100,
): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buf.write("RIFF", offset); offset += 4;
  buf.writeUInt32LE(fileSize, offset); offset += 4;
  buf.write("WAVE", offset); offset += 4;

  // fmt chunk
  buf.write("fmt ", offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;           // chunk size
  buf.writeUInt16LE(1, offset); offset += 2;            // PCM
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // byte rate
  buf.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2; // block align
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk (zeros = silence)
  buf.write("data", offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); // offset += 4; — rest is already 0

  return buf;
}
