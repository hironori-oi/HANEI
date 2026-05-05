/**
 * seed-id-mapper.w5.test.ts (W12-T5 / DEC-079)
 *
 * 検証ポイント:
 *  1. assignW5Ids: L3-001 〜 L3-020 で 20 件
 *  2. loadAllSeedIds: total が 842 になる
 *  3. L3-001 〜 L3-020 が他 ID (L4-001..L4-100 / L5-001..L5-100 等) と衝突しない
 *  4. 既存 200 + 401 + 221 = 822 件が破壊されない
 *  5. 罰語 grep (失敗 / サボ / ダメ / 悪い) = 0 件
 *     (W5 audio_transcript / choices / explanation_jp 全件)
 */

import { describe, it, expect } from "vitest";
import { assignW5Ids, loadAllSeedIds } from "../../scripts/seed-id-mapper";
import w5Bundle from "../../scripts/seed-problems-w5";

describe("assignW5Ids() (W5 / DEC-079)", () => {
  it("L3-001 〜 L3-020 を出現順に振る (20 件)", () => {
    const r = assignW5Ids(w5Bundle);
    expect(r.choiceProblems.length).toBe(20);
    const ids = r.choiceProblems.map((p) => p.id);
    expect(ids[0]).toBe("L3-001");
    expect(ids[19]).toBe("L3-020");
    // 連番チェック
    for (let i = 0; i < 20; i++) {
      expect(ids[i]).toBe(`L3-${String(i + 1).padStart(3, "0")}`);
    }
  });

  it("全 W5 問題が level=eiken-3 / skill=listening", () => {
    const r = assignW5Ids(w5Bundle);
    for (const p of r.choiceProblems) {
      expect(p.level).toBe("eiken-3");
      expect(p.skill).toBe("listening");
      expect(p.choices.length).toBe(4);
      expect(p.correct_index).toBeGreaterThanOrEqual(0);
      expect(p.correct_index).toBeLessThanOrEqual(3);
      expect(p.audio_transcript).toBeDefined();
      expect((p.audio_transcript ?? "").length).toBeGreaterThan(0);
    }
  });
});

describe("loadAllSeedIds() / W5 統合 (DEC-079)", () => {
  it("total = 842 (200 + 401 + 221 + 20)", async () => {
    const all = await loadAllSeedIds();
    expect(all.total).toBe(842);
  });

  it("choiceProblems 内訳 = 200 (W2) + 271 (W3) + 181 (W4) + 20 (W5) = 672", async () => {
    const all = await loadAllSeedIds();
    expect(all.choiceProblems.length).toBe(672);
    expect(all.writingProblems.length).toBe(100);
    expect(all.reorderProblems.length).toBe(30);
    expect(all.readingPassageProblems.length).toBe(40);
  });

  it("L3-001 〜 L3-020 が含まれる", async () => {
    const all = await loadAllSeedIds();
    const ids = new Set(all.choiceProblems.map((p) => p.id));
    for (let i = 1; i <= 20; i++) {
      expect(ids.has(`L3-${String(i).padStart(3, "0")}`)).toBe(true);
    }
  });

  it("L3-XXX は L4-XXX / L5-XXX 等と衝突しない (重複なし)", async () => {
    const all = await loadAllSeedIds();
    const ids = all.choiceProblems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 既存 ID が破壊されていないことを 6 サンプルで確認
    const idSet = new Set(ids);
    expect(idSet.has("L4-001")).toBe(true);
    expect(idSet.has("L4-100")).toBe(true);
    expect(idSet.has("L5-001")).toBe(true);
    expect(idSet.has("L5-100")).toBe(true);
    expect(idSet.has("V5-001")).toBe(true);
    expect(idSet.has("V5W4-100")).toBe(true);
  });

  it("既存 822 件 (W2 200 + W3 401 + W4 221) が破壊されない", async () => {
    const all = await loadAllSeedIds();
    // W5 を除いた件数
    const nonW5Choice = all.choiceProblems.filter(
      (p) => !p.id.startsWith("L3-"),
    );
    expect(nonW5Choice.length).toBe(672 - 20);
    expect(
      nonW5Choice.length +
        all.writingProblems.length +
        all.reorderProblems.length +
        all.readingPassageProblems.length,
    ).toBe(822);
  });
});

describe("W5 罰語ゼロ grep (DEC-024)", () => {
  // 罰則ゼロ哲学 (DEC-024): 子どもに罰を与える文言を禁止
  // self-reference (本テストの BAN_WORDS 配列定義) は除外して、
  // 実データ (audio_transcript / choices / explanation_jp) だけを検査する
  const BAN_WORDS = ["失敗", "サボ", "ダメ", "悪い"] as const;

  it("audio_transcript / choices / explanation_jp に罰語が含まれない", () => {
    const r = assignW5Ids(w5Bundle);
    for (const p of r.choiceProblems) {
      const haystack = [
        p.audio_transcript ?? "",
        ...p.choices,
        p.explanation_jp,
      ].join(" / ");
      for (const w of BAN_WORDS) {
        expect(haystack).not.toContain(w);
      }
    }
  });
});
