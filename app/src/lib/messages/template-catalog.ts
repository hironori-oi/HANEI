/**
 * HANEI - 親→子応援メッセージテンプレ カタログ (W9-T5)
 *
 * 30 種 = 5 カテゴリ × 6 種。
 *
 * placeholder:
 *   - {streak_days} : streaks.current_streak
 *   - {exam_days}   : 受験日カウントダウン (今日=0 / 過去=負数)
 *
 * ガイドライン (CEO 命):
 *   - 罰なき / プレッシャーなし / 励ましと祝福のみ
 *   - 絵文字禁止 (Heroicons + inline SVG のみ UI 側で利用)
 *   - 和の美意識 (花・桜・道などの比喩はテンプレに込める)
 */

export type MessageCategory =
  | "encourage_start"
  | "celebrate"
  | "encourage_struggle"
  | "check_in"
  | "exam_countdown";

export interface MessageTemplateDef {
  /** 'A1'..'E6' */
  code: string;
  category: MessageCategory;
  body: string;
  displayOrder: number;
}

/**
 * 30 種テンプレ定義。
 * UI / seed / fallback / テストで共通参照する単一ソース。
 */
export const MESSAGE_TEMPLATES: ReadonlyArray<MessageTemplateDef> = [
  // ---- A: 学習開始の応援 (encourage_start) ----
  { code: "A1", category: "encourage_start", displayOrder: 1, body: "きょうも がんばってね。ママ／パパは みているよ。" },
  { code: "A2", category: "encourage_start", displayOrder: 2, body: "むずかしいかもしれないけど、ゆっくりで いいからね。" },
  { code: "A3", category: "encourage_start", displayOrder: 3, body: "いっぽいっぽ、まえに すすもうね。" },
  { code: "A4", category: "encourage_start", displayOrder: 4, body: "きょうの じかんは いつから？ おうちでも おうえんしてるよ。" },
  { code: "A5", category: "encourage_start", displayOrder: 5, body: "むりは しないでね。たのしむのが いちばん。" },
  { code: "A6", category: "encourage_start", displayOrder: 6, body: "ことだまトリと いっしょに、がんばろう。" },

  // ---- B: 達成への祝福 (celebrate) ----
  { code: "B1", category: "celebrate", displayOrder: 1, body: "すごい！ きょうの ぶんを ちゃんと できたんだね！" },
  { code: "B2", category: "celebrate", displayOrder: 2, body: "がんばった ぶん、ちゃんと みのっているね。" },
  { code: "B3", category: "celebrate", displayOrder: 3, body: "ママ／パパも うれしいです。よく やったね。" },
  { code: "B4", category: "celebrate", displayOrder: 4, body: "さくらが さきましたね。みごとです。" },
  { code: "B5", category: "celebrate", displayOrder: 5, body: "きょうの きみは ヒーローだ。" },
  { code: "B6", category: "celebrate", displayOrder: 6, body: "{streak_days} 日 つづいた ことが、いちばん すごい。" },

  // ---- C: 困難への励まし (encourage_struggle) ----
  { code: "C1", category: "encourage_struggle", displayOrder: 1, body: "むずかしいときも あるよね。きゅうけいも たいせつ。" },
  { code: "C2", category: "encourage_struggle", displayOrder: 2, body: "きょう あきらめなかった こと、それだけで えらいです。" },
  { code: "C3", category: "encourage_struggle", displayOrder: 3, body: "まちがいは、つぎの せいかいの たね。" },
  { code: "C4", category: "encourage_struggle", displayOrder: 4, body: "みんな おなじ ところで つまずきます。きみだけじゃない。" },
  { code: "C5", category: "encourage_struggle", displayOrder: 5, body: "いっしょに かんがえよう、わからない ところは ぱぱ／ままに きいてね。" },
  { code: "C6", category: "encourage_struggle", displayOrder: 6, body: "きょうは ゆっくり やろう。あした また がんばろうね。" },

  // ---- D: 学習継続の確認 (check_in) ----
  { code: "D1", category: "check_in", displayOrder: 1, body: "きょうの ぶんは おわった？ がんばったね。" },
  { code: "D2", category: "check_in", displayOrder: 2, body: "きょうも しゅうちゅうして がんばっていたね。すごい。" },
  { code: "D3", category: "check_in", displayOrder: 3, body: "ねむい ときは むりせず、あした にしよう。" },
  { code: "D4", category: "check_in", displayOrder: 4, body: "ごはん おいしくたべて、また がんばろうね。" },
  { code: "D5", category: "check_in", displayOrder: 5, body: "きょうの しゅうかくは なんだった？ ぱぱ／ままに おしえて。" },
  { code: "D6", category: "check_in", displayOrder: 6, body: "もういちど やりたい もんだいは ある？" },

  // ---- E: 受験日カウントダウン (exam_countdown) ----
  { code: "E1", category: "exam_countdown", displayOrder: 1, body: "しけんまで あと {exam_days} 日。じぶんを しんじてね。" },
  { code: "E2", category: "exam_countdown", displayOrder: 2, body: "いままで がんばってきた ぶん、きみは つよい。" },
  { code: "E3", category: "exam_countdown", displayOrder: 3, body: "とくに しんぱいなのは どこ？ ぱぱ／ままが きくよ。" },
  { code: "E4", category: "exam_countdown", displayOrder: 4, body: "あさは しっかり ごはん、よるは はやく ねよう。" },
  { code: "E5", category: "exam_countdown", displayOrder: 5, body: "ためしうけ、じぶんに たくさん ほめて あげようね。" },
  { code: "E6", category: "exam_countdown", displayOrder: 6, body: "しけんは おわっても、きみの がんばりは つづくよ。" },
];

export const CATEGORY_ORDER: ReadonlyArray<MessageCategory> = [
  "encourage_start",
  "celebrate",
  "encourage_struggle",
  "check_in",
  "exam_countdown",
];

/**
 * 親側 UI tabs / 学習者側 UI バッジで使う日本語ラベル (子供向け / 漢字+ふりがな)。
 */
export const CATEGORY_LABEL_JA: Record<
  MessageCategory,
  { label: string; description: string }
> = {
  encourage_start: {
    label: "はじめの おうえん",
    description: "学習をはじめる前の優しい一言",
  },
  celebrate: {
    label: "おめでとう",
    description: "達成への祝福と承認",
  },
  encourage_struggle: {
    label: "そっと はげます",
    description: "むずかしい時の優しい励まし",
  },
  check_in: {
    label: "きょうも おつかれさま",
    description: "学習後の声かけ",
  },
  exam_countdown: {
    label: "しけんが ちかい とき",
    description: "受験日まで近いときの応援",
  },
};

/**
 * code → template の高速ルックアップ (O(1))。
 */
const _byCode = new Map(MESSAGE_TEMPLATES.map((t) => [t.code, t]));

export function findTemplateByCode(code: string): MessageTemplateDef | null {
  return _byCode.get(code) ?? null;
}

export function listTemplatesByCategory(
  category: MessageCategory,
): ReadonlyArray<MessageTemplateDef> {
  return MESSAGE_TEMPLATES.filter((t) => t.category === category);
}
