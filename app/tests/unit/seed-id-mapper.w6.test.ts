/**
 * seed-id-mapper.w6.test.ts (W12 / DEC-094)
 *
 * 検証ポイント (W5 と同型):
 *  1. assignW6Ids: G3-001 〜 G3-030 (30 件) + L3-021 〜 L3-050 (30 件) = 60 件
 *  2. 全 W6 grammar が level=eiken-3 / skill=grammar / choices=4
 *  3. 全 W6 listening が level=eiken-3 / skill=listening / audio_transcript present
 *  4. correct_index 分散検査 (各 0..3 が 7-9 件 / grammar / listening 別)
 *  5. loadAllSeedIds total=902 (W5 baseline 882 から +20 した上で W5 自体は 20 件 / 計 902)
 *  6. ID 衝突なし (G3-XXX 新規 / L3-021..050 が W5 L3-001..020 と非衝突)
 *  7. 罰語ゼロ grep (DEC-024)
 *  8. 既存 842 件 (902 - 60) が破壊されない
 */

import { describe, it, expect } from "vitest";
import { assignW6Ids, loadAllSeedIds } from "../../scripts/seed-id-mapper";
import w6Bundle from "../../scripts/seed-problems-w6";

describe("assignW6Ids() (W6 / DEC-094)", () => {
  it("G3-001 〜 G3-030 + L3-021 〜 L3-050 を出現順に振る (60 件)", () => {
    const r = assignW6Ids(w6Bundle);
    expect(r.choiceProblems.length).toBe(60);

    const ids = r.choiceProblems.map((p) => p.id);
    // grammar 30 問: G3-001 〜 G3-030
    for (let i = 0; i < 30; i++) {
      expect(ids[i]).toBe(`G3-${String(i + 1).padStart(3, "0")}`);
    }
    // listening 30 問: L3-021 〜 L3-050 (W5 L3-001..020 と連番接続)
    for (let i = 0; i < 30; i++) {
      expect(ids[30 + i]).toBe(`L3-${String(i + 21).padStart(3, "0")}`);
    }
  });

  it("全 W6 grammar が level=eiken-3 / skill=grammar / choices=4", () => {
    const r = assignW6Ids(w6Bundle);
    const grammar = r.choiceProblems.filter((p) => p.id.startsWith("G3-"));
    expect(grammar.length).toBe(30);
    for (const p of grammar) {
      expect(p.level).toBe("eiken-3");
      expect(p.skill).toBe("grammar");
      expect(p.choices.length).toBe(4);
      expect(p.correct_index).toBeGreaterThanOrEqual(0);
      expect(p.correct_index).toBeLessThanOrEqual(3);
      // grammar には audio_transcript は不要
      expect(p.audio_transcript).toBeUndefined();
      // 空欄補充形式 ((   ) を含む) を期待
      expect(p.prompt_text).toContain("(   )");
    }
  });

  it("全 W6 listening が level=eiken-3 / skill=listening / audio_transcript present", () => {
    const r = assignW6Ids(w6Bundle);
    const listening = r.choiceProblems.filter((p) => p.id.startsWith("L3-"));
    expect(listening.length).toBe(30);
    for (const p of listening) {
      expect(p.level).toBe("eiken-3");
      expect(p.skill).toBe("listening");
      expect(p.choices.length).toBe(4);
      expect(p.correct_index).toBeGreaterThanOrEqual(0);
      expect(p.correct_index).toBeLessThanOrEqual(3);
      expect(p.audio_transcript).toBeDefined();
      const t = p.audio_transcript ?? "";
      expect(t.length).toBeGreaterThan(0);
      // kid-safe 30-100 chars 範囲 (W5 と同型)
      expect(t.length).toBeGreaterThanOrEqual(30);
      expect(t.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("W6 correct_index 均等分散 (DEC-094)", () => {
  it("grammar 30 問の correct_index が 0..3 で 7-9 件分散", () => {
    const r = assignW6Ids(w6Bundle);
    const grammar = r.choiceProblems.filter((p) => p.id.startsWith("G3-"));
    const dist = [0, 0, 0, 0];
    for (const p of grammar) dist[p.correct_index]!++;
    expect(dist.reduce((a, b) => a + b, 0)).toBe(30);
    for (let i = 0; i < 4; i++) {
      expect(dist[i]).toBeGreaterThanOrEqual(7);
      expect(dist[i]).toBeLessThanOrEqual(9);
    }
  });

  it("listening 30 問の correct_index が 0..3 で 7-9 件分散", () => {
    const r = assignW6Ids(w6Bundle);
    const listening = r.choiceProblems.filter((p) => p.id.startsWith("L3-"));
    const dist = [0, 0, 0, 0];
    for (const p of listening) dist[p.correct_index]!++;
    expect(dist.reduce((a, b) => a + b, 0)).toBe(30);
    for (let i = 0; i < 4; i++) {
      expect(dist[i]).toBeGreaterThanOrEqual(7);
      expect(dist[i]).toBeLessThanOrEqual(9);
    }
  });
});

describe("loadAllSeedIds() / W6 統合 (DEC-094)", () => {
  it("total = 902 (W5 baseline 842 + W6 60)", async () => {
    const all = await loadAllSeedIds();
    expect(all.total).toBe(902);
  });

  it("choiceProblems 内訳 = 200 (W2) + 271 (W3) + 181 (W4) + 20 (W5) + 60 (W6) = 732", async () => {
    const all = await loadAllSeedIds();
    expect(all.choiceProblems.length).toBe(732);
    expect(all.writingProblems.length).toBe(100);
    expect(all.reorderProblems.length).toBe(30);
    expect(all.readingPassageProblems.length).toBe(40);
  });

  it("G3-001 〜 G3-030 が含まれる", async () => {
    const all = await loadAllSeedIds();
    const ids = new Set(all.choiceProblems.map((p) => p.id));
    for (let i = 1; i <= 30; i++) {
      expect(ids.has(`G3-${String(i).padStart(3, "0")}`)).toBe(true);
    }
  });

  it("L3-021 〜 L3-050 が含まれる (W5 L3-001..020 と連番接続)", async () => {
    const all = await loadAllSeedIds();
    const ids = new Set(all.choiceProblems.map((p) => p.id));
    // W5 (既存)
    expect(ids.has("L3-001")).toBe(true);
    expect(ids.has("L3-020")).toBe(true);
    // W6 (新規)
    for (let i = 21; i <= 50; i++) {
      expect(ids.has(`L3-${String(i).padStart(3, "0")}`)).toBe(true);
    }
    // 連番接続: L3-021 が存在するが L3-051 はまだ無い
    expect(ids.has("L3-051")).toBe(false);
  });

  it("ID 衝突なし (G3-XXX 新規 / L3-021..050 が W5 と非衝突)", async () => {
    const all = await loadAllSeedIds();
    const ids = all.choiceProblems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 既存 ID の保持を 6 サンプルで確認
    const idSet = new Set(ids);
    expect(idSet.has("L4-001")).toBe(true);
    expect(idSet.has("L4-100")).toBe(true);
    expect(idSet.has("L5-001")).toBe(true);
    expect(idSet.has("L5-100")).toBe(true);
    expect(idSet.has("V5-001")).toBe(true);
    expect(idSet.has("V5W4-100")).toBe(true);
    // G4-XXX (4 級 grammar) と G3-XXX (3 級 grammar) が独立
    expect(idSet.has("G4-001")).toBe(true);
    expect(idSet.has("G4-150")).toBe(true);
    expect(idSet.has("G3-001")).toBe(true);
    expect(idSet.has("G3-030")).toBe(true);
  });

  it("既存 842 件 (W2+W3+W4+W5) が破壊されない (W6 のみ除外)", async () => {
    const all = await loadAllSeedIds();
    // W6 = G3-XXX + L3-021..050 のみ除外
    const nonW6Choice = all.choiceProblems.filter((p) => {
      if (p.id.startsWith("G3-")) return false;
      if (p.id.startsWith("L3-")) {
        const num = Number(p.id.slice(3));
        if (num >= 21 && num <= 50) return false;
      }
      return true;
    });
    // W2+W3+W4+W5 choice = 200 + 271 + 181 + 20 = 672
    expect(nonW6Choice.length).toBe(672);
    expect(
      nonW6Choice.length +
        all.writingProblems.length +
        all.reorderProblems.length +
        all.readingPassageProblems.length,
    ).toBe(842);
  });
});

describe("W6 罰語ゼロ grep (DEC-024)", () => {
  // 罰則ゼロ哲学 (DEC-024): 子どもに罰を与える文言を禁止
  // self-reference (本テストの BAN_WORDS 配列定義) は除外して、
  // 実データ (prompt_text / audio_transcript / choices / explanation_jp)
  // だけを検査する
  const BAN_WORDS = ["失敗", "サボ", "ダメ", "悪い"] as const;

  it("prompt_text / audio_transcript / choices / explanation_jp に罰語が含まれない", () => {
    const r = assignW6Ids(w6Bundle);
    for (const p of r.choiceProblems) {
      const haystack = [
        p.prompt_text,
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
