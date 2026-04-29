/**
 * HANEI - Daily Quest Generator (W10-T3)
 *
 * 1 学習者 × 1 quest_date に対して 3 件のクエストを deterministic に生成する純関数。
 *
 * Deterministic 戦略:
 *   - PRNG: mulberry32 (32-bit seed-driven / 再現性あり / 軽量)
 *   - seed: hash("<learner_id>|<quest_date>") (非暗号 / 衝突耐性は不要)
 *   - 同じ (learner, date) なら何度呼んでも同じ 3 件 + 同じ target が出る
 *     → lazy generation の冪等性をアプリ層でも保証 (DB 制約で UNIQUE もある)
 *
 * 7 種から 3 種を非復元抽選 (mock_warmup は Phase 1 では候補から除外)。
 * 'streak_keep' を最低 1 件含める (毎日「1 問でも解けば達成」のセーフティネット)。
 *
 * 純関数 (DB I/O なし / Date を引数で受ける / "use server" なし)。
 */

import {
  QUEST_TEMPLATES,
  renderQuestTitle,
  selectableTypes,
  type QuestType,
} from "@/lib/quest/quest-templates";

// ---------------------------------------------------------------------------
// PRNG: mulberry32 (Bryc, public domain / 32-bit seed)
// ---------------------------------------------------------------------------

/**
 * 32-bit seeded PRNG. 戻り値は 0 <= x < 1。
 * 同 seed なら同じ列を返す決定論的乱数源。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 文字列を 32-bit unsigned int に hash する (cyrb53 派生 / 非暗号)。
 * 衝突耐性は不要 (PRNG seed としての再現性のみが目的)。
 */
export function hashStringToUint32(input: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // 32-bit に折り畳む
  return (h1 ^ h2) >>> 0;
}

/**
 * (learner_id, quest_date) から deterministic な 32-bit seed を作る。
 */
export function buildQuestSeed(learnerId: string, questDate: string): number {
  return hashStringToUint32(`${learnerId}|${questDate}`);
}

// ---------------------------------------------------------------------------
// 抽選ロジック
// ---------------------------------------------------------------------------

/**
 * 配列の Fisher-Yates shuffle (in-place / rng は [0, 1) を返す関数)。
 */
export function deterministicShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * targetCandidates から 1 つ deterministic に pick する。
 */
export function pickTarget(
  candidates: ReadonlyArray<number>,
  rng: () => number,
): number {
  if (candidates.length === 0) return 1;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? candidates[0]!;
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

export interface GeneratedQuest {
  questType: QuestType;
  title: string;
  target: number;
  rewardCoins: number;
}

export interface GenerateDailyQuestsInput {
  learnerId: string;
  /** 'YYYY-MM-DD' (JST) — getJstQuestDate(now) で得た値 */
  questDate: string;
  /** 1 日に出すクエスト数 (既定 3) */
  count?: number;
}

/**
 * 1 学習者 × 1 quest_date に対して `count` 件 (既定 3) のクエストを生成する。
 *
 * 不変条件:
 *   - 同 (learnerId, questDate) で何度呼んでも同じ結果 (deterministic)
 *   - 結果は count 件 (selectable プールが count 未満の場合のみ短くなる)
 *   - `streak_keep` を最低 1 件含む (selectable に含まれる限り)
 */
export function generateDailyQuests(
  input: GenerateDailyQuestsInput,
): ReadonlyArray<GeneratedQuest> {
  const { learnerId, questDate } = input;
  const count = Math.max(1, Math.floor(input.count ?? 3));

  if (!learnerId || typeof learnerId !== "string") return [];
  if (!questDate || typeof questDate !== "string") return [];

  const seed = buildQuestSeed(learnerId, questDate);
  const rng = mulberry32(seed);

  // selectable types (Phase 1 = 6 種 / mock_warmup は除外)
  const pool = selectableTypes().slice();

  // streak_keep を必ず含める: pool から 1 度引いて先頭に固定
  const result: QuestType[] = [];
  const streakIdx = pool.indexOf("streak_keep");
  if (streakIdx >= 0) {
    result.push("streak_keep");
    pool.splice(streakIdx, 1);
  }

  // 残り (count - result.length) 件を pool から非復元抽選
  const shuffled = deterministicShuffle(pool, rng);
  for (const t of shuffled) {
    if (result.length >= count) break;
    result.push(t);
  }

  // それぞれに deterministic な target を割り当て、title を render
  const generated: GeneratedQuest[] = result.map((qt) => {
    const tpl = QUEST_TEMPLATES[qt];
    const target = pickTarget(tpl.targetCandidates, rng);
    return {
      questType: qt,
      title: renderQuestTitle(qt, target),
      target,
      rewardCoins: tpl.rewardCoins,
    };
  });
  return generated;
}
