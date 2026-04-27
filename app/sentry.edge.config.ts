/**
 * HANEI - Sentry Edge Config (W2 / T-8)
 *
 * Edge ランタイム (proxy / middleware) のエラー計測。
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }
    return event;
  },
});
