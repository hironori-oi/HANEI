/**
 * SRS (FSRS) スケジューラの基本動作
 * (W2-09 / dev-w2 R-6)
 *
 * 検証ポイント:
 *  - 初期カードは state=0 (New), reps=0
 *  - 正答 (Good) で due_at が未来へ伸びる (stability 増)
 *  - 誤答 (Again) で短時間で再出題 (state は Learning/Relearning, lapses 増)
 *  - 複数回正答すると stability が単調に増えること
 */

import { describe, it, expect } from "vitest";
import { initialCard, reviewCard } from "@/lib/srs/fsrs";

describe("initialCard()", () => {
  it("state=0 / reps=0 / lapses=0 / lastReview=null", () => {
    const c = initialCard(new Date("2026-04-26T00:00:00Z"));
    expect(c.state).toBe(0);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(0);
    expect(c.lastReview).toBeNull();
    expect(c.due.getTime()).toBe(new Date("2026-04-26T00:00:00Z").getTime());
  });
});

describe("reviewCard() - 正答 (Good)", () => {
  it("due が現在より未来になる", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const out = reviewCard(initialCard(now), true, now);
    expect(out.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("reps が 1 以上に増える", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const out = reviewCard(initialCard(now), true, now);
    expect(out.reps).toBeGreaterThanOrEqual(1);
  });

  it("lapses は 0 のまま", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const out = reviewCard(initialCard(now), true, now);
    expect(out.lapses).toBe(0);
  });

  it("lastReview が now で更新される", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const out = reviewCard(initialCard(now), true, now);
    expect(out.lastReview.getTime()).toBeCloseTo(now.getTime(), -2);
  });
});

describe("reviewCard() - 誤答 (Again)", () => {
  it("lapses が 1 以上に増える (Review 状態のカードで)", () => {
    let now = new Date("2026-04-26T00:00:00Z");
    // まず 1 回正答して Learning -> Review に進めてから誤答
    let card = initialCard(now);
    const r1 = reviewCard(card, true, now);
    card = {
      stability: r1.stability,
      difficulty: r1.difficulty,
      due: r1.due,
      state: r1.state,
      reps: r1.reps,
      lapses: r1.lapses,
      lastReview: r1.lastReview,
    };
    now = new Date("2026-05-26T00:00:00Z"); // 1 month later
    const r2 = reviewCard(card, true, now);
    card = {
      stability: r2.stability,
      difficulty: r2.difficulty,
      due: r2.due,
      state: r2.state,
      reps: r2.reps,
      lapses: r2.lapses,
      lastReview: r2.lastReview,
    };
    now = new Date("2026-07-26T00:00:00Z");
    const r3 = reviewCard(card, false, now);
    expect(r3.lapses).toBeGreaterThanOrEqual(1);
  });

  it("New カードでの誤答は state を Learning/Relearning に切り替える", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const out = reviewCard(initialCard(now), false, now);
    // ts-fsrs では New (0) -> Learning (1) or Relearning (3) のいずれか
    expect([1, 3]).toContain(out.state);
  });
});

describe("reviewCard() - 複数回正答で stability が単調増加", () => {
  it("Good を 3 回続けると stability が増えていく", () => {
    let now = new Date("2026-04-26T00:00:00Z");
    let card = initialCard(now);

    const r1 = reviewCard(card, true, now);
    card = {
      stability: r1.stability,
      difficulty: r1.difficulty,
      due: r1.due,
      state: r1.state,
      reps: r1.reps,
      lapses: r1.lapses,
      lastReview: r1.lastReview,
    };

    now = new Date(r1.due.getTime() + 1000);
    const r2 = reviewCard(card, true, now);
    card = {
      stability: r2.stability,
      difficulty: r2.difficulty,
      due: r2.due,
      state: r2.state,
      reps: r2.reps,
      lapses: r2.lapses,
      lastReview: r2.lastReview,
    };

    now = new Date(r2.due.getTime() + 1000);
    const r3 = reviewCard(card, true, now);

    expect(r2.stability).toBeGreaterThanOrEqual(r1.stability);
    expect(r3.stability).toBeGreaterThanOrEqual(r2.stability);
  });
});
