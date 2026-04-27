/**
 * HANEI - Sentry Client Config (W2 / T-8)
 *
 * Browser 側のエラー / パフォーマンス計測。
 * - PII (メール / IP) は送らない (子ども向けサービスのプライバシー方針)
 * - replay は エラー発生時のみ (replaysOnErrorSampleRate: 1.0)
 * - 通常時 Replay は 0% (帯域節約)
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
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
