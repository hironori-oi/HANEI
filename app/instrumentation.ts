/**
 * HANEI - Next.js instrumentation.ts (W2 / T-8)
 *
 * Sentry の server / edge ランタイム初期化を register() で振り分ける。
 * client 側は sentry.client.config.ts が自動で読み込まれる。
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
