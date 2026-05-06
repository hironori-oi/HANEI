/**
 * onboarding.storage.test.ts (DEC-088 Plan B / 項目 4)
 *
 * `lib/onboarding/storage` の localStorage flag 管理を検証する.
 *
 * 環境: node 環境 (vitest default) で window を minimal polyfill する.
 *  - jsdom を依存に追加しない方針 (bundle / install 時間を抑制)
 *  - module は localStorage の存在のみに依存するため、最小 stub で十分
 *
 * 検証ポイント:
 *  1. SSR (window 不在) フォールバック → isOnboardingShown() = true (安全側)
 *  2. flag 未設定で false
 *  3. markOnboardingShown 後に true
 *  4. localStorage が throw しても安全側 true
 *  5. __resetOnboardingForTest が flag をクリアする
 *  6. ONBOARDING_STORAGE_KEY = "hanei.onboarding.shown"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

/** in-memory localStorage stub. */
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

function installWindow(localStorage = createMemoryStorage()) {
  // @ts-expect-error - test 用 minimal window stub
  globalThis.window = { localStorage };
}

function uninstallWindow() {
  // @ts-expect-error - test cleanup
  delete globalThis.window;
}

// SSR フォールバックの test ブロックがクリーンに動くよう、
// import は test 関数内で動的に行う = キャッシュ汚染を避ける.
async function freshImport() {
  // vi.resetModules で aggregations 含む依存も毎回 fresh
  return await import("@/lib/onboarding/storage");
}

describe("ONBOARDING_STORAGE_KEY", () => {
  it("expected key 名が hanei.onboarding.shown", async () => {
    installWindow();
    const mod = await freshImport();
    expect(mod.ONBOARDING_STORAGE_KEY).toBe("hanei.onboarding.shown");
    uninstallWindow();
  });
});

describe("isOnboardingShown / markOnboardingShown (window stub)", () => {
  beforeEach(() => {
    installWindow();
  });

  afterEach(() => {
    uninstallWindow();
  });

  it("flag 未設定なら false (= 表示する)", async () => {
    const { isOnboardingShown } = await freshImport();
    expect(isOnboardingShown()).toBe(false);
  });

  it("markOnboardingShown 後は true", async () => {
    const { isOnboardingShown, markOnboardingShown } = await freshImport();
    markOnboardingShown();
    expect(isOnboardingShown()).toBe(true);
  });

  it("__resetOnboardingForTest で flag を消去できる", async () => {
    const { isOnboardingShown, markOnboardingShown, __resetOnboardingForTest } =
      await freshImport();
    markOnboardingShown();
    expect(isOnboardingShown()).toBe(true);
    __resetOnboardingForTest();
    expect(isOnboardingShown()).toBe(false);
  });

  it("localStorage.getItem が throw しても安全側 true (= 再表示しない)", async () => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    };
    const { isOnboardingShown } = await freshImport();
    expect(isOnboardingShown()).toBe(true);
  });

  it("markOnboardingShown が throw しても silent (例外を吐かない)", async () => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    };
    const { markOnboardingShown } = await freshImport();
    expect(() => markOnboardingShown()).not.toThrow();
  });
});

describe("isOnboardingShown SSR フォールバック (window 不在)", () => {
  beforeEach(() => {
    uninstallWindow();
  });

  it("window 不在環境では常に true (= 描画スキップ / 安全側)", async () => {
    const { isOnboardingShown } = await freshImport();
    expect(isOnboardingShown()).toBe(true);
  });

  it("markOnboardingShown も window 不在では no-op (throw しない)", async () => {
    const { markOnboardingShown } = await freshImport();
    expect(() => markOnboardingShown()).not.toThrow();
  });
});
