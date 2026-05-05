/**
 * cron.monthly-budget-alert.test.ts (DEC-081 / Phase 3 第 1 波 β 開始前必須 atomic)
 *
 * `GET /api/cron/monthly-budget-alert` の動作検証:
 *  - 認可: x-vercel-cron-signature / Authorization: Bearer <CRON_SECRET> / 両方なし → 401
 *  - 集計閾値判定: ¥0 / ¥2,399 / ¥2,400 / ¥3,000 / ¥3,600 の 5 段階で alerted / severity を検証
 *  - Sentry mock: captureMessage 呼び出しを引数レベルで検証
 *
 * パターン: ai.cost-guard.test.ts (DB mock) + feedback.submit.test.ts (Sentry mock) を融合.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Sentry mock (feedback.submit.test.ts と同パターン)
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// db client mock (ai.cost-guard.test.ts と同パターン)
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
  },
  schema: {},
}));

import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db/client";
import { GET } from "@/app/api/cron/monthly-budget-alert/route";

const mockCaptureMessage = Sentry.captureMessage as unknown as Mock;
const mockCaptureException = Sentry.captureException as unknown as Mock;

/**
 * drizzle chain mock: db.select().from().where()
 */
function mockSelectChain(returnValue: unknown[]) {
  const where = vi.fn().mockResolvedValue(returnValue);
  const from = vi.fn().mockReturnValue({ where });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

/**
 * NextRequest 風の最小 mock (headers + url のみ).
 * route handler が参照するのは headers.get / new URL(req.url).searchParams のみ.
 */
function makeRequest(opts: {
  vercelSig?: string;
  authorization?: string;
  url?: string;
}) {
  const headers = new Map<string, string>();
  if (opts.vercelSig) headers.set("x-vercel-cron-signature", opts.vercelSig);
  if (opts.authorization) headers.set("authorization", opts.authorization);
  return {
    url: opts.url ?? "https://hanei.test/api/cron/monthly-budget-alert",
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  // env をクリア (test 間干渉防止)
  delete process.env.CRON_SECRET;
  delete process.env.MONTHLY_BUDGET_JPY;
});

describe("cron monthly-budget-alert / 認可", () => {
  it("x-vercel-cron-signature ヘッダあり → 200 + alerted=false (¥0)", async () => {
    mockSelectChain([{ total: 0 }]);
    const res = await GET(makeRequest({ vercelSig: "fake-sig" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alerted).toBe(false);
    expect(body.current).toBe(0);
  });

  it("Authorization: Bearer <CRON_SECRET> ヘッダあり → 200 + alerted=false (¥0)", async () => {
    process.env.CRON_SECRET = "secret-abc";
    mockSelectChain([{ total: 0 }]);
    const res = await GET(makeRequest({ authorization: "Bearer secret-abc" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alerted).toBe(false);
  });

  it("両方なし → 401", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("CRON_SECRET 不一致の Bearer → 401", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const res = await GET(makeRequest({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });
});

describe("cron monthly-budget-alert / 閾値判定 (default budget ¥3,000)", () => {
  it("current=¥0 → no alert / 200 + alerted=false / Sentry 未呼出", async () => {
    mockSelectChain([{ total: 0 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.alerted).toBe(false);
    expect(body.severity).toBe(null);
    expect(body.current).toBe(0);
    expect(body.budget).toBe(3000);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("current=¥2,399 (79.97%) → no alert / alerted=false / Sentry 未呼出", async () => {
    mockSelectChain([{ total: 2399 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.alerted).toBe(false);
    expect(body.severity).toBe(null);
    expect(body.pct).toBeLessThan(80);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("current=¥2,400 (80.0%) → warning alert / alerted=true / Sentry captureMessage 呼出", async () => {
    mockSelectChain([{ total: 2400 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.alerted).toBe(true);
    expect(body.severity).toBe("warning");
    expect(body.current).toBe(2400);
    expect(body.pct).toBeGreaterThanOrEqual(80);
    expect(body.pct).toBeLessThan(100);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [msgArg, levelArg] = mockCaptureMessage.mock.calls[0]!;
    expect(msgArg).toContain("monthly budget alert");
    expect(msgArg).toContain("severity=warning");
    expect(msgArg).toContain("¥2400/3000");
    expect(levelArg).toBe("warning");
  });

  it("current=¥3,000 (100.0%) → error severity / alerted=true / message に severity=error", async () => {
    mockSelectChain([{ total: 3000 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.alerted).toBe(true);
    expect(body.severity).toBe("error");
    expect(body.pct).toBeGreaterThanOrEqual(100);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [msgArg] = mockCaptureMessage.mock.calls[0]!;
    expect(msgArg).toContain("severity=error");
    expect(msgArg).toContain("¥3000/3000");
  });

  it("current=¥3,600 (120.0%) → fatal severity / alerted=true / message に severity=fatal", async () => {
    mockSelectChain([{ total: 3600 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.alerted).toBe(true);
    expect(body.severity).toBe("fatal");
    expect(body.pct).toBeGreaterThanOrEqual(120);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [msgArg] = mockCaptureMessage.mock.calls[0]!;
    expect(msgArg).toContain("severity=fatal");
    expect(msgArg).toContain("¥3600/3000");
  });
});

describe("cron monthly-budget-alert / env MONTHLY_BUDGET_JPY 上書き", () => {
  it("MONTHLY_BUDGET_JPY=5000 で current=¥4,000 (80%) → warning alert", async () => {
    process.env.MONTHLY_BUDGET_JPY = "5000";
    mockSelectChain([{ total: 4000 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.budget).toBe(5000);
    expect(body.alerted).toBe(true);
    expect(body.severity).toBe("warning");
  });

  it("MONTHLY_BUDGET_JPY が NaN / 0 / 負値 → default 3000 fallback", async () => {
    process.env.MONTHLY_BUDGET_JPY = "not-a-number";
    mockSelectChain([{ total: 0 }]);
    const res = await GET(makeRequest({ vercelSig: "sig" }));
    const body = await res.json();
    expect(body.budget).toBe(3000);
  });
});

describe("cron monthly-budget-alert / DB error 吸収", () => {
  it("DB select が throw しても 200 + alerted=false / Sentry captureException 呼出", async () => {
    const from = vi.fn().mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("db down")),
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const res = await GET(makeRequest({ vercelSig: "sig" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alerted).toBe(false);
    expect(body.errors).toContain("db down");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
