/**
 * PRJ-016 HANEI - W6 シード問題プール (β 阻害解消最終ピース / 3 級 grammar 30 + listening 30 = 60 問)
 *
 * 作成日: 2026-05-06
 * 作成部署: Dev (W12 / DEC-094)
 * 範囲: 英検 3 級 grammar / listening の追加投入
 *   - 3 級 grammar:   30 問 (G3-001 〜 G3-030)
 *   - 3 級 listening: 30 問 (L3-021 〜 L3-050) — W5 (L3-001..020) と連番接続
 *
 * 背景 (DEC-094):
 *   - β 試用フィードバック「読解やリスニングが選択できない」を CEO 調査した結果、
 *     production Turso DB の (level=3 / skill=grammar-3) と (level=3 / skill=listening-3)
 *     に問題 0 件が確定. DEC-093 で UI 救済 (preparing) は済んでいるが、実問題が無いと
 *     β 試用継続不可 → 本 W6 で 60 問を seed 投入し β 阻害最終解消する.
 *
 * 設計方針 (DEC-094):
 *   - W3 grammar-4 (G4-001..150) と W5 listening-3 (L3-001..020) を完全に precedent コピー
 *   - 新規アーキテクチャは導入しない / 採番のみ mapper 経由で W5 と同型
 *   - 構造は seed-problems-w3.ts (grammar) / seed-problems-w5.ts (listening) と完全同型
 *   - 範囲 (英検 3 級 / 中学卒業相当):
 *     現在完了 (have/has + p.p.) / 受動態 (be + p.p.) / 関係詞 (who/which/that) /
 *     比較級・最上級 / 動名詞 vs 不定詞 / 過去進行形 / 助動詞 (must/should/may/could) /
 *     仮定法 it / 間接疑問 / there is/are 構文 / 付加疑問 / it is ... to do /
 *     want O to do / make O C
 *   - 4 択 / `correct_index` を 30 問で 0..3 に均等分散 (各 7-8 回)
 *   - difficulty: 0 5 / 1 18 / 2 7 程度
 *
 * 制約 (DEC-024 罰則ゼロ哲学):
 *   - 100% オリジナル AI 生成
 *   - 絵文字なし
 *   - 罰語ゼロ:「失敗」「サボ」「ダメ」「悪い」を prompt_text / choices / explanation_jp /
 *     audio_transcript 全件で使わない (unit test で grep 検証)
 *   - 子ども不適切表現なし (暴力 / 性 / 政治宗教 / 個人情報 / 賭博 / 恐怖煽り 0 件)
 *   - 固有名詞は架空: Sakura Elementary / Hanei Town / Lily, Tom, Ben, Mary, Mike,
 *     Anna, Ken, Yuki, Sara, Coco (犬), Mimi (猫)
 *
 * 採番 (DEC-094):
 *   - seed-id-mapper.ts の `assignW6Ids()` で
 *     grammar 30 問: G3-001 〜 G3-030 (出現順)
 *     listening 30 問: L3-021 〜 L3-050 (W5 L3-001..020 と連番接続)
 *   - 本ファイルでは ID は明示的に持たない (W3/W5 と同型 / 採番は mapper 経由)
 */

// ---------------------------------------------------------------------------
// 型定義 (W3 ChoiceProblem / W5 Eiken3Listening と同型)
// ---------------------------------------------------------------------------

type Eiken3Grammar = {
  level: "eiken-3";
  skill: "grammar";
  prompt_text: string;
  choices: string[];
  correct_index: number;
  explanation_jp: string;
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  generated_quality_score: number;
};

type Eiken3Listening = {
  level: "eiken-3";
  skill: "listening";
  prompt_text: string;
  audio_transcript: string;
  choices: string[];
  correct_index: number;
  explanation_jp: string;
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  generated_quality_score: number;
};

// ---------------------------------------------------------------------------
// 3 級 grammar 30 問 (G3-001 〜 G3-030)
// 範囲分散:
//   現在完了 5 / 受動態 4 / 関係詞 4 / 比較 3 / 動名詞 vs 不定詞 3 /
//   過去進行形 2 / 助動詞 3 / 間接疑問 1 / there is 1 / 付加疑問 1 /
//   it is ... to do 1 / want O to do 1 / make O C 1
//
// correct_index 分散 (30 問):
//   0: 8 / 1: 7 / 2: 8 / 3: 7
//
// difficulty 分散: 0 5 問 / 1 18 問 / 2 7 問
// ---------------------------------------------------------------------------

const grammarProblems: Eiken3Grammar[] = [
  // G3-001 / 現在完了 (経験) / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Lily (   ) been to Hanei Town three times.",
    choices: ["has", "have", "is", "was"],
    correct_index: 0,
    explanation_jp:
      "「〜したことがある」と経験を表すのは現在完了です。Lily は三人称単数なので has を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "present-perfect", "experience"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-002 / 現在完了 (継続) / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Tom has lived in Sakura Town (   ) ten years.",
    choices: ["since", "from", "for", "in"],
    correct_index: 2,
    explanation_jp:
      "「ten years」のように期間を表す語の前は for を使います。since は時点 (since 2020) と一緒に使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "present-perfect", "for-since"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-003 / 現在完了 (完了 just) / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Mary (   ) just finished her homework.",
    choices: ["have", "has", "is", "did"],
    correct_index: 1,
    explanation_jp:
      "「ちょうど〜したところ」は has/have + just + 過去分詞。Mary は単数なので has です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "present-perfect", "completion"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-004 / 現在完了 (経験 never) / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "I have (   ) seen such a beautiful sunset.",
    choices: ["ever", "yet", "never", "still"],
    correct_index: 2,
    explanation_jp:
      "「〜したことがない」は have never + 過去分詞で表します。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["tense", "present-perfect", "never"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // G3-005 / 現在完了 (yet 否定) / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Ben has not (   ) lunch yet.",
    choices: ["eat", "eats", "ate", "eaten"],
    correct_index: 3,
    explanation_jp:
      "現在完了は has/have + 過去分詞。eat の過去分詞は eaten です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "present-perfect", "yet"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-006 / 受動態 (現在) / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "These cookies (   ) made by my grandmother.",
    choices: ["are", "is", "was", "be"],
    correct_index: 0,
    explanation_jp:
      "「〜される」は be 動詞 + 過去分詞。These cookies は複数なので are を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["passive", "present", "plural"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-007 / 受動態 (過去) / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "This book was (   ) by Anna last month.",
    choices: ["wrote", "written", "writing", "writes"],
    correct_index: 1,
    explanation_jp:
      "受動態は be + 過去分詞。write の過去分詞は written です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["passive", "past", "written"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-008 / 受動態 (by) / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "The window was broken (   ) the strong wind.",
    choices: ["of", "in", "by", "for"],
    correct_index: 2,
    explanation_jp:
      "受動態で動作の主体を表すときは by を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["passive", "by"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-009 / 受動態 (現在 / 単数) / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Japanese (   ) spoken in many countries.",
    choices: ["are", "be", "do", "is"],
    correct_index: 3,
    explanation_jp:
      "Japanese は単数扱いなので be 動詞は is。受動態 is + 過去分詞 (spoken)。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["passive", "present", "singular"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // G3-010 / 関係詞 who / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "I have a friend (   ) plays soccer very well.",
    choices: ["who", "which", "what", "where"],
    correct_index: 0,
    explanation_jp:
      "先行詞が「人」で関係詞節で主語になるときは who を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["relative", "who", "subject"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-011 / 関係詞 which / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "This is the picture (   ) Mike took yesterday.",
    choices: ["who", "which", "what", "when"],
    correct_index: 1,
    explanation_jp:
      "先行詞が「もの」で目的語になるときは which を使います。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["relative", "which", "object"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // G3-012 / 関係詞 that / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Look at the cat and the dog (   ) are running together.",
    choices: ["who", "which", "that", "where"],
    correct_index: 2,
    explanation_jp:
      "先行詞が「人 + 動物 / もの」のときは that を使うのが自然です。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["relative", "that"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // G3-013 / 関係詞 who 目的格 (who/whom) / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Sara is the girl (   ) I met at the park.",
    choices: ["which", "what", "where", "who"],
    correct_index: 3,
    explanation_jp:
      "先行詞が「人」で目的語になるときは who (口語では who も使えます) です。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["relative", "who", "object"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.86,
  },
  // G3-014 / 比較級 (-er than) / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Today is (   ) than yesterday.",
    choices: ["warmer", "warm", "warmest", "more warm"],
    correct_index: 0,
    explanation_jp:
      "短い形容詞は -er + than で比較級。warm + er = warmer です。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["comparison", "comparative", "-er"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // G3-015 / 比較 (more / most) / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "This is the (   ) interesting book in the library.",
    choices: ["more", "most", "much", "very"],
    correct_index: 1,
    explanation_jp:
      "interesting は長い形容詞なので最上級は the most + 形容詞です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["comparison", "superlative", "most"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-016 / 比較級 better / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Yuki sings (   ) than her sister.",
    choices: ["good", "well", "better", "best"],
    correct_index: 2,
    explanation_jp:
      "well の比較級は不規則で better です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["comparison", "comparative", "better"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-017 / 動名詞 / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Ken enjoys (   ) the piano on weekends.",
    choices: ["play", "plays", "to play", "playing"],
    correct_index: 3,
    explanation_jp:
      "enjoy のあとは ing 形 (動名詞) を使います。enjoy to do は不可。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["gerund", "enjoy"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-018 / 不定詞 / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Mary wants (   ) a doctor in the future.",
    choices: ["to be", "be", "being", "is"],
    correct_index: 0,
    explanation_jp:
      "want のあとは to + 動詞の原形 (不定詞) を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["infinitive", "want-to"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // G3-019 / 動名詞 (前置詞 + ing) / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Tom is good at (   ) basketball.",
    choices: ["play", "playing", "to play", "plays"],
    correct_index: 1,
    explanation_jp:
      "前置詞 (at) のあとは ing 形 (動名詞) を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["gerund", "preposition"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-020 / 過去進行形 / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "I (   ) reading a book when my mother came home.",
    choices: ["am", "is", "was", "are"],
    correct_index: 2,
    explanation_jp:
      "過去のあるときに進行中だった動作は was/were + ing 形。I は was です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "past-continuous"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-021 / 過去進行形 (複数) / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Anna and Sara (   ) talking in the classroom at three.",
    choices: ["is", "was", "are", "were"],
    correct_index: 3,
    explanation_jp:
      "Anna and Sara は複数なので過去進行形は were + ing 形です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["tense", "past-continuous", "plural"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-022 / 助動詞 must / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "You (   ) finish your homework before dinner.",
    choices: ["must", "can", "may", "could"],
    correct_index: 0,
    explanation_jp:
      "「〜しなければならない」は must を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["modal", "must"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // G3-023 / 助動詞 should / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "You (   ) drink water when you feel hot.",
    choices: ["could", "should", "may", "would"],
    correct_index: 1,
    explanation_jp:
      "「〜したほうがよい」とアドバイスするときは should を使います。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["modal", "should", "advice"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // G3-024 / 助動詞 could (過去の能力) / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "When Lily was three, she (   ) already read the alphabet.",
    choices: ["may", "must", "should", "could"],
    correct_index: 3,
    explanation_jp:
      "can の過去形は could。「〜できた」と過去の能力を表します。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["modal", "could", "past-ability"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-025 / 間接疑問 / correct_index=3
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "I do not know where (   ).",
    choices: ["is Mike", "Mike is going", "does Mike go", "Mike lives"],
    correct_index: 3,
    explanation_jp:
      "間接疑問では「疑問詞 + 主語 + 動詞」の語順になります。",
    difficulty: 2,
    estimated_time_sec: 45,
    tags: ["indirect-question"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.85,
  },
  // G3-026 / there is / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "(   ) are many flowers in the garden.",
    choices: ["There", "It", "They", "These"],
    correct_index: 0,
    explanation_jp:
      "「〜があります」は There is/are 〜。複数なので There are です。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["there-are"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // G3-027 / 付加疑問 / correct_index=1
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "Ben likes apples, (   ) he?",
    choices: ["isn't", "doesn't", "won't", "hasn't"],
    correct_index: 1,
    explanation_jp:
      "肯定文 + 否定の付加疑問。一般動詞 likes (現在) なので doesn't を使います。",
    difficulty: 2,
    estimated_time_sec: 40,
    tags: ["tag-question"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.86,
  },
  // G3-028 / it is ... to do / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "It is fun (   ) study English with my friends.",
    choices: ["of", "for", "to", "at"],
    correct_index: 2,
    explanation_jp:
      "「〜するのは…だ」は It is + 形容詞 + to + 動詞の原形。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["it-is-to"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // G3-029 / want O to do / correct_index=2
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "My mother wants me (   ) the dishes after dinner.",
    choices: ["wash", "washing", "to wash", "washed"],
    correct_index: 2,
    explanation_jp:
      "「〜に…してほしい」は want + 人 + to + 動詞の原形です。",
    difficulty: 1,
    estimated_time_sec: 35,
    tags: ["want-O-to-do"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // G3-030 / make O C / correct_index=0
  {
    level: "eiken-3",
    skill: "grammar",
    prompt_text: "The good news made Mary (   ).",
    choices: ["happy", "happily", "happiness", "to happy"],
    correct_index: 0,
    explanation_jp:
      "「〜を…にする」は make + 人/もの + 形容詞。形容詞 happy が入ります。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["make-O-C"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
];

// ---------------------------------------------------------------------------
// 3 級 listening 30 問 (L3-021 〜 L3-050)
// 場面: 学校 / 家族 / 季節 / 食事 / 趣味 / 数字 / 時間 / スポーツ /
//       動物 / 色 / 天気 / 旅行 / 病気・体調 / 道案内 (W5 11 場面 + 拡張 3)
// difficulty 分散: 0 4 問 / 1 18 問 / 2 8 問
// correct_index 分散: 0:8 / 1:7 / 2:8 / 3:7
// ---------------------------------------------------------------------------

const listeningProblems: Eiken3Listening[] = [
  // L3-021 / 学校 / 現在完了 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Have you finished your homework? Yes, I have already finished it.",
    choices: [
      "He has not started yet.",
      "He is doing it now.",
      "He has already finished it.",
      "He will do it tomorrow.",
    ],
    correct_index: 2,
    explanation_jp:
      "「I have already finished it」と言っているので、彼はもう終わっています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "school", "present-perfect"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-022 / 家族 / 現在完了 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How long has Lily lived in Hanei Town? She has lived here for five years.",
    choices: [
      "For five years.",
      "For three years.",
      "For ten years.",
      "Since last month.",
    ],
    correct_index: 0,
    explanation_jp:
      "「She has lived here for five years」と言っているので、5 年間住んでいます。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "family", "present-perfect"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-023 / 季節 / 関係詞 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Spring is the season which I like the best. Cherry trees bloom everywhere.",
    choices: [
      "She likes summer the best.",
      "She likes spring the best.",
      "She likes autumn the best.",
      "She likes winter the best.",
    ],
    correct_index: 1,
    explanation_jp:
      "「Spring is the season which I like the best」と言っているので、春が一番好きです。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "season", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // L3-024 / 食事 / 受動態 / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "This rice ball was made by Tom's mother this morning. It is so tasty.",
    choices: [
      "Tom's father made it.",
      "Tom made it.",
      "Tom's grandmother made it.",
      "Tom's mother made it.",
    ],
    correct_index: 3,
    explanation_jp:
      "「was made by Tom's mother」と言っているので、Tom のお母さんが作りました。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "food", "passive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // L3-025 / 趣味 / 動名詞 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What is Ben's hobby? He enjoys playing the guitar every weekend.",
    choices: [
      "He likes drawing.",
      "He likes cooking.",
      "He likes playing the guitar.",
      "He likes swimming.",
    ],
    correct_index: 2,
    explanation_jp:
      "「He enjoys playing the guitar」と言っているので、Ben の趣味はギターです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "hobby", "gerund"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-026 / 数字 / 過去 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How many students were in the music club? There were twelve students last year.",
    choices: ["Twelve.", "Twenty.", "Two.", "Ten."],
    correct_index: 0,
    explanation_jp:
      "「There were twelve students」と言っているので、12 人でした。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "number", "past"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-027 / 時間 / 比較 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Today I got up earlier than yesterday. I got up at six this morning.",
    choices: [
      "He got up at five.",
      "He got up at six.",
      "He got up at seven.",
      "He got up at eight.",
    ],
    correct_index: 1,
    explanation_jp:
      "「I got up at six this morning」と言っているので、今朝は 6 時に起きました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "time", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-028 / スポーツ / 助動詞 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Mike could swim across the pool when he was eight years old.",
    choices: [
      "He could not swim.",
      "He could only walk.",
      "He could swim across the pool.",
      "He could ride a bike.",
    ],
    correct_index: 2,
    explanation_jp:
      "「could swim across the pool」と言っているので、彼はプールを泳ぎ切ることができました。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "sport", "could"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // L3-029 / 動物 / 関係詞 / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "The dog which is sleeping on the sofa is called Coco. He is a brown puppy.",
    choices: [
      "The dog is running.",
      "The dog is eating.",
      "The dog is jumping.",
      "The dog is sleeping.",
    ],
    correct_index: 3,
    explanation_jp:
      "「The dog which is sleeping」と言っているので、犬は眠っています。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "animal", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.88,
  },
  // L3-030 / 色 / 過去進行形 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Mary was wearing a yellow dress at the party last night.",
    choices: [
      "Yellow.",
      "Red.",
      "Green.",
      "Pink.",
    ],
    correct_index: 0,
    explanation_jp:
      "「a yellow dress」と言っているので、Mary は黄色のドレスを着ていました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "color", "past-continuous"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-031 / 天気 / 現在完了 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "It has been raining since this morning in Hanei Town.",
    choices: [
      "It has been sunny.",
      "It has been raining.",
      "It has been snowing.",
      "It has been windy.",
    ],
    correct_index: 1,
    explanation_jp:
      "「It has been raining」と言っているので、ずっと雨が降っています。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "weather", "present-perfect-continuous"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-032 / 旅行 / 不定詞 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Where does Anna want to go this summer? She wants to visit Kyoto with her family.",
    choices: [
      "She wants to go to Tokyo.",
      "She wants to go to Osaka.",
      "She wants to visit Kyoto.",
      "She wants to stay home.",
    ],
    correct_index: 2,
    explanation_jp:
      "「She wants to visit Kyoto」と言っているので、Anna は京都に行きたいです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "travel", "infinitive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-033 / 病気・体調 / should / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "I have a small cold today. You should drink warm water and rest at home.",
    choices: [
      "He should run outside.",
      "He should swim in the pool.",
      "He should go to school.",
      "He should rest at home.",
    ],
    correct_index: 3,
    explanation_jp:
      "「You should drink warm water and rest at home」と言っているので、家で休むのが良いです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "health", "should"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // L3-034 / 道案内 / 受動態 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "The library is located next to the post office on Main Street.",
    choices: [
      "Next to the post office.",
      "In front of the school.",
      "Behind the station.",
      "Across the river.",
    ],
    correct_index: 0,
    explanation_jp:
      "「next to the post office」と言っているので、図書館は郵便局の隣にあります。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "direction", "passive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-035 / 学校 / 関係詞 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Ms. Yamada is the teacher who teaches us science at Sakura Elementary.",
    choices: [
      "She teaches English.",
      "She teaches science.",
      "She teaches math.",
      "She teaches music.",
    ],
    correct_index: 1,
    explanation_jp:
      "「the teacher who teaches us science」と言っているので、理科の先生です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "school", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // L3-036 / 家族 / 比較 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Tom's brother is taller than his father. He is the tallest in the family.",
    choices: [
      "His father is the tallest.",
      "His mother is the tallest.",
      "His brother is the tallest.",
      "Tom is the tallest.",
    ],
    correct_index: 2,
    explanation_jp:
      "「He is the tallest in the family」と言っているので、Tom のお兄さんが家族で一番背が高いです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "family", "superlative"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-037 / 季節 / 過去 / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Last winter, Hanei Town had a lot of snow. The children built a big snowman.",
    choices: [
      "They went swimming.",
      "They climbed a mountain.",
      "They went camping.",
      "They built a snowman.",
    ],
    correct_index: 3,
    explanation_jp:
      "「The children built a big snowman」と言っているので、雪だるまを作りました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "season", "past"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-038 / 食事 / 動名詞 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Sara likes eating curry and rice for lunch. It is her favorite food.",
    choices: [
      "Curry and rice.",
      "Pizza and salad.",
      "Hamburger and fries.",
      "Sushi and soup.",
    ],
    correct_index: 0,
    explanation_jp:
      "「Sara likes eating curry and rice」と言っているので、Sara の好物はカレーライスです。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "food", "gerund"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L3-039 / 趣味 / 過去進行形 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What was Yuki doing at four yesterday? She was drawing a picture in her room.",
    choices: [
      "She was reading a book.",
      "She was drawing a picture.",
      "She was singing a song.",
      "She was watching TV.",
    ],
    correct_index: 1,
    explanation_jp:
      "「She was drawing a picture」と言っているので、Yuki は絵を描いていました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "hobby", "past-continuous"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-040 / 数字 / 比較 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Ken has more stickers than Ben. Ken has fifteen and Ben has nine.",
    choices: [
      "Nine.",
      "Twelve.",
      "Fifteen.",
      "Twenty.",
    ],
    correct_index: 2,
    explanation_jp:
      "「Ken has fifteen」と言っているので、Ken は 15 枚持っています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "number", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-041 / 時間 / 現在完了 / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Mary has been waiting for the bus since two o'clock this afternoon.",
    choices: [
      "Since one o'clock.",
      "Since three o'clock.",
      "Since four o'clock.",
      "Since two o'clock.",
    ],
    correct_index: 3,
    explanation_jp:
      "「since two o'clock this afternoon」と言っているので、2 時から待っています。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "time", "present-perfect-continuous"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-042 / スポーツ / 不定詞 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Anna wants to join the tennis club at her new school next April.",
    choices: [
      "The tennis club.",
      "The soccer club.",
      "The music club.",
      "The art club.",
    ],
    correct_index: 0,
    explanation_jp:
      "「Anna wants to join the tennis club」と言っているので、テニス部に入りたいです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "sport", "infinitive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-043 / 動物 / 動名詞 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "My cat Mimi likes sleeping on my bed every afternoon. She is so cute.",
    choices: [
      "On the sofa.",
      "On the bed.",
      "On the chair.",
      "On the floor.",
    ],
    correct_index: 1,
    explanation_jp:
      "「sleeping on my bed」と言っているので、Mimi はベッドの上で寝ます。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "animal", "gerund"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-044 / 色 / 関係詞 / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "The bag which Lily bought yesterday is green. It has a small pocket on the side.",
    choices: [
      "Blue.",
      "Pink.",
      "Green.",
      "Brown.",
    ],
    correct_index: 2,
    explanation_jp:
      "「The bag which Lily bought yesterday is green」と言っているので、緑色です。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "color", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-045 / 天気 / 比較 / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "It is colder today than yesterday. We should wear a thick jacket.",
    choices: [
      "Today is warmer.",
      "Today is the same.",
      "Today is sunny.",
      "Today is colder.",
    ],
    correct_index: 3,
    explanation_jp:
      "「It is colder today than yesterday」と言っているので、今日はより寒いです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "weather", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-046 / 旅行 / 受動態 / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "This temple was built five hundred years ago. Many people visit it every year.",
    choices: [
      "Five hundred years ago.",
      "One hundred years ago.",
      "Fifty years ago.",
      "Last year.",
    ],
    correct_index: 0,
    explanation_jp:
      "「This temple was built five hundred years ago」と言っているので、500 年前です。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "travel", "passive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-047 / 病気・体調 / 助動詞 / correct_index=1
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "You must wash your hands before eating to stay healthy and clean.",
    choices: [
      "Before sleeping.",
      "Before eating.",
      "Before reading.",
      "Before running.",
    ],
    correct_index: 1,
    explanation_jp:
      "「wash your hands before eating」と言っているので、食事の前に手を洗います。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "health", "must"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-048 / 道案内 / there is / correct_index=2
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "There is a small park near my house. Many children play there every day.",
    choices: [
      "A school.",
      "A station.",
      "A park.",
      "A library.",
    ],
    correct_index: 2,
    explanation_jp:
      "「There is a small park」と言っているので、家の近くには公園があります。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "direction", "there-is"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L3-049 / 学校 / want O to do / correct_index=3
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "My teacher wants us to bring our science books tomorrow morning.",
    choices: [
      "Math books.",
      "English books.",
      "Music books.",
      "Science books.",
    ],
    correct_index: 3,
    explanation_jp:
      "「wants us to bring our science books」と言っているので、理科の教科書です。",
    difficulty: 2,
    estimated_time_sec: 35,
    tags: ["listening", "school", "want-O-to-do"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.87,
  },
  // L3-050 / 家族 / it is to / correct_index=0
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "It is fun to cook dinner with my mother on Sunday evening.",
    choices: [
      "Cooking dinner with mother.",
      "Watching TV with father.",
      "Reading books with sister.",
      "Going shopping with brother.",
    ],
    correct_index: 0,
    explanation_jp:
      "「It is fun to cook dinner with my mother」と言っているので、お母さんと夕食を作るのが楽しいです。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "family", "it-is-to"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
];

// ---------------------------------------------------------------------------
// Bundle export (W5 と同型)
// ---------------------------------------------------------------------------

const w6Bundle = {
  /** 3 級 grammar 30 問 (G3-001 〜 G3-030) */
  grammar: grammarProblems,
  /** 3 級 listening 30 問 (L3-021 〜 L3-050 / W5 L3-001..020 と連番接続) */
  listening: listeningProblems,
};

export type W6Bundle = typeof w6Bundle;

export { grammarProblems, listeningProblems };

export default w6Bundle;
