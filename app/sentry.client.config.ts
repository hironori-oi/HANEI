/**
 * HANEI - Sentry Client Config (W2 / T-8 / W12-T3-C env 化 = DEC-071)
 *
 * Browser 側のエラー / パフォーマンス計測。
 * - PII (メール / IP) は送らない (子ども向けサービスのプライバシー方針)
 * - replay は エラー発生時のみ (replaysOnErrorSampleRate: 1.0)
 * - 通常時 Replay は 0% (帯域節約)
 *
 * W12-T3-C (DEC-071): env 化 = quota 緊急時に sample rate 0 / 完全停止可能。
 *   default 値は既存 hardcode と同値 → 既存挙動完全互換 (regression risk 構造的ゼロ)。
 *   NaN ガード = 万一 env 値が壊れても default 値で fallback。
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const parsedTracesSampleRate = Number.parseFloat(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
);
const tracesSampleRate = Number.isFinite(parsedTracesSampleRate)
  ? parsedTracesSampleRate
  : 0.1;

const parsedReplaysOnErrorSampleRate = Number.parseFloat(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? "1.0",
);
const replaysOnErrorSampleRate = Number.isFinite(parsedReplaysOnErrorSampleRate)
  ? parsedReplaysOnErrorSampleRate
  : 1.0;

const enabled =
  Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false";

Sentry.init({
  dsn,
  enabled,
  tracesSampleRate,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate,
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  beforeSend(event) {
    // PII をストリップ (子ども向けサービスの観点でメール / IP は送らない)
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
