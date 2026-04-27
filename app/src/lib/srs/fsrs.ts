/**
 * HANEI - FSRS (Free Spaced Repetition Scheduler) ヘルパ
 *
 * ts-fsrs パッケージで FSRS-4-Parameter スケジューリングを管理。
 *  - state: 0=New, 1=Learning, 2=Review, 3=Relearning
 *  - rating: 1=Again, 2=Hard, 3=Good, 4=Easy
 *
 * SRS の哲学:
 *   正答 (rating=Good or Easy) → due_at を未来へ伸ばす (stability 増)
 *   誤答 (rating=Again) → 短時間で再出題 (stability 減 / state=Relearning)
 *
 * Phase 1 では「正解=Good (3) / 不正解=Again (1)」の 2 値マッピングで運用。
 * Phase 2 で時間ベース難易度判定 (Hard / Easy) を導入予定。
 */

import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type RecordLog,
} from "ts-fsrs";

const params = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true,
  request_retention: 0.9,
});

const scheduler = fsrs(params);

export interface SrsCardInput {
  stability: number;
  difficulty: number;
  due: Date;
  state: number; // 0..3
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

export interface SrsCardOutput {
  stability: number;
  difficulty: number;
  due: Date;
  state: number;
  reps: number;
  lapses: number;
  lastReview: Date;
  fsrsState: SrsCardInput; // raw card serialized
}

function toCard(input: SrsCardInput): Card {
  return {
    due: input.due,
    stability: input.stability,
    difficulty: input.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: input.reps,
    lapses: input.lapses,
    state: input.state as State,
    last_review: input.lastReview ?? undefined,
  };
}

/**
 * 新規カード初期値 (state=New, due=今すぐ)
 */
export function initialCard(now: Date = new Date()): SrsCardInput {
  return {
    stability: 0,
    difficulty: 5,
    due: now,
    state: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

/**
 * 解答結果に応じてカードを進める。
 * @param card 既存 SRS 状態 (新規なら initialCard())
 * @param correct 正答可否
 * @param now 現在時刻 (テスト容易性のため引数化)
 */
export function reviewCard(
  card: SrsCardInput,
  correct: boolean,
  now: Date = new Date(),
): SrsCardOutput {
  const fsrsCard = toCard(card);
  const rating: Rating = correct ? Rating.Good : Rating.Again;
  const result: RecordLog = scheduler.repeat(fsrsCard, now);
  const next = result[rating];
  if (!next) {
    throw new Error("[srs/fsrs] reviewCard: missing rating result");
  }

  const out: SrsCardInput = {
    stability: next.card.stability,
    difficulty: next.card.difficulty,
    due: next.card.due,
    state: next.card.state,
    reps: next.card.reps,
    lapses: next.card.lapses,
    lastReview: next.card.last_review ?? now,
  };

  return {
    ...out,
    lastReview: out.lastReview ?? now,
    fsrsState: out,
  };
}
