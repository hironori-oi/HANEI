/**
 * Learner Switch Resolver (W4 / T-3)
 *
 * URL クエリ `?learner=<id>` から学習者を選択するロジックを切り出す。
 * SSR / クライアント / unit テストで共通利用できる純関数。
 *
 * 仕様:
 *  - learners 配列の最初を default 学習者とする
 *  - ?learner= が learners に含まれていればそれを採用
 *  - ?learner= が learners に含まれていなければ default にフォールバック (学習者切替の
 *    URL 改ざんによる権限漏れを防ぐ第一防御層 / 実認可は SSR の requireLearnerOwner で再実施)
 */

export interface LearnerLite {
  id: string;
  nickname: string;
}

export interface ResolveLearnerInput {
  learners: ReadonlyArray<LearnerLite>;
  /** searchParams から取得した値 (string or string[] or undefined) */
  rawQuery?: string | string[] | undefined;
}

export interface ResolveLearnerResult {
  active: LearnerLite | null;
  /** URL の値が learners に含まれていなかった (改ざんっぽい) ケースは true */
  fellBack: boolean;
}

export function resolveActiveLearner(input: ResolveLearnerInput): ResolveLearnerResult {
  const list = input.learners;
  if (list.length === 0) {
    return { active: null, fellBack: false };
  }
  const fallback = list[0] ?? null;
  if (!fallback) {
    return { active: null, fellBack: false };
  }
  const raw = input.rawQuery;
  const queried = Array.isArray(raw) ? raw[0] : raw;
  if (!queried) {
    return { active: fallback, fellBack: false };
  }
  const matched = list.find((l) => l.id === queried);
  if (!matched) {
    return { active: fallback, fellBack: true };
  }
  return { active: matched, fellBack: false };
}
