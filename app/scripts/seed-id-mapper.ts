/**
 * scripts/seed-id-mapper.ts (W4.5 / T-1)
 *
 * 用途:
 *   - W2 / W3 / W4 の seed-problems データ本体を改変せずに、各問題へ
 *     **自然 ID**（V5-001 / G5-001 / L5-001 / W3-001 / O5-001 / R4-001 /
 *     V5W4-001 / L4-021 / R3-011 等）を決定論的に付与するヘルパ。
 *   - seed-problems-runner.ts / generate-explanations-w3.ts / generate-tts-w3.ts
 *     から共通利用することで、ID 命名規則を一元化し DB と AI スクリプトの
 *     ID 整合を保証する。
 *
 * 採番ルール:
 *   - W2 vocab eiken-5:           V5-001  〜 V5-060   (60 問 / 出現順)
 *   - W2 grammar eiken-5:         G5-001  〜 G5-030   (30 問)
 *   - W2 vocab eiken-4:           V4-001  〜 V4-050   (50 問)
 *   - W2 listening-response eiken-4: L4-001 〜 L4-020 (20 問)
 *   - W2 vocab eiken-3:           V3-001  〜 V3-030   (30 問 / 旧 V3-012 含む)
 *   - W2 reading eiken-3:         R3-001  〜 R3-010   (10 問)
 *
 *   - W3 listening eiken-5:       L5-001  〜 L5-100   (100 問)
 *   - W3 grammar eiken-4:         G4-001  〜 G4-150   (150 問 / 旧 G4-080 含む)
 *   - W3 writing eiken-3:         W3-001  〜 W3-100   (100 問 / writing は 4 択ではない)
 *   - W3 reorder eiken-5:         O5-001  〜 O5-030   (30 問 / reorder は 4 択ではない)
 *   - W3 reading eiken-4:         R4-001  〜 R4-020   (20 問)
 *   - W3 replacements:            V3-012R             (1 問 = W2 V3-012 改稿版)
 *
 *   - W4 vocab eiken-5:           V5W4-001 〜 V5W4-100 (100 問 / W2 V5 と命名空間分離)
 *   - W4 listening eiken-4:       L4-021  〜 L4-100   (80 問 / W2 L4-001..020 と衝突回避)
 *   - W4 reading eiken-3:         R3-011  〜 R3-050   (40 問 / W2 R3-001..010 と衝突回避)
 *   - W4 replacements:            G4-080R             (1 問 = W3 G4-080 改稿版)
 *
 *   - W5 listening eiken-3:       L3-001  〜 L3-020   (20 問 / β 開始用 / DEC-079)
 *
 * 累計: 200 (W2) + 401 (W3) + 221 (W4) + 20 (W5) = 842 問
 *
 * 重要:
 *   - 既存 seed-problems-w2/w3/w4.ts のデータ本体（問題文 / 選択肢 / 正解 / 解説）
 *     を一切改変せず、本モジュールが採番のみを担当する（変更最小化）。
 *   - 採番はソース配列の出現順 (index ベース) に依存する。
 *     順序が変わると ID が変わるので、既存配列の並べ替え禁止。
 */

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

/**
 * 自然 ID 採番後の問題（4 択 / mcq・listening_mcq・reading_passage_mcq・reorder 等）
 *
 * generate-explanations-w3.ts / generate-tts-w3.ts はこの形式の {id, prompt,
 * choices, correctAnswer} のみを参照する。
 */
export interface SeedChoice {
  id: string;
  level: "eiken-5" | "eiken-4" | "eiken-3";
  /** 元データの skill 文字列。schema 側マッピングは seed-problems-runner で行う */
  skill: string;
  /** 問題文（fill-in 等は (   ) を含む） */
  prompt_text: string;
  /** 読解 / リスニングの passage 本文 (なければ undefined) */
  passage_text?: string;
  /** 4 択（length=4） */
  choices: string[];
  /** 0..3 の正解 index */
  correct_index: number;
  /** 子ども向け日本語解説 */
  explanation_jp: string;
  /** 0/1/2 */
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  /** リスニング音声の読み上げ原稿（W3 audio_transcript / W4 audioScript の統一表現） */
  audio_transcript?: string;
  copyright_safe: true;
  generated_quality_score: number;
}

/**
 * Reading passage 型（W4 reading 専用 / 1 passage に複数 question を持つ）
 *
 * DB にはこの構造を 1 行 = 1 problem として保存するか、
 * questionJson に passage + questions 配列を埋め込む形で保存する。
 * 本モジュールでは passage 単位の id 採番のみ行い、DB 保存形式は runner 側で決定。
 */
export interface SeedReadingPassage {
  id: string;
  level: "eiken-3";
  skill: "reading";
  passage: string;
  word_count: number;
  genre: string;
  questions: ReadonlyArray<{
    question: string;
    choices: string[];
    correct_index: number;
    explanation_jp: string;
  }>;
  difficulty: 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  copyright_safe: true;
  generated_quality_score: number;
}

/**
 * Writing 型（W3 writing 専用 / 4 択ではない）
 */
export interface SeedWriting {
  id: string;
  level: "eiken-3";
  skill: "writing";
  prompt: string;
  model_answer: string;
  word_count_min: 25;
  word_count_max: 35;
  estimated_time_sec: number;
  tags: string[];
  difficulty: 2;
  copyright_safe: true;
  generated_quality_score: number;
}

/**
 * Reorder 型（W3 reorder / 並べ替え / 4 択ではない）
 */
export interface SeedReorder {
  id: string;
  level: "eiken-5";
  skill: "reorder";
  prompt_text: string;
  choices: string[];
  correct_order: number[];
  correct_sentence: string;
  explanation_jp: string;
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  copyright_safe: true;
  generated_quality_score: number;
}

export type AnySeed = SeedChoice | SeedReadingPassage | SeedWriting | SeedReorder;

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

/**
 * 連番 ID を生成: prefix + zero-padded(index, width)
 *  例: pad("V5", 1, 3) → "V5-001"
 */
function pad(prefix: string, n: number, width: number): string {
  return `${prefix}-${String(n).padStart(width, "0")}`;
}

/**
 * W2 / W3 / W4 共通の choice → SeedChoice 正規化。
 *
 * - W3 は audio_transcript、W4 は audioScript を使うため両方拾う。
 * - skill 文字列は元データのままパススルー（DB 用変換は runner で行う）。
 */
function toSeedChoice(
  raw: {
    level: string;
    skill: string;
    prompt_text: string;
    passage_text?: string;
    choices: string[];
    correct_index: number;
    explanation_jp: string;
    difficulty: number;
    estimated_time_sec: number;
    tags: string[];
    audio_transcript?: string;
    audioScript?: string;
    copyright_safe?: boolean;
    generated_quality_score: number;
  },
  id: string,
): SeedChoice {
  const out: SeedChoice = {
    id,
    level: raw.level as SeedChoice["level"],
    skill: raw.skill,
    prompt_text: raw.prompt_text,
    choices: raw.choices,
    correct_index: raw.correct_index,
    explanation_jp: raw.explanation_jp,
    difficulty: raw.difficulty as 0 | 1 | 2,
    estimated_time_sec: raw.estimated_time_sec,
    tags: raw.tags,
    copyright_safe: true,
    generated_quality_score: raw.generated_quality_score,
  };
  if (raw.passage_text !== undefined) out.passage_text = raw.passage_text;
  const audio = raw.audio_transcript ?? raw.audioScript;
  if (audio !== undefined) out.audio_transcript = audio;
  return out;
}

// ---------------------------------------------------------------------------
// W2 採番
// ---------------------------------------------------------------------------

/**
 * W2 (default 配列 / redistributeCorrectIndex 適用済 200 問) を読み込み、
 * 出現順に section ごとの自然 ID を付与した SeedChoice[] を返す。
 *
 * W2 はすべて 4 択型 (ChoiceProblem) なので 200 問 → 200 件出力。
 */
export function assignW2Ids(
  w2: ReadonlyArray<{
    level: string;
    skill: string;
    prompt_text: string;
    passage_text?: string;
    choices: string[];
    correct_index: number;
    explanation_jp: string;
    difficulty: number;
    estimated_time_sec: number;
    tags: string[];
    audio_transcript?: string;
    copyright_safe?: boolean;
    generated_quality_score: number;
  }>,
): SeedChoice[] {
  // section counters
  const counters: Record<string, number> = {
    "eiken-5/vocab": 0,
    "eiken-5/grammar": 0,
    "eiken-4/vocab": 0,
    "eiken-4/listening-response": 0,
    "eiken-3/vocab": 0,
    "eiken-3/reading": 0,
  };

  const result: SeedChoice[] = [];
  for (const p of w2) {
    const key = `${p.level}/${p.skill}`;
    const next = (counters[key] ?? 0) + 1;
    counters[key] = next;

    let id: string;
    switch (key) {
      case "eiken-5/vocab":
        id = pad("V5", next, 3);
        break;
      case "eiken-5/grammar":
        id = pad("G5", next, 3);
        break;
      case "eiken-4/vocab":
        id = pad("V4", next, 3);
        break;
      case "eiken-4/listening-response":
        id = pad("L4", next, 3);
        break;
      case "eiken-3/vocab":
        id = pad("V3", next, 3);
        break;
      case "eiken-3/reading":
        id = pad("R3", next, 3);
        break;
      default:
        throw new Error(
          `[seed-id-mapper] W2: 未知の section "${key}" (item index=${result.length})`,
        );
    }
    result.push(toSeedChoice(p, id));
  }
  return result;
}

// ---------------------------------------------------------------------------
// W3 採番
// ---------------------------------------------------------------------------

interface W3BundleShape {
  listening: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
  grammar: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
  writing: ReadonlyArray<{
    level: string;
    skill: "writing";
    prompt: string;
    model_answer: string;
    word_count_min: 25;
    word_count_max: 35;
    estimated_time_sec: number;
    tags: string[];
    difficulty: 2;
    copyright_safe?: boolean;
    generated_quality_score: number;
  }>;
  reorder: ReadonlyArray<{
    level: string;
    skill: "reorder";
    prompt_text: string;
    choices: string[];
    correct_order: number[];
    correct_sentence: string;
    explanation_jp: string;
    difficulty: number;
    estimated_time_sec: number;
    tags: string[];
    copyright_safe?: boolean;
    generated_quality_score: number;
  }>;
  reading: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
  replacements: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
}

export interface W3IdResult {
  /** 4 択 (mcq / listening / reading / replacement) のみ */
  choiceProblems: SeedChoice[];
  /** writing 100 問 (4 択ではないため別配列) */
  writingProblems: SeedWriting[];
  /** reorder 30 問 (4 択ではないため別配列) */
  reorderProblems: SeedReorder[];
}

export function assignW3Ids(w3: W3BundleShape): W3IdResult {
  const choiceProblems: SeedChoice[] = [];

  // 5 級 listening 100 問: L5-001 〜 L5-100
  w3.listening.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("L5", i + 1, 3)));
  });

  // 4 級 grammar 150 問: G4-001 〜 G4-150
  w3.grammar.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("G4", i + 1, 3)));
  });

  // 4 級 reading 20 問: R4-001 〜 R4-020
  w3.reading.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("R4", i + 1, 3)));
  });

  // replacements: tags から V3-012R 等を抽出。fallback として連番。
  w3.replacements.forEach((p, i) => {
    const tagId = extractReplacementId(p.tags);
    const id = tagId ?? pad("REPL3", i + 1, 3);
    choiceProblems.push(toSeedChoice(p, id));
  });

  // writing 100 問: W3-001 〜 W3-100
  const writingProblems: SeedWriting[] = w3.writing.map((p, i) => ({
    id: pad("W3", i + 1, 3),
    level: "eiken-3",
    skill: "writing",
    prompt: p.prompt,
    model_answer: p.model_answer,
    word_count_min: p.word_count_min,
    word_count_max: p.word_count_max,
    estimated_time_sec: p.estimated_time_sec,
    tags: p.tags,
    difficulty: 2,
    copyright_safe: true,
    generated_quality_score: p.generated_quality_score,
  }));

  // reorder 30 問: O5-001 〜 O5-030
  const reorderProblems: SeedReorder[] = w3.reorder.map((p, i) => ({
    id: pad("O5", i + 1, 3),
    level: "eiken-5",
    skill: "reorder",
    prompt_text: p.prompt_text,
    choices: p.choices,
    correct_order: p.correct_order,
    correct_sentence: p.correct_sentence,
    explanation_jp: p.explanation_jp,
    difficulty: p.difficulty as 0 | 1 | 2,
    estimated_time_sec: p.estimated_time_sec,
    tags: p.tags,
    copyright_safe: true,
    generated_quality_score: p.generated_quality_score,
  }));

  return { choiceProblems, writingProblems, reorderProblems };
}

/** tags 配列から `V3-012R` のような自然 ID を抽出 (一致しなければ null) */
function extractReplacementId(tags: ReadonlyArray<string>): string | null {
  for (const t of tags) {
    if (/^[A-Z]{1,3}\d{1,3}-\d{2,4}R?$/.test(t)) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// W4 採番
// ---------------------------------------------------------------------------

interface W4BundleShape {
  vocab: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
  listening: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
  reading: ReadonlyArray<{
    level: "eiken-3";
    skill: "reading";
    passage: string;
    word_count: number;
    genre: string;
    questions: ReadonlyArray<{
      question: string;
      choices: string[];
      correct_index: number;
      explanation_jp: string;
    }>;
    difficulty: 1 | 2;
    estimated_time_sec: number;
    tags: string[];
    copyright_safe?: boolean;
    generated_quality_score: number;
  }>;
  replacements: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
}

export interface W4IdResult {
  /** 4 択 (mcq / listening / replacement) のみ */
  choiceProblems: SeedChoice[];
  /** reading passage 40 問 (W2 R3-001..010 との衝突を避け R3-011..050 に shift) */
  readingPassageProblems: SeedReadingPassage[];
}

export function assignW4Ids(w4: W4BundleShape): W4IdResult {
  const choiceProblems: SeedChoice[] = [];

  // 5 級 vocab 100 問: V5W4-001 〜 V5W4-100 (W2 V5-001..060 と命名空間分離)
  w4.vocab.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("V5W4", i + 1, 3)));
  });

  // 4 級 listening 80 問: L4-021 〜 L4-100 (W2 L4-001..020 と衝突回避のため shift)
  w4.listening.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("L4", i + 21, 3)));
  });

  // replacements: tags から G4-080R を抽出
  w4.replacements.forEach((p, i) => {
    const tagId = extractReplacementId(p.tags);
    const id = tagId ?? pad("REPL4", i + 1, 3);
    choiceProblems.push(toSeedChoice(p, id));
  });

  // reading passage 40 問: R3-011 〜 R3-050 (W2 R3-001..010 と衝突回避のため shift)
  const readingPassageProblems: SeedReadingPassage[] = w4.reading.map(
    (p, i) => ({
      id: pad("R3", i + 11, 3),
      level: "eiken-3",
      skill: "reading",
      passage: p.passage,
      word_count: p.word_count,
      genre: p.genre,
      questions: p.questions,
      difficulty: p.difficulty,
      estimated_time_sec: p.estimated_time_sec,
      tags: p.tags,
      copyright_safe: true,
      generated_quality_score: p.generated_quality_score,
    }),
  );

  return { choiceProblems, readingPassageProblems };
}

// ---------------------------------------------------------------------------
// W5 採番 (β 開始用 3 級 listening 20 問 / DEC-079)
// ---------------------------------------------------------------------------

interface W5BundleShape {
  listening: ReadonlyArray<Parameters<typeof toSeedChoice>[0]>;
}

export interface W5IdResult {
  /** 3 級 listening 20 問 (L3-001 〜 L3-020) */
  choiceProblems: SeedChoice[];
}

export function assignW5Ids(w5: W5BundleShape): W5IdResult {
  const choiceProblems: SeedChoice[] = [];

  // 3 級 listening 20 問: L3-001 〜 L3-020
  w5.listening.forEach((p, i) => {
    choiceProblems.push(toSeedChoice(p, pad("L3", i + 1, 3)));
  });

  return { choiceProblems };
}

// ---------------------------------------------------------------------------
// 統合: 全 842 問の自然 ID 採番
// ---------------------------------------------------------------------------

export interface AllSeedIds {
  /**
   * 4 択型:
   *   200 (W2)
   *   + 271 (W3 listening+grammar+reading+repl)
   *   + 181 (W4 vocab+listening+repl)
   *   +  20 (W5 listening eiken-3)
   *   = 672
   */
  choiceProblems: SeedChoice[];
  /** writing: 100 (W3) */
  writingProblems: SeedWriting[];
  /** reorder: 30 (W3) */
  reorderProblems: SeedReorder[];
  /** reading passage: 40 (W4 / 1 passage = 1 problem) */
  readingPassageProblems: SeedReadingPassage[];
  /** 合計件数 = 200 + 401 + 221 + 20 = 842 */
  total: number;
}

export async function loadAllSeedIds(): Promise<AllSeedIds> {
  // ---- W2 ----
  const w2Module = (await import("./seed-problems-w2")) as {
    default: Parameters<typeof assignW2Ids>[0];
  };
  const w2 = assignW2Ids(w2Module.default);

  // ---- W3 ----
  const w3Module = (await import("./seed-problems-w3")) as {
    default: W3BundleShape;
  };
  const w3 = assignW3Ids(w3Module.default);

  // ---- W4 ----
  const w4Module = (await import("./seed-problems-w4")) as {
    default: W4BundleShape;
  };
  const w4 = assignW4Ids(w4Module.default);

  // ---- W5 (β 開始用 3 級 listening 20 問 / DEC-079) ----
  const w5Module = (await import("./seed-problems-w5")) as {
    default: W5BundleShape;
  };
  const w5 = assignW5Ids(w5Module.default);

  const choiceProblems = [
    ...w2,
    ...w3.choiceProblems,
    ...w4.choiceProblems,
    ...w5.choiceProblems,
  ];

  // 重複検知（早期失敗）
  const seen = new Set<string>();
  for (const p of choiceProblems) {
    if (seen.has(p.id)) {
      throw new Error(
        `[seed-id-mapper] duplicate ChoiceProblem id detected: ${p.id}`,
      );
    }
    seen.add(p.id);
  }
  for (const p of w3.writingProblems) {
    if (seen.has(p.id)) {
      throw new Error(
        `[seed-id-mapper] duplicate Writing id detected: ${p.id}`,
      );
    }
    seen.add(p.id);
  }
  for (const p of w3.reorderProblems) {
    if (seen.has(p.id)) {
      throw new Error(
        `[seed-id-mapper] duplicate Reorder id detected: ${p.id}`,
      );
    }
    seen.add(p.id);
  }
  for (const p of w4.readingPassageProblems) {
    if (seen.has(p.id)) {
      throw new Error(
        `[seed-id-mapper] duplicate ReadingPassage id detected: ${p.id}`,
      );
    }
    seen.add(p.id);
  }

  const total =
    choiceProblems.length +
    w3.writingProblems.length +
    w3.reorderProblems.length +
    w4.readingPassageProblems.length;

  return {
    choiceProblems,
    writingProblems: w3.writingProblems,
    reorderProblems: w3.reorderProblems,
    readingPassageProblems: w4.readingPassageProblems,
    total,
  };
}
