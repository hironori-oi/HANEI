/**
 * HANEI - Skill ID Mapper (shared / W6 B-6)
 *
 * 用途:
 *   - production seed (`scripts/seed-problems-runner.ts`) と E2E fixture
 *     (`tests/e2e/fixtures/db-fixture.ts`) の両方から共有される、
 *     seed skill 文字列 / DB レベル → DB `skills.id` 変換ロジック。
 *
 * 背景 (DEC-038 follow-up #2):
 *   - W5 で発覚した silent breakage の根本原因は、production canonical の
 *     skill_id schema (`<base>-<level>` 形式 / 例: "vocabulary-5") を
 *     E2E fixture 側が把握していなかったことにある。
 *   - 本モジュールを single source of truth とし、両者から import することで
 *     fixture と production の skill_id 形式を構造的に同期する。
 *
 * 注意:
 *   - 本モジュールは pure function のみ。DB / fs への副作用なし。
 *   - 副作用がある module (`scripts/seed-problems-runner.ts`) は
 *     `db` import で副作用が発生するため、E2E から import することは禁忌。
 *     必ず本モジュール経由で参照する。
 */

export type EikenLevelId = "5" | "4" | "3";

export type SkillCode =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "reading"
  | "writing";

/**
 * seed skill 文字列 (seed-problems-w2/w3/w4 の `skill` フィールド)
 * → DB skills.id の base code に正規化する。
 *
 * - "vocab"                          → "vocabulary"
 * - "grammar"                        → "grammar"
 * - "listening" / "listening-response" → "listening"
 * - "reading" / "reorder"            → "reading"
 *   (reorder は reading 系として扱う / skills マスタに reorder 行が無いため)
 * - "writing"                        → "writing"
 */
export function mapSkillCode(seedSkill: string): SkillCode {
  switch (seedSkill) {
    case "vocab":
      return "vocabulary";
    case "grammar":
      return "grammar";
    case "listening":
    case "listening-response":
      return "listening";
    case "reading":
    case "reorder":
      return "reading";
    case "writing":
      return "writing";
    default:
      throw new Error(`[skill-id-mapper] unknown seed skill: ${seedSkill}`);
  }
}

/**
 * DB レベル + seed skill から、production canonical の skill_id を組み立てる。
 *
 * 形式: `<code>-<level>` (例: "vocabulary-5")
 *
 * 引数順序:
 *   - level (DB form: "5" / "4" / "3") を第 1 引数に置く
 *   - seedSkill (seed form: "vocab" / "reading" / ...) を第 2 引数に置く
 *
 * これは「production seed の `mapSkillId(level, skill)` が canonical」という
 * DEC-038 補遺 #2 の表記に揃えた order である。
 */
export function mapSkillId(level: EikenLevelId, seedSkill: string): string {
  const code = mapSkillCode(seedSkill);
  return `${code}-${level}`;
}
