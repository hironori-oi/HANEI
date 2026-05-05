/**
 * admin.sentry-test.test.ts (DEC-081 / Phase 3 第 1 波 β 開始前必須 atomic)
 *
 * `GET /api/admin/sentry-test` の動作検証:
 *  - admin role → 200 + Sentry capture mock 呼ばれた + level クエリ反映
 *  - parent role → 401
 *  - learner role → 401
 *  - unauthenticated → 401
 *  - level=warning / error / fatal の 3 分岐すべて動作
 *
 * パターン: feedback.submit.test.ts (Sentry mock) + auth.guards.test.ts (db mock) を融合.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Sentry mock
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// auth/guards の getSession を mock (Better Auth 経路を呼ばない)
vi.mock("@/lib/auth/guards", () => ({
  getSession: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/guards";
import { GET } from "@/app/api/admin/sentry-test/route";

const mockCaptureMessage = Sentry.captureMessage as unknown as Mock;
const mockCaptureException = Sentry.captureException as unknown as Mock;
const mockGetSession = getSession as unknown as Mock;

function makeRequest(level?: string) {
  const url = level
    ? `https://hanei.test/api/admin/sentry-test?level=${level}`
    : "https://hanei.test/api/admin/sentry-test";
  return {
    url,
    headers: {
      get: () => null,
    },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin sentry-test / 認可", () => {
  it("admin role → 200 + Sentry captureException 呼出 + default level=error", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user_admin",
      email: "admin@hanei.test",
      role: "admin",
      emailVerified: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.level).toBe("error");
    expect(typeof body.capturedAt).toBe("string");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it("parent role → 401 / Sentry 未呼出", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user_parent",
      email: "parent@hanei.test",
      role: "parent",
      emailVerified: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("learner role → 401 / Sentry 未呼出", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user_learner",
      email: "learner@hanei.test",
      role: "learner",
      emailVerified: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("unauthenticated (session=null) → 401 / Sentry 未呼出", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe("admin sentry-test / level クエリ 3 分岐", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      userId: "user_admin",
      email: "admin@hanei.test",
      role: "admin",
      emailVerified: true,
    });
  });

  it("level=warning → captureMessage(warning) + captureException 双方呼出", async () => {
    const res = await GET(makeRequest("warning"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe("warning");

    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [msgArg, levelArg] = mockCaptureMessage.mock.calls[0]!;
    expect(msgArg).toContain("[sentry-test] level=warning");
    expect(levelArg).toBe("warning");

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const errArg = mockCaptureException.mock.calls[0]![0];
    expect(errArg).toBeInstanceOf(Error);
    expect((errArg as Error).message).toContain("level=warning");
  });

  it("level=error → captureException のみ呼出 / captureMessage 未呼出", async () => {
    const res = await GET(makeRequest("error"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe("error");

    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const errArg = mockCaptureException.mock.calls[0]![0];
    expect((errArg as Error).message).toContain("level=error");
  });

  it("level=fatal → captureException のみ呼出 / captureMessage 未呼出", async () => {
    const res = await GET(makeRequest("fatal"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe("fatal");

    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const errArg = mockCaptureException.mock.calls[0]![0];
    expect((errArg as Error).message).toContain("level=fatal");
  });

  it("level=invalid (不正値) → default error 扱い", async () => {
    const res = await GET(makeRequest("invalid"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe("error");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it("level クエリなし → default error 扱い", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.level).toBe("error");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
