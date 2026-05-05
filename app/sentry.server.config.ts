/**
 * HANEI - Sentry Server Config (W2 / T-8 / W12-T3-C env 化 = DEC-071)
 *
 * Node ランタイム (Server Action / Route Handler) のエラー / トレース計測。
 *
 * W12-T3-C (DEC-071): env 化 = quota 緊急時に sample rate 0 / 完全停止可能。
 *   default 値は既存 hardcode と同値 → 既存挙動完全互換 (regression risk 構造的ゼロ)。
 *   NaN ガード = 万一 env 値が壊れても default 値で fallback。
 *   server / edge は NEXT_PUBLIC prefix 不要。
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const parsedTracesSampleRate = Number.parseFloat(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
);
const tracesSampleRate = Number.isFinite(parsedTracesSampleRate)
  ? parsedTracesSampleRate
  : 0.1;

const enabled = Boolean(dsn) && process.env.SENTRY_ENABLED !== "false";

Sentry.init({
  dsn,
  enabled,
  tracesSampleRate,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    if (event.request?.headers) {
      // 認証 cookie を送らない
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }
    return event;
  },
});
