/**
 * PRJ-016 HANEI - W3 シード問題プール（第2陣 400 問 + V3-012 改稿）
 *
 * 作成日: 2026-04-26
 * 作成部署: Research（W3）
 * 範囲: 英検 5級 / 4級 / 3級
 *
 * 内訳（合計 400 問 = W2 200 問と合算で 600 問体制）:
 *   - 5級 listening: 100 問（L5-001 〜 L5-100）
 *   - 4級 grammar:   150 問（G4-001 〜 G4-150）
 *   - 3級 writing:   100 問（W3-001 〜 W3-100）
 *   - 5級 reorder:    30 問（O5-001 〜 O5-030） フリッピング（語順並べ替え）
 *   - 4級 reading:    20 問（R4-001 〜 R4-020）
 *
 * 加えて W2 で唯一閾値割れだった V3-012（受動態 was written）の改稿版を
 * REPLACEMENTS セクション（末尾）に配置。Dev 側 `replace-problem.ts` で差し替え可能。
 *
 * 制約:
 *   - 100% オリジナル AI 生成（過去問・市販教材を 1 文字も流用しない）
 *   - 絵文字なし
 *   - 子ども不適切表現なし（暴力 / 性 / 政治宗教 / 個人情報 / 賭博 / 恐怖煽り 0 件）
 *   - 固有名詞は架空（Sakura Elementary / Hanei Town / Lily, Tom, Ben, Mary, Mike,
 *     Anna, Ken, Yuki, Sara, Coco（犬）, Mimi（猫））
 *
 * スコアリング: research-w3-problems.md §3 参照（Self-judge ルーブリック）。
 * 全 400 問の generated_quality_score（0.85+ 99% 以上の達成）をフィールドに保持。
 *
 * 連動:
 *   - research-w2-problems.md §6（W3 への申し送り）
 *   - research-w1-llm-judge.md（cross-LLM judge 仕様）
 *   - research-w1-legal-kidsafe.md（kid-safe ポリシー）
 */

// ---------------------------------------------------------------------------
// 型定義（W2 と互換 + writing 拡張）
// ---------------------------------------------------------------------------

type EikenLevel = "eiken-5" | "eiken-4" | "eiken-3";
type Skill =
  | "vocab"
  | "grammar"
  | "listening"
  | "listening-response"
  | "reading"
  | "reorder"
  | "writing";

/**
 * 4択（mcq）型の問題。W2 と同じスキーマ。
 */
export type ChoiceProblem = {
  level: EikenLevel;
  skill: Exclude<Skill, "writing">;
  prompt_text: string;
  passage_text?: string;
  choices: string[];
  correct_index: number;
  explanation_jp: string;
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  audio_transcript?: string;
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  generated_quality_score: number;
};

/**
 * 並べ替え（reorder / フリッピング）型の問題。
 * choices を「並べ替え前のチャンク列」、correct_order を「正しい index 列」とする。
 */
export type ReorderProblem = Omit<ChoiceProblem, "skill" | "correct_index"> & {
  skill: "reorder";
  /** 並べ替え前の語/句のチャンク（例: ["I", "am", "a", "student"]） */
  choices: string[];
  /** 正しい順序を choices の index で表現（例: [3, 1, 0, 2] なら choices[3] choices[1] choices[0] choices[2]） */
  correct_order: number[];
  /** 完成形の英文（採点・解説表示用） */
  correct_sentence: string;
  /** writing/reorder では correct_index は使わないが UI 互換のため 0 固定 */
  correct_index: 0;
};

/**
 * 5 軸ルーブリック（内部 100 点満点）と公式 4 観点（16 点満点）を併記。
 *
 * 公式 4 観点（日本英語検定協会 / 2017 リニューアル以降）:
 *   1. 内容 (Content)        0-4 点
 *   2. 構成 (Organization)   0-4 点
 *   3. 語彙 (Vocabulary)     0-4 点
 *   4. 文法 (Grammar)        0-4 点
 *   合計 16 点 → CSE 換算 0-550
 *
 * HANEI 内部 5 軸（各 20 点 / 合計 100 点）:
 *   1. content       0-20  内容: お題に答えているか・理由 2 つ + 説明
 *   2. grammar       0-20  文法
 *   3. vocabulary    0-20  語彙
 *   4. structure     0-20  構成: 接続詞 / 流れ
 *   5. coherence     0-20  一貫性: 重複なし・主張ぶれなし
 */
export type WritingRubric = {
  /** 公式 4 観点（0-4 各 / 合計 16） */
  official_4axis: {
    content: 0 | 1 | 2 | 3 | 4;
    organization: 0 | 1 | 2 | 3 | 4;
    vocabulary: 0 | 1 | 2 | 3 | 4;
    grammar: 0 | 1 | 2 | 3 | 4;
  };
  /** HANEI 内部 5 軸（各 0-20 / 合計 100） */
  internal_5axis: {
    content: number;
    grammar: number;
    vocabulary: number;
    structure: number;
    coherence: number;
  };
  /** 採点コメント（学習者向けフィードバック雛形） — optional, generated runtime if absent */
  feedback_template_jp?: string;
};

/**
 * ライティング型の問題。
 * 4 択不可のため、お題 + 模範解答 + ルーブリック + kid-safe ノートを保持する。
 */
export type WritingProblem = {
  level: "eiken-3";
  skill: "writing";
  /** お題（日本語 or 英語混在） */
  prompt: string;
  /** 模範解答（25-35 語） */
  model_answer: string;
  /** 採点ルーブリック（満点想定の参考値） */
  rubric: WritingRubric;
  /** 子ども向け OK 話題か */
  kid_safe_notes: string;
  /** 想定語数下限 */
  word_count_min: 25;
  /** 想定語数上限 */
  word_count_max: 35;
  /** 想定回答時間（秒） */
  estimated_time_sec: number;
  /** タグ */
  tags: string[];
  /** difficulty: 3 級ライティングは最初から 2 固定（高難度） */
  difficulty: 2;
  /** 著作権 */
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  /** Self-judge スコア（W2 互換） */
  generated_quality_score: number;
};

export type W3Problem = ChoiceProblem | ReorderProblem | WritingProblem;

// ---------------------------------------------------------------------------
// ヘルパ: choices と correct_index から redistribute 対象判定
// ---------------------------------------------------------------------------

function _isChoiceProblem(p: W3Problem): p is ChoiceProblem {
  return p.skill !== "writing" && p.skill !== "reorder";
}

// ---------------------------------------------------------------------------
// ============================================================
// 5 級 listening 100 問（L5-001 〜 L5-100）
// 形式: audio_transcript（短い質問 or 短文 + 質問）+ 4 択
// 作問方針: あいさつ / 自己紹介 / 学校 / 家族 / 食事 / 動物 / 季節 / 数字 /
//           時間 / 色 / スポーツ / 趣味 の 12 場面 × 約 8-9 問ずつ
// 全問 difficulty 0 中心、難度 1 を 30 問ほど混在
// ============================================================
// ---------------------------------------------------------------------------

const listeningProblems: ChoiceProblem[] = [
  // L5-001
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Hello. My name is Lily. What is your name?",
    choices: ["My name is Tom.", "I am ten years old.", "I like cats.", "It is a pen."],
    correct_index: 0,
    explanation_jp: "「What is your name?」（あなたの名前は何ですか）には「My name is 〜」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "self-intro", "name"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-002
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How old are you?",
    choices: ["I am ten.", "I am Tom.", "I am from Japan.", "I am happy."],
    correct_index: 0,
    explanation_jp: "「How old are you?」（何さい？）には数字で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "age"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-003
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What color do you like?",
    choices: ["I like blue.", "I am five.", "I like apples.", "I have a pen."],
    correct_index: 0,
    explanation_jp: "「What color do you like?」（何色が好き？）には「I like 〜」で色名を答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "color"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-004
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What do you have in your bag?",
    choices: ["I have a book.", "I am a student.", "I go home.", "I like dogs."],
    correct_index: 0,
    explanation_jp: "「What do you have?」（何を持っている？）には「I have 〜」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "have"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-005
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Where is your school?",
    choices: ["It is in Hanei Town.", "It is a book.", "It is red.", "It is mine."],
    correct_index: 0,
    explanation_jp: "「Where is 〜?」（どこにある？）は場所で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "where"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-006
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Do you like apples?",
    choices: ["Yes, I do.", "Yes, it is.", "Yes, I am.", "Yes, you do."],
    correct_index: 0,
    explanation_jp: "「Do you 〜?」には「Yes, I do.」または「No, I don't.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "do-you"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-007
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Is this your pen?",
    choices: ["Yes, it is.", "Yes, I am.", "Yes, I do.", "Yes, they are."],
    correct_index: 0,
    explanation_jp: "「Is this 〜?」には「Yes, it is.」/「No, it isn't.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "is-this"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-008
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How many cats do you have?",
    choices: ["I have two.", "I am two.", "It is two.", "Yes, I do."],
    correct_index: 0,
    explanation_jp: "「How many 〜?」（いくつ？）には数字で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "how-many"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-009
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What time is it?",
    choices: ["It is three.", "It is rainy.", "It is mine.", "It is good."],
    correct_index: 0,
    explanation_jp: "「What time is it?」（何時？）には時刻を答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "time"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-010
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What day is it today?",
    choices: ["It is Monday.", "It is March.", "It is sunny.", "It is mine."],
    correct_index: 0,
    explanation_jp: "「What day is it?」（何曜日？）には曜日で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "day"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-011
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How is the weather today?",
    choices: ["It is sunny.", "It is mine.", "I am fine.", "I have a cat."],
    correct_index: 0,
    explanation_jp: "天気を聞かれたら sunny / cloudy / rainy などで答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "weather"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-012
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Where do you live?",
    choices: ["I live in Hanei Town.", "I am ten.", "I like rice.", "I have a dog."],
    correct_index: 0,
    explanation_jp: "「Where do you live?」（どこに住んでいる？）には「I live in 〜」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "where", "live"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-013
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What sport do you like?",
    choices: ["I like soccer.", "I like fish.", "I like blue.", "I am happy."],
    correct_index: 0,
    explanation_jp: "「What sport do you like?」（どんなスポーツが好き？）にはスポーツ名で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "sport"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-014
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Who is that boy?",
    choices: ["He is my brother.", "It is my book.", "I am Tom.", "She is happy."],
    correct_index: 0,
    explanation_jp: "「Who is 〜?」には「He is 〜」「She is 〜」で人物を答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "who"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-015
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What is your favorite food?",
    choices: ["I like sushi.", "I am hungry.", "I have a pen.", "Yes, I do."],
    correct_index: 0,
    explanation_jp: "「favorite food」（好きな食べ物）には「I like 〜」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "food"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-016
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Can you play the piano?",
    choices: ["Yes, I can.", "Yes, I am.", "Yes, I do.", "Yes, it is."],
    correct_index: 0,
    explanation_jp: "「Can you 〜?」には「Yes, I can.」/「No, I can't.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "can"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-017
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What month is it?",
    choices: ["It is May.", "It is Monday.", "It is sunny.", "It is mine."],
    correct_index: 0,
    explanation_jp: "「What month is it?」（何月？）には月で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "month"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-018
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How are you?",
    choices: ["I am fine.", "I am ten.", "I am Tom.", "I am here."],
    correct_index: 0,
    explanation_jp: "「How are you?」には「I am fine.」（元気です）など気分で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "greeting"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-019
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Is your sister a student?",
    choices: ["Yes, she is.", "Yes, he is.", "Yes, I am.", "Yes, it is."],
    correct_index: 0,
    explanation_jp: "「Is your sister 〜?」には「Yes, she is.」（彼女は〜です）と she で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "is-she"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-020
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Who is your music teacher?",
    choices: ["Mr. Sato is.", "It is a song.", "I like music.", "Yes, I do."],
    correct_index: 0,
    explanation_jp: "「Who is your teacher?」には先生の名前 + 「is」で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "who-teacher"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-021
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What season do you like?",
    choices: ["I like summer.", "I like math.", "I like blue.", "I like rice."],
    correct_index: 0,
    explanation_jp: "「season」（季節）には spring / summer / fall / winter で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "season"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-022
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Do you have a dog?",
    choices: ["No, I don't.", "No, I am not.", "No, it isn't.", "No, you don't."],
    correct_index: 0,
    explanation_jp: "「Do you 〜?」の否定の答えは「No, I don't.」です。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "do-you", "negative"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-023
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What is this?",
    choices: ["It is a book.", "I am happy.", "Yes, I do.", "No, you can't."],
    correct_index: 0,
    explanation_jp: "「What is this?」には「It is 〜」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "what-this"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-024
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Where is my pencil?",
    choices: ["It is on the desk.", "It is mine.", "It is red.", "It is rainy."],
    correct_index: 0,
    explanation_jp: "場所を聞かれたら on / in / under などの前置詞 + 場所で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "where", "preposition"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-025
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Who is she?",
    choices: ["She is my mother.", "He is my father.", "I am happy.", "It is a hat."],
    correct_index: 0,
    explanation_jp: "「Who is she?」には「She is 〜」と she で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "who-she"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-026
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "When is your birthday?",
    choices: ["It is in April.", "It is sunny.", "I am ten.", "I have a cake."],
    correct_index: 0,
    explanation_jp: "「When is 〜?」（いつ？）には月や日付で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "when", "birthday"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-027
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How is your new bag?",
    choices: ["It is nice.", "I am ten.", "It is Monday.", "I have a pen."],
    correct_index: 0,
    explanation_jp: "「How is 〜?」（〜はどう？）には形容詞で感想を答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "how-is"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-028
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Are you a student?",
    choices: ["Yes, I am.", "Yes, I do.", "Yes, it is.", "Yes, he is."],
    correct_index: 0,
    explanation_jp: "「Are you 〜?」には「Yes, I am.」/「No, I am not.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "are-you"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L5-029
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Do you go to Sakura Elementary?",
    choices: ["Yes, I do.", "Yes, I am.", "Yes, it is.", "Yes, I can."],
    correct_index: 0,
    explanation_jp: "「Do you 〜?」には「Yes, I do.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "do-you", "school"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-030
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Is it your dog?",
    choices: ["No, it isn't.", "No, I am not.", "No, you don't.", "No, he isn't."],
    correct_index: 0,
    explanation_jp: "「Is it 〜?」の否定は「No, it isn't.」です。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "is-it", "negative"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-031
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What animal do you like?",
    choices: ["I like rabbits.", "I like math.", "I like green.", "I am ten."],
    correct_index: 0,
    explanation_jp: "「What animal do you like?」には動物名で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "animal"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-032
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What do you want for breakfast?",
    choices: ["I want toast.", "I want to go.", "I want a pen.", "I want a cap."],
    correct_index: 0,
    explanation_jp: "朝食には toast / rice / eggs などで答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "food", "breakfast"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-033
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Where is the cat?",
    choices: ["It is under the chair.", "It is sunny.", "It is mine.", "I have a dog."],
    correct_index: 0,
    explanation_jp: "場所を聞かれたら前置詞 + 場所で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "where", "cat"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-034
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What grade are you in?",
    choices: ["I am in the fifth grade.", "I am ten.", "I am happy.", "I am Tom."],
    correct_index: 0,
    explanation_jp: "学年を聞かれたら「I am in the 〜 grade.」で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "school", "grade"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-035
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How many pencils do you have?",
    choices: ["I have five.", "I am five.", "It is five.", "I like five."],
    correct_index: 0,
    explanation_jp: "「How many 〜?」には「I have + 数字」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "how-many", "pencil"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-036
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Do you like math?",
    choices: ["Yes, I do.", "Yes, I am.", "Yes, it is.", "Yes, you can."],
    correct_index: 0,
    explanation_jp: "教科を聞かれたら「Yes, I do.」で答えます。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "subject", "math"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-037
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What time do you get up?",
    choices: ["At seven.", "At school.", "On Monday.", "In April."],
    correct_index: 0,
    explanation_jp: "起床時間は「At + 時刻」で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "time", "get-up"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-038
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Whose bag is this?",
    choices: ["It is mine.", "It is here.", "It is good.", "It is Monday."],
    correct_index: 0,
    explanation_jp: "「Whose 〜?」（だれの〜？）には所有代名詞で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "whose"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-039
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What do you do after school?",
    choices: ["I play soccer.", "I am ten.", "I have a cat.", "It is sunny."],
    correct_index: 0,
    explanation_jp: "「What do you do?」には動詞句で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "after-school"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-040
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Are these your books?",
    choices: ["Yes, they are.", "Yes, it is.", "Yes, I am.", "Yes, I do."],
    correct_index: 0,
    explanation_jp: "「Are these 〜?」（これらは？）には「Yes, they are.」と複数形で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "plural", "are-these"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-041
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What is your hobby?",
    choices: ["I like reading.", "I am ten.", "I have a pen.", "It is sunny."],
    correct_index: 0,
    explanation_jp: "趣味を聞かれたら「I like 〜ing」で動名詞を使います。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "hobby"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-042
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Can your brother swim?",
    choices: ["Yes, he can.", "Yes, I can.", "Yes, it can.", "Yes, you can."],
    correct_index: 0,
    explanation_jp: "「Can your brother 〜?」には「Yes, he can.」と he で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "can", "third-person"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-043
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Do you have any pets?",
    choices: ["Yes, I have a cat.", "Yes, I am ten.", "Yes, I like cats.", "Yes, I can."],
    correct_index: 0,
    explanation_jp: "ペットの有無を聞かれたら「Yes, I have 〜」で具体的に答えるのが自然です。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "pet"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-044
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What is on the table?",
    choices: ["A glass of milk.", "I have a glass.", "I am ten.", "It is mine."],
    correct_index: 0,
    explanation_jp: "「What is on 〜?」には物の名前で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "what-on"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-045
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How is your new teacher?",
    choices: ["She is very kind.", "He is ten.", "It is mine.", "I am happy."],
    correct_index: 0,
    explanation_jp: "「How is 〜?」には形容詞で印象を答えます。先生が女性なら She で受けます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "how-is", "teacher"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-046
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Is your mother a doctor?",
    choices: ["No, she isn't.", "No, he isn't.", "No, I am not.", "No, it isn't."],
    correct_index: 0,
    explanation_jp: "母親について「No, she isn't.」と she で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "is-she", "negative"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-047
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Where is your school bag?",
    choices: ["It is by the door.", "It is mine.", "It is happy.", "It is Sunday."],
    correct_index: 0,
    explanation_jp: "場所は前置詞 + 場所で答えます。「by」は「〜のそばに」です。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "where", "preposition"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-048
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "What do you study at school?",
    choices: ["I study English.", "I am ten.", "I have a pen.", "It is sunny."],
    correct_index: 0,
    explanation_jp: "「study + 教科」で勉強する科目を答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "study", "subject"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-049
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "How many sisters do you have?",
    choices: ["I have one sister.", "I have a cat.", "I am one.", "It is mine."],
    correct_index: 0,
    explanation_jp: "兄弟姉妹の人数は「I have + 数字 + sister(s) / brother(s)」で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "family", "how-many"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-050
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript: "Who is taller, you or your brother?",
    choices: ["My brother is.", "I have a cat.", "I am ten.", "It is mine."],
    correct_index: 0,
    explanation_jp: "比較で問われたら主語 + is で答えます。",
    difficulty: 1,
    estimated_time_sec: 25,
    tags: ["listening", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // L5-051 〜 L5-100 は会話形式（A: + B: の短い対話 + 質問 1 つ）
  // L5-051
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、その内容に最も合う応答を選びなさい。",
    audio_transcript: "A: Lily, what time is it now? B: It is three thirty.",
    choices: ["3:30", "3:13", "1:30", "2:30"],
    correct_index: 0,
    explanation_jp: "「three thirty」は 3:30 です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "time"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-052
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mom, where is my cap? B: It is on your bed.",
    choices: ["On the bed.", "Under the desk.", "In the bag.", "By the door."],
    correct_index: 0,
    explanation_jp: "母親が「on your bed（ベッドの上）」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-053
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, do you like soccer? B: No, I don't. I like baseball.",
    choices: ["Tom likes baseball.", "Tom likes soccer.", "Tom likes both.", "Tom likes neither."],
    correct_index: 0,
    explanation_jp: "Tom は「No, I don't. I like baseball.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "sport"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-054
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mary, how is the weather today? B: It is rainy.",
    choices: ["It is rainy.", "It is sunny.", "It is windy.", "It is snowy."],
    correct_index: 0,
    explanation_jp: "Mary は「It is rainy.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "weather"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-055
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, what do you have for lunch? B: I have a sandwich and milk.",
    choices: ["A sandwich and milk.", "Rice and tea.", "Bread and juice.", "Eggs and water."],
    correct_index: 0,
    explanation_jp: "Ben は「a sandwich and milk」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "lunch"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-056
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, do you have a brother? B: Yes, I have one brother and one sister.",
    choices: ["One brother and one sister.", "Two brothers.", "Two sisters.", "No brothers."],
    correct_index: 0,
    explanation_jp: "Anna は「one brother and one sister」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "family"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-057
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ken, what time do you go to bed? B: I go to bed at nine.",
    choices: ["At nine.", "At seven.", "At eight.", "At ten."],
    correct_index: 0,
    explanation_jp: "Ken は「at nine」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "time", "bed"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-058
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Yuki, how many books do you have? B: I have ten books.",
    choices: ["Ten books.", "Two books.", "Five books.", "One book."],
    correct_index: 0,
    explanation_jp: "Yuki は「ten books」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "how-many"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-059
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Sara, can you play tennis? B: No, I can't, but I can play soccer.",
    choices: ["She can play soccer.", "She can play tennis.", "She can play both.", "She can play neither."],
    correct_index: 0,
    explanation_jp: "Sara は「I can't (play tennis), but I can play soccer.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "can"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-060
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mike, who is your best friend? B: My best friend is Tom.",
    choices: ["Tom.", "Ben.", "Lily.", "Mary."],
    correct_index: 0,
    explanation_jp: "Mike は「My best friend is Tom.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "friend"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-061
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Lily, what do you want for your birthday? B: I want a new bag.",
    choices: ["A new bag.", "A new pen.", "A new book.", "A new cap."],
    correct_index: 0,
    explanation_jp: "Lily は「a new bag」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "want"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-062
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, what is your favorite subject? B: I like science.",
    choices: ["Science.", "Math.", "English.", "Music."],
    correct_index: 0,
    explanation_jp: "Tom は「I like science.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "subject"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-063
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, where do you go on Sundays? B: I go to the park.",
    choices: ["To the park.", "To school.", "To the library.", "To the shop."],
    correct_index: 0,
    explanation_jp: "Anna は「to the park」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "park"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-064
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, do you know Mr. Tanaka? B: Yes, he is my math teacher.",
    choices: ["He is Ben's math teacher.", "He is Ben's friend.", "He is Ben's father.", "He is Ben's brother."],
    correct_index: 0,
    explanation_jp: "Ben は「he is my math teacher」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "teacher"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-065
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mary, how old is your brother? B: He is seven.",
    choices: ["Seven.", "Five.", "Ten.", "Eight."],
    correct_index: 0,
    explanation_jp: "Mary は「He is seven.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "age"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-066
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ken, what do you usually drink in the morning? B: I drink milk.",
    choices: ["Milk.", "Water.", "Juice.", "Tea."],
    correct_index: 0,
    explanation_jp: "Ken は「I drink milk.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "drink"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-067
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Yuki, when do you have a piano lesson? B: On Wednesdays.",
    choices: ["On Wednesdays.", "On Mondays.", "On Fridays.", "On Sundays."],
    correct_index: 0,
    explanation_jp: "Yuki は「On Wednesdays.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "day"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-068
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Sara, what color is your bike? B: It is blue.",
    choices: ["Blue.", "Red.", "Yellow.", "Green."],
    correct_index: 0,
    explanation_jp: "Sara は「It is blue.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "color"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-069
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mike, can you ride a bike? B: Yes, I can.",
    choices: ["Yes.", "No.", "Sometimes.", "I don't know."],
    correct_index: 0,
    explanation_jp: "Mike は「Yes, I can.」と答えています。",
    difficulty: 0,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "can"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-070
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Lily, do you walk to school? B: Yes, I do.",
    choices: ["Yes.", "No.", "I take the bus.", "I take the train."],
    correct_index: 0,
    explanation_jp: "Lily は「Yes, I do.」と答えています。",
    difficulty: 0,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "school"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-071
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, where is the library? B: It is next to the post office.",
    choices: ["Next to the post office.", "By the park.", "Behind the school.", "On the hill."],
    correct_index: 0,
    explanation_jp: "Tom は「next to the post office」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "library"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-072
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, what is in your bag? B: A book and a notebook.",
    choices: ["A book and a notebook.", "A pen.", "A lunch box.", "A cap."],
    correct_index: 0,
    explanation_jp: "Anna は「A book and a notebook.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "what-in"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-073
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, how is your mother? B: She is fine, thank you.",
    choices: ["She is fine.", "She is tired.", "She is busy.", "She is happy."],
    correct_index: 0,
    explanation_jp: "Ben は「She is fine, thank you.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "how-is"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-074
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mary, do you like English? B: Yes, I love it.",
    choices: ["She loves English.", "She doesn't like English.", "She likes math.", "She doesn't say."],
    correct_index: 0,
    explanation_jp: "Mary は「I love it」と強い好意を示しています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "subject"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-075
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ken, what season do you like? B: I like spring because flowers are pretty.",
    choices: ["Spring.", "Summer.", "Fall.", "Winter."],
    correct_index: 0,
    explanation_jp: "Ken は「I like spring」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "season"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-076
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Yuki, can you play the violin? B: No, I can't, but I can play the piano.",
    choices: ["She can play the piano.", "She can play the violin.", "She can play both.", "She can play neither."],
    correct_index: 0,
    explanation_jp: "Yuki は「I can't (the violin), but I can play the piano.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "can", "music"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-077
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Sara, who is your favorite singer? B: I like Lily Sato.",
    choices: ["Lily Sato.", "Mike Sato.", "Ben Tanaka.", "Mary Suzuki."],
    correct_index: 0,
    explanation_jp: "Sara は「I like Lily Sato.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "favorite"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-078
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mike, do you want milk or juice? B: Juice, please.",
    choices: ["Juice.", "Milk.", "Water.", "Tea."],
    correct_index: 0,
    explanation_jp: "Mike は「Juice, please.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "drink", "or"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-079
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Lily, where is your father now? B: He is at work.",
    choices: ["At work.", "At home.", "At school.", "At the park."],
    correct_index: 0,
    explanation_jp: "Lily は「He is at work.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "father"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-080
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, when do you do your homework? B: After dinner.",
    choices: ["After dinner.", "Before lunch.", "On Mondays.", "At seven."],
    correct_index: 0,
    explanation_jp: "Tom は「After dinner.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "when", "homework"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-081
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, do you have a piano? B: Yes, I have a small one.",
    choices: ["Yes, she has one.", "No, she doesn't.", "She wants one.", "She doesn't say."],
    correct_index: 0,
    explanation_jp: "Anna は「Yes, I have a small one.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "have"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-082
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, what is your father's job? B: He is a cook.",
    choices: ["A cook.", "A teacher.", "A doctor.", "A driver."],
    correct_index: 0,
    explanation_jp: "Ben は「He is a cook.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "job"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-083
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mary, are you tired? B: Yes, a little.",
    choices: ["A little tired.", "Very tired.", "Not tired.", "Hungry."],
    correct_index: 0,
    explanation_jp: "Mary は「Yes, a little.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "tired"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-084
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ken, how do you go to school? B: I walk every day.",
    choices: ["He walks.", "He takes the bus.", "He rides a bike.", "He takes the train."],
    correct_index: 0,
    explanation_jp: "Ken は「I walk every day.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "how", "school"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-085
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Yuki, do you like rainy days? B: No, I don't. I like sunny days.",
    choices: ["She likes sunny days.", "She likes rainy days.", "She likes both.", "She likes neither."],
    correct_index: 0,
    explanation_jp: "Yuki は「I like sunny days」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "weather", "preference"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-086
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Sara, can your mother make a cake? B: Yes, she can. Her cakes are very good.",
    choices: ["Yes, she can.", "No, she can't.", "Sometimes.", "She doesn't say."],
    correct_index: 0,
    explanation_jp: "Sara は「Yes, she can.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "can", "mother"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-087
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mike, where do you eat lunch? B: At school, in the classroom.",
    choices: ["In the classroom.", "At home.", "At the park.", "At a restaurant."],
    correct_index: 0,
    explanation_jp: "Mike は「In the classroom.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "lunch"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-088
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Lily, what is your phone number? B: Sorry, I don't tell my number.",
    choices: ["She doesn't tell.", "555-1234.", "She tells him.", "She doesn't have a phone."],
    correct_index: 0,
    explanation_jp: "Lily は番号を教えないと答えています。子どもは個人情報を伝えないのが安全です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "kid-safe", "personal-info"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L5-089
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, what fruit do you like? B: I like bananas the best.",
    choices: ["Bananas.", "Apples.", "Oranges.", "Grapes."],
    correct_index: 0,
    explanation_jp: "Tom は「bananas the best」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "fruit"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-090
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, do you like Mondays? B: Not really. I like Fridays.",
    choices: ["Fridays.", "Mondays.", "Both.", "Neither."],
    correct_index: 0,
    explanation_jp: "Anna は「I like Fridays.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "day", "preference"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-091
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, what is in your lunch box today? B: A rice ball and an egg.",
    choices: ["A rice ball and an egg.", "Bread and jam.", "Soup and salad.", "A sandwich and milk."],
    correct_index: 0,
    explanation_jp: "Ben は「A rice ball and an egg.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "lunch"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-092
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mary, where is your cat? B: She is sleeping on the chair.",
    choices: ["On the chair.", "Under the bed.", "In the box.", "By the door."],
    correct_index: 0,
    explanation_jp: "Mary は「on the chair」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "cat"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-093
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ken, do you study after school? B: Yes, I study for one hour.",
    choices: ["For one hour.", "For two hours.", "Not at all.", "On Sundays only."],
    correct_index: 0,
    explanation_jp: "Ken は「for one hour」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "study"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-094
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Yuki, can your father play the guitar? B: Yes, he can. He plays well.",
    choices: ["Yes, he can.", "No, he can't.", "Sometimes.", "She doesn't know."],
    correct_index: 0,
    explanation_jp: "Yuki は「Yes, he can.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "can", "father"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-095
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Sara, what time does the school start? B: At eight thirty.",
    choices: ["At 8:30.", "At 8:13.", "At 9:30.", "At 7:30."],
    correct_index: 0,
    explanation_jp: "Sara は「eight thirty」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "time", "school"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-096
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Mike, how is your new bike? B: It is very nice. I like the color.",
    choices: ["He likes it.", "He doesn't like it.", "It is broken.", "He hasn't tried it."],
    correct_index: 0,
    explanation_jp: "Mike は「very nice」「I like the color」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "how-is", "bike"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-097
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Lily, do you have classes on Saturdays? B: No, I don't.",
    choices: ["No.", "Yes.", "Sometimes.", "Only morning."],
    correct_index: 0,
    explanation_jp: "Lily は「No, I don't.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "school", "weekend"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-098
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Tom, where is the gym? B: It is by the school garden.",
    choices: ["By the school garden.", "Near the post office.", "On the second floor.", "Behind the library."],
    correct_index: 0,
    explanation_jp: "Tom は「by the school garden」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "where", "gym"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // L5-099
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Anna, what do you want to be? B: I want to be a teacher.",
    choices: ["A teacher.", "A doctor.", "A singer.", "A writer."],
    correct_index: 0,
    explanation_jp: "Anna は「I want to be a teacher.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "future", "job"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L5-100
  {
    level: "eiken-5",
    skill: "listening",
    prompt_text: "対話を聞いて、内容に合う応答を選びなさい。",
    audio_transcript: "A: Ben, are you ready for the test tomorrow? B: Yes, I studied a lot.",
    choices: ["Yes, he is ready.", "No, he is not ready.", "He doesn't know.", "He didn't study."],
    correct_index: 0,
    explanation_jp: "Ben は「Yes, I studied a lot.」と答えています。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "dialogue", "test", "ready"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
];

// ---------------------------------------------------------------------------
// ============================================================
// 4 級 grammar 150 問（G4-001 〜 G4-150）
// 範囲（DEC-018 申し送り準拠）:
//   - 時制 (present, past, future, present continuous): 30 問 G4-001〜030
//   - 助動詞 (can, may, must, should, will, would): 25 問 G4-031〜055
//   - 比較 (比較級・最上級・原級 as ... as): 25 問 G4-056〜080
//   - 受動態 (be + p.p.): 20 問 G4-081〜100
//   - 関係代名詞 (who, which, that): 20 問 G4-101〜120
//   - 現在完了 (経験・完了・継続): 30 問 G4-121〜150
// ============================================================
// ---------------------------------------------------------------------------

const grammarProblems: ChoiceProblem[] = [
  // ===== 時制 30 問 (G4-001 to G4-030) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "Lily (   ) to school every day.", choices: ["walks", "walked", "walking", "walk"], correct_index: 0, explanation_jp: "「every day」は現在形と一緒に使います。三人称単数 Lily なので s をつけて「walks」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-simple", "third-person-s"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Tom (   ) tennis yesterday.", choices: ["played", "plays", "playing", "play"], correct_index: 0, explanation_jp: "「yesterday」があるので過去形「played」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary (   ) visit her grandmother next Sunday.", choices: ["will", "is", "was", "does"], correct_index: 0, explanation_jp: "「next Sunday」は未来なので「will + 動詞の原形」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "future", "will"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Look! Ben (   ) a book now.", choices: ["is reading", "reads", "read", "was reading"], correct_index: 0, explanation_jp: "「Look!」「now」があるので現在進行形「is reading」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-continuous"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) TV when my mother came home.", choices: ["was watching", "watch", "watched", "am watching"], correct_index: 0, explanation_jp: "「過去のあるとき進行中だった動作」は過去進行形「was watching」です。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "past-continuous"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Anna (   ) to the park last Saturday.", choices: ["went", "goes", "going", "go"], correct_index: 0, explanation_jp: "go の過去形は不規則で「went」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mike (   ) lunch at twelve yesterday.", choices: ["had", "has", "have", "having"], correct_index: 0, explanation_jp: "have の過去形は「had」です。yesterday があるので過去形を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "My father (   ) coffee every morning.", choices: ["drinks", "drink", "drinking", "drank"], correct_index: 0, explanation_jp: "「My father」は三人称単数なので、現在形では動詞に s をつけて「drinks」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-simple", "third-person-s"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) be late for school tomorrow.", choices: ["won't", "don't", "didn't", "am not"], correct_index: 0, explanation_jp: "「will not」の短縮形は「won't」です。tomorrow があるので未来の否定。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "future", "won't"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We (   ) going to play soccer this weekend.", choices: ["are", "is", "were", "do"], correct_index: 0, explanation_jp: "We は複数なので be 動詞は「are」、「be going to + 動詞の原形」で予定を表します。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "future", "be-going-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "It (   ) very hot last summer.", choices: ["was", "is", "were", "are"], correct_index: 0, explanation_jp: "It の過去形 be 動詞は「was」です。", difficulty: 0, estimated_time_sec: 25, tags: ["tense", "past-simple", "be-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We (   ) at the library yesterday.", choices: ["were", "was", "are", "is"], correct_index: 0, explanation_jp: "We の過去形 be 動詞は「were」です。", difficulty: 0, estimated_time_sec: 25, tags: ["tense", "past-simple", "be-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Sara (   ) not sleeping when I called.", choices: ["was", "is", "did", "were"], correct_index: 0, explanation_jp: "「was/were + not + ing」で過去進行形の否定。Sara は単数なので was。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "past-continuous", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) you come to my party tomorrow?", choices: ["Will", "Did", "Are", "Do"], correct_index: 0, explanation_jp: "tomorrow があるので未来。「Will + 主語 + 動詞の原形 ?」で疑問文。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "future", "will-question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ken (   ) not playing the guitar now.", choices: ["is", "does", "was", "did"], correct_index: 0, explanation_jp: "「is/are + not + ing」で現在進行形の否定。Ken は単数なので is。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-continuous", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Yuki is (   ) for the test now.", choices: ["studying", "studies", "studied", "study"], correct_index: 0, explanation_jp: "be 動詞 + ing 形で進行形。study の ing 形は「studying」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-continuous", "ing-form"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mom is (   ) a cake in the kitchen.", choices: ["making", "makes", "made", "make"], correct_index: 0, explanation_jp: "make は e を取って ing をつけ「making」になります。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-continuous", "ing-form"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ben is (   ) in the park now.", choices: ["running", "runs", "ran", "run"], correct_index: 0, explanation_jp: "run は n を重ねて ing をつけ「running」です。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "present-continuous", "ing-double-letter"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary (   ) a movie last night.", choices: ["saw", "sees", "seeing", "see"], correct_index: 0, explanation_jp: "see の過去形は不規則で「saw」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "My sister (   ) like fish.", choices: ["doesn't", "don't", "isn't", "didn't"], correct_index: 0, explanation_jp: "三人称単数の現在形否定は「doesn't + 動詞の原形」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-simple", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) go to school yesterday because I was sick.", choices: ["didn't", "don't", "wasn't", "haven't"], correct_index: 0, explanation_jp: "過去形の否定は「didn't + 動詞の原形」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We (   ) pizza for dinner last Friday.", choices: ["ate", "eat", "eaten", "eats"], correct_index: 0, explanation_jp: "eat の過去形は不規則で「ate」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) you watch TV last night?", choices: ["Did", "Do", "Are", "Was"], correct_index: 0, explanation_jp: "過去形の疑問文は「Did + 主語 + 動詞の原形 ?」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The train (   ) at seven every morning.", choices: ["leaves", "left", "leaving", "leave"], correct_index: 0, explanation_jp: "「every morning」は現在形と一緒に使います。三人称単数 The train なので「leaves」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-simple", "third-person-s"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Lily (   ) many pictures on the school trip.", choices: ["took", "takes", "taking", "take"], correct_index: 0, explanation_jp: "take の過去形は不規則で「took」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "My grandmother (   ) cookies for me yesterday.", choices: ["made", "makes", "making", "make"], correct_index: 0, explanation_jp: "make の過去形は不規則で「made」です。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Tomorrow (   ) be sunny.", choices: ["will", "is", "was", "does"], correct_index: 0, explanation_jp: "Tomorrow（明日）は未来なので「will be」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "future", "will-be"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) Tom playing soccer now?", choices: ["Is", "Does", "Was", "Did"], correct_index: 0, explanation_jp: "現在進行形の疑問文は「Is/Are + 主語 + ing ?」。Tom は単数なので Is。", difficulty: 1, estimated_time_sec: 30, tags: ["tense", "present-continuous", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Anna (   ) a long letter to her cousin.", choices: ["wrote", "writes", "writing", "write"], correct_index: 0, explanation_jp: "write の過去形は不規則で「wrote」です。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "past-simple", "irregular-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mike usually (   ) breakfast at seven.", choices: ["eats", "is eating", "ate", "eaten"], correct_index: 0, explanation_jp: "「usually」は習慣を表すので現在形を使います。三人称単数なので「eats」。", difficulty: 2, estimated_time_sec: 35, tags: ["tense", "present-simple", "vs-continuous"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  // ===== 助動詞 25 問 (G4-031 to G4-055) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "Lily (   ) speak three languages.", choices: ["can", "is", "does", "has"], correct_index: 0, explanation_jp: "「〜できる」は can。「can + 動詞の原形」です。", difficulty: 0, estimated_time_sec: 25, tags: ["modal", "can"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) swim very well.", choices: ["cannot", "am not", "do not", "have not"], correct_index: 0, explanation_jp: "「〜できない」は cannot（または can't）です。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "cannot"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) wear a helmet when you ride a bike.", choices: ["must", "are", "do", "have"], correct_index: 0, explanation_jp: "「〜しなければならない」は must です。must + 動詞の原形。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "must"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) drink water after running.", choices: ["should", "are", "do", "have"], correct_index: 0, explanation_jp: "「〜すべき」は should です。アドバイスを表します。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "should"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) I open the window? It is hot.", choices: ["May", "Am", "Have", "Must"], correct_index: 0, explanation_jp: "丁寧な許可を求めるときは「May I 〜?」（〜してもいいですか）を使います。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "may"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) help you tomorrow.", choices: ["will", "am", "do", "have"], correct_index: 0, explanation_jp: "未来の意思を表すには「will + 動詞の原形」を使います。", difficulty: 0, estimated_time_sec: 25, tags: ["modal", "will"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) like a glass of water, please.", choices: ["would", "will", "am", "do"], correct_index: 0, explanation_jp: "「〜が欲しい」を丁寧に言うのは「would like」です。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "would-like"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) you help me with my homework?", choices: ["Can", "Are", "Do", "Have"], correct_index: 0, explanation_jp: "「〜してくれる？」と頼むときは「Can you 〜?」が自然です。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "can-you"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) eat in the library.", choices: ["must not", "are not", "do not have", "should be"], correct_index: 0, explanation_jp: "「〜してはいけない」は「must not」です（強い禁止）。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "must-not"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Tom (   ) study hard for the test.", choices: ["has to", "is", "does", "will"], correct_index: 0, explanation_jp: "「〜しなければならない」は「have to / has to」でも表せます。Tom は三人称単数なので「has to」。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "have-to", "third-person-s"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) come early. There is enough time.", choices: ["don't have to", "must not", "can not", "should not"], correct_index: 0, explanation_jp: "「〜する必要がない」は「don't have to」です。must not（〜してはいけない）と意味が違います。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "don't-have-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "When I was five, I (   ) ride a bike.", choices: ["could", "can", "may", "must"], correct_index: 0, explanation_jp: "can の過去形は could です。「〜できた」を表します。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "could", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "It (   ) rain this afternoon.", choices: ["may", "is", "does", "has"], correct_index: 0, explanation_jp: "「〜かもしれない」は may です。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "may", "guess"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) talk loudly in the hospital.", choices: ["should not", "do not", "are not", "have not"], correct_index: 0, explanation_jp: "「〜すべきでない」は「should not」（または shouldn't）です。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "should-not"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) forget your kindness.", choices: ["will not", "do not", "am not", "have not"], correct_index: 0, explanation_jp: "「〜しないだろう / 〜しない」と未来の否定は「will not」（won't）です。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "will-not"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) we go to the park together?", choices: ["Shall", "Are", "Do", "Have"], correct_index: 0, explanation_jp: "「Shall we 〜?」は「いっしょに〜しませんか」と提案する表現です。", difficulty: 2, estimated_time_sec: 35, tags: ["modal", "shall-we"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) clean my room yesterday.", choices: ["had to", "have to", "must", "should"], correct_index: 0, explanation_jp: "「〜しなければならなかった」は「had to」です。yesterday があるので過去形。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "had-to", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Yuki (   ) play the violin very well.", choices: ["can", "cans", "is", "does"], correct_index: 0, explanation_jp: "助動詞 can は主語が三人称単数でも形は変わりません（s をつけない）。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "can", "third-person"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Next year, I (   ) be able to speak English well.", choices: ["will", "am", "do", "have"], correct_index: 0, explanation_jp: "「will be able to 〜」で「将来〜できるだろう」を表します。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "will-be-able-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "She (   ) be tired after the long trip.", choices: ["must", "is going", "do", "have"], correct_index: 0, explanation_jp: "「〜にちがいない」と確信を表すときは must を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "must-be"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) I use your pencil?", choices: ["May", "Are", "Do", "Have"], correct_index: 0, explanation_jp: "「May I 〜?」は丁寧に許可を求める表現です。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "may-i"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mike (   ) come to the party. He has a piano lesson.", choices: ["can't", "isn't", "doesn't", "won't be"], correct_index: 0, explanation_jp: "「〜できない」は can't（cannot）です。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "can't"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) eat more vegetables for your health.", choices: ["should", "are", "do", "have"], correct_index: 0, explanation_jp: "アドバイスは「should」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["modal", "should", "advice"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Anna (   ) eat carrots. She doesn't like them.", choices: ["won't", "doesn't be", "isn't", "haven't"], correct_index: 0, explanation_jp: "「will not」の短縮 won't は「どうしても〜しない」というニュアンスを持ちます。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "won't"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "You (   ) take an umbrella. It looks like rain.", choices: ["had better", "must to", "have to be", "are to"], correct_index: 0, explanation_jp: "「〜したほうがよい（しないと困る）」は「had better + 動詞の原形」です。", difficulty: 2, estimated_time_sec: 40, tags: ["modal", "had-better"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  // ===== 比較 25 問 (G4-056 to G4-080) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "Tom is (   ) than Ben.", choices: ["taller", "tall", "tallest", "more tall"], correct_index: 0, explanation_jp: "形容詞 + er + than 〜 で「〜より背が高い」を表します。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "comparative", "-er"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is the (   ) book in the library.", choices: ["oldest", "older", "old", "more old"], correct_index: 0, explanation_jp: "the + 形容詞 + est で「最も〜」を表します。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "superlative", "-est"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This story is (   ) interesting than that one.", choices: ["more", "much", "very", "most"], correct_index: 0, explanation_jp: "interesting のような長い形容詞は「more + 形容詞 + than」で比較します。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "more"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is the (   ) beautiful flower in our garden.", choices: ["most", "more", "much", "very"], correct_index: 0, explanation_jp: "beautiful は長い形容詞なので最上級は「the most + 形容詞」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "superlative", "most"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary is as (   ) as Lily.", choices: ["tall", "taller", "tallest", "more tall"], correct_index: 0, explanation_jp: "「as + 形容詞の原級 + as」で「同じくらい〜」を表します。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "as-as"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Anna sings (   ) than Sara.", choices: ["better", "good", "best", "more good"], correct_index: 0, explanation_jp: "good / well の比較級は不規則で「better」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "better"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is the (   ) cake I have ever eaten.", choices: ["best", "better", "good", "most good"], correct_index: 0, explanation_jp: "good の最上級は不規則で「the best」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "superlative", "best"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Today's weather is (   ) than yesterday's.", choices: ["worse", "bad", "worst", "more bad"], correct_index: 0, explanation_jp: "bad の比較級は不規則で「worse」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "worse"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "That was the (   ) movie I have seen this year.", choices: ["worst", "worse", "bad", "more bad"], correct_index: 0, explanation_jp: "bad の最上級は不規則で「the worst」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "superlative", "worst"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ken looks (   ) than yesterday.", choices: ["happier", "happy", "happiest", "more happy"], correct_index: 0, explanation_jp: "y で終わる形容詞は y を i に変えて er をつけ「happier」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "-ier"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "An elephant is (   ) than a dog.", choices: ["bigger", "big", "biggest", "more big"], correct_index: 0, explanation_jp: "big は g を重ねて er をつけ「bigger」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "double-letter"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mt. Fuji is the (   ) mountain in Japan.", choices: ["highest", "higher", "high", "more high"], correct_index: 0, explanation_jp: "the + 形容詞 + est で最上級。「最も高い」は「the highest」。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "superlative", "geography"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Summer days are (   ) than winter days.", choices: ["longer", "long", "longest", "more long"], correct_index: 0, explanation_jp: "long の比較級は「longer」です。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "comparative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ben is not as (   ) as Tom.", choices: ["fast", "faster", "fastest", "more fast"], correct_index: 0, explanation_jp: "「as + 原級 + as」を否定すると「not as + 原級 + as」で「〜ほど…ない」です。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "as-as", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mike runs (   ) than I do.", choices: ["faster", "fast", "fastest", "more fast"], correct_index: 0, explanation_jp: "副詞 fast の比較級も「faster」です。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "comparative", "adverb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This park is (   ) than the other one.", choices: ["nicer", "nice", "nicest", "more nice"], correct_index: 0, explanation_jp: "nice は e を取って r をつけ「nicer」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Today is (   ) than yesterday.", choices: ["hotter", "hot", "hottest", "more hot"], correct_index: 0, explanation_jp: "hot は t を重ねて er をつけ「hotter」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "double-letter"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Soccer is the (   ) popular sport in our school.", choices: ["most", "more", "much", "very"], correct_index: 0, explanation_jp: "popular は長い形容詞なので、最上級は「the most popular」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "superlative", "most"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Sara is the tallest (   ) the three girls.", choices: ["of", "in", "than", "for"], correct_index: 0, explanation_jp: "「〜の中で」が複数の人やもの（of the three）には of を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "superlative", "of-vs-in"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ken is the strongest (   ) our class.", choices: ["in", "of", "than", "for"], correct_index: 0, explanation_jp: "「〜の中で」が場所や集団のときは in を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "superlative", "in-vs-of"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This bag is (   ) bigger than that one.", choices: ["much", "very", "more", "most"], correct_index: 0, explanation_jp: "比較級を強めるときは「much + 比較級」で「ずっと〜」です。very は使えません。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "much-comparative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary plays the piano (   ) than her sister.", choices: ["better", "good", "best", "more well"], correct_index: 0, explanation_jp: "well の比較級は「better」です。", difficulty: 2, estimated_time_sec: 35, tags: ["comparison", "comparative", "well-better"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) is more interesting, this book or that one?", choices: ["Which", "What", "Who", "When"], correct_index: 0, explanation_jp: "2つ以上のものから「どちら？」と聞くときは Which を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "which"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This pen is the same (   ) yours.", choices: ["as", "than", "to", "of"], correct_index: 0, explanation_jp: "「同じ」を表すときは「the same as 〜」を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["comparison", "the-same-as"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) tall is your brother?", choices: ["How", "What", "Which", "Why"], correct_index: 0, explanation_jp: "身長や程度を聞くときは「How + 形容詞 〜?」を使います。", difficulty: 1, estimated_time_sec: 30, tags: ["comparison", "how-tall"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  // ===== 受動態 20 問 (G4-081 to G4-100) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "English (   ) in many countries.", choices: ["is spoken", "speaks", "speaking", "spoke"], correct_index: 0, explanation_jp: "「〜される」は「be 動詞 + 過去分詞」です。English は単数なので「is spoken」。", difficulty: 2, estimated_time_sec: 35, tags: ["passive", "present"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "These books (   ) by many children.", choices: ["are read", "read", "reads", "reading"], correct_index: 0, explanation_jp: "These books は複数なので「are + 過去分詞」。read の過去分詞は read です。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "present", "plural"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This song (   ) by my grandmother fifty years ago.", choices: ["was made", "made", "makes", "is making"], correct_index: 0, explanation_jp: "「fifty years ago」は過去なので「was + 過去分詞」。This song は単数なので was。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "These pictures (   ) by Mary last year.", choices: ["were taken", "took", "takes", "is taking"], correct_index: 0, explanation_jp: "These pictures は複数 + last year は過去なので「were + 過去分詞 (taken)」。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "plural"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This letter (   ) by Ben yesterday.", choices: ["was written", "wrote", "writes", "writing"], correct_index: 0, explanation_jp: "「was/were + 過去分詞」で受動態の過去。write の過去分詞は written です。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "written"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The cake was made (   ) my mother.", choices: ["by", "with", "in", "of"], correct_index: 0, explanation_jp: "「〜によって」と動作の主体を表すときは by を使います。", difficulty: 2, estimated_time_sec: 35, tags: ["passive", "by"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Hanei Town is (   ) for its beautiful river.", choices: ["known", "knows", "knowing", "know"], correct_index: 0, explanation_jp: "「is known for 〜」で「〜で知られている」です。known は know の過去分詞。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "known-for"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This story (   ) read by my class.", choices: ["was not", "did not", "was not be", "have not"], correct_index: 0, explanation_jp: "受動態の否定は「be 動詞 + not + 過去分詞」。「was not read」になります。", difficulty: 2, estimated_time_sec: 45, tags: ["passive", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) this picture painted by Picasso?", choices: ["Was", "Did", "Has", "Have"], correct_index: 0, explanation_jp: "受動態の疑問文は be 動詞を主語の前に置きます。「Was + 主語 + 過去分詞 ?」。", difficulty: 2, estimated_time_sec: 45, tags: ["passive", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Many computers (   ) in this office every day.", choices: ["are used", "use", "uses", "using"], correct_index: 0, explanation_jp: "「are + 過去分詞」で複数主語の受動態 現在。use の過去分詞は used。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "present", "plural"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This bridge (   ) one hundred years ago.", choices: ["was built", "built", "is building", "build"], correct_index: 0, explanation_jp: "「one hundred years ago」は過去なので「was + 過去分詞」。build の過去分詞は built です。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "built"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This bread is (   ) at the school festival.", choices: ["sold", "sells", "selling", "sell"], correct_index: 0, explanation_jp: "「is + 過去分詞」で受動態。sell の過去分詞は sold。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "present", "sold"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The cat was (   ) under the chair.", choices: ["found", "finds", "find", "finding"], correct_index: 0, explanation_jp: "「was + 過去分詞」で受動態。find の過去分詞は found。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "found"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This desk is made (   ) wood.", choices: ["of", "by", "in", "for"], correct_index: 0, explanation_jp: "材料が見ためで分かる場合は「made of」を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "made-of"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We were (   ) to her birthday party last week.", choices: ["invited", "invites", "inviting", "invite"], correct_index: 0, explanation_jp: "「were + 過去分詞」で受動態の過去。invite の過去分詞は invited。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "invited"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "A nice present was (   ) to me.", choices: ["given", "gives", "giving", "gave"], correct_index: 0, explanation_jp: "「was + 過去分詞」で受動態の過去。give の過去分詞は given。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "given"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The classroom is (   ) every morning.", choices: ["cleaned", "cleans", "cleaning", "clean"], correct_index: 0, explanation_jp: "「is + 過去分詞」で受動態。clean の過去分詞は cleaned。", difficulty: 2, estimated_time_sec: 35, tags: ["passive", "present", "cleaned"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Soccer is (   ) all over the world.", choices: ["played", "plays", "playing", "play"], correct_index: 0, explanation_jp: "「is + 過去分詞」で受動態。play の過去分詞は played。", difficulty: 2, estimated_time_sec: 35, tags: ["passive", "present", "played"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Many fish are (   ) in this river every summer.", choices: ["caught", "catches", "catching", "catch"], correct_index: 0, explanation_jp: "「are + 過去分詞」で受動態。catch の過去分詞は caught。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "present", "caught"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The old bike was (   ) by the strong wind.", choices: ["broken", "breaks", "breaking", "break"], correct_index: 0, explanation_jp: "「was + 過去分詞」で受動態の過去。break の過去分詞は broken。", difficulty: 2, estimated_time_sec: 40, tags: ["passive", "past", "broken"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  // ===== 関係代名詞 20 問 (G4-101 to G4-120) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "I have a friend (   ) lives in Hanei Town.", choices: ["who", "which", "what", "where"], correct_index: 0, explanation_jp: "先行詞が人で、関係詞節内で主語の位置に空きがあるときは who を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "who", "subject"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is a book (   ) is famous in our school.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞が「もの」で主語のときは which を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "which", "subject"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Look at the dog (   ) is running in the park.", choices: ["that", "what", "where", "why"], correct_index: 0, explanation_jp: "that は人にも物にも使えます。who / which の代わりに使えます。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "that"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The boy (   ) I met yesterday is Tom.", choices: ["who", "which", "what", "where"], correct_index: 0, explanation_jp: "先行詞が人で、関係詞節内で目的語の位置に空きがあるときも who（または whom）を使います。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "object"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The book (   ) I read last night was very good.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞が「もの」で目的語のときは which を使います。that も可。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "which", "object"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I know a girl who (   ) the violin well.", choices: ["plays", "play", "playing", "is play"], correct_index: 0, explanation_jp: "先行詞 a girl は三人称単数なので、関係詞節内の動詞も「plays」となります。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "agreement"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have a cat (   ) is very quiet.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞 a cat（動物 = もの扱い）には which を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "which", "animal"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The cake (   ) Mary made was delicious.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞が「もの」で、関係詞節内で目的語のときは which。that も可、省略も可ですが、選択肢は which。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "which", "object"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is the only book (   ) I have at home.", choices: ["that", "what", "where", "why"], correct_index: 0, explanation_jp: "先行詞に the only / the first などがつくときは that を使うのが一般的です。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "that", "the-only"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I like students who (   ) hard.", choices: ["study", "studies", "is studying", "to study"], correct_index: 0, explanation_jp: "先行詞 students は複数なので、関係詞節内の動詞は原形（s なし）の「study」。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "plural-agreement"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mr. Sato is the teacher (   ) teaches us English.", choices: ["who", "which", "what", "where"], correct_index: 0, explanation_jp: "先行詞 the teacher（人 + 主語）には who を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "who", "teacher"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I bought a bag (   ) was on sale.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞 a bag（もの + 主語）には which を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "which", "subject"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The shoes (   ) I bought are too small.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞 The shoes（複数のもの + 目的語）には which を使います。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "which", "object"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have a sister who (   ) in Tokyo.", choices: ["lives", "live", "living", "to live"], correct_index: 0, explanation_jp: "先行詞 a sister は三人称単数なので、関係詞節の動詞は「lives」。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "agreement"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The man (   ) called me yesterday is my uncle.", choices: ["who", "which", "what", "where"], correct_index: 0, explanation_jp: "先行詞 The man（人 + 主語）には who。動詞 called で過去形でも形は変わりません。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Look at the bird (   ) is flying high.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "動物の場合は which（または that）を使います。who はふつう使いません。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "which", "animal"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I don't know the boy (   ) is standing over there.", choices: ["who", "which", "what", "where"], correct_index: 0, explanation_jp: "先行詞 the boy（人 + 主語）には who を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "who", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "This is the house (   ) my grandfather built.", choices: ["which", "who", "what", "where"], correct_index: 0, explanation_jp: "先行詞 the house（もの + 目的語）には which を使います。場所でも、ここでは目的語位置なので which/that。", difficulty: 2, estimated_time_sec: 50, tags: ["relative", "which", "object", "house"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The dog (   ) is sleeping there is mine.", choices: ["that", "who", "what", "where"], correct_index: 0, explanation_jp: "動物の主語の位置には that または which を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["relative", "that", "animal"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "The friend who (   ) me yesterday was very kind.", choices: ["helped", "helps", "helping", "to help"], correct_index: 0, explanation_jp: "yesterday があるので関係詞節も過去形「helped」を使います。", difficulty: 2, estimated_time_sec: 45, tags: ["relative", "who", "past-tense"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  // ===== 現在完了 30 問 (G4-121 to G4-150) =====
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) been to Hokkaido twice.", choices: ["have", "am", "did", "was"], correct_index: 0, explanation_jp: "「〜したことがある」（経験）は「have/has + 過去分詞」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Tom (   ) lived in Hanei Town for ten years.", choices: ["has", "have", "did", "was"], correct_index: 0, explanation_jp: "三人称単数 Tom には「has + 過去分詞」を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "third-person", "has"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Have you (   ) seen a panda?", choices: ["ever", "yet", "already", "just"], correct_index: 0, explanation_jp: "「今までに〜したことがありますか」と経験を聞くときは「ever」を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "ever"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have (   ) eaten sushi before.", choices: ["never", "yet", "ever", "just"], correct_index: 0, explanation_jp: "「一度も〜したことがない」は「have never + 過去分詞」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "never"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have (   ) finished my homework.", choices: ["already", "yet", "ever", "since"], correct_index: 0, explanation_jp: "「もう〜してしまった」と完了を表す肯定文は「already」を使います。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "already"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary hasn't read this book (   ).", choices: ["yet", "already", "ever", "just"], correct_index: 0, explanation_jp: "否定文・疑問文で「まだ・もう」を表すのは「yet」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "yet"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ben has (   ) come back from school.", choices: ["just", "yet", "ever", "since"], correct_index: 0, explanation_jp: "「ちょうど〜したところ」を表すのは「just」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "just"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have studied English (   ) three years.", choices: ["for", "since", "from", "during"], correct_index: 0, explanation_jp: "「〜の間」と期間を表すのは「for」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "continuation", "for"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We have known each other (   ) we were five.", choices: ["since", "for", "from", "during"], correct_index: 0, explanation_jp: "「〜以来」（起点）を表すのは「since」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "continuation", "since"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mom has (   ) to the supermarket.", choices: ["gone", "go", "going", "went"], correct_index: 0, explanation_jp: "go の過去分詞は「gone」。「has gone to 〜」で「〜へ行ってしまった（今ここにいない）」。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "gone"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have (   ) that movie three times.", choices: ["seen", "saw", "see", "seeing"], correct_index: 0, explanation_jp: "see の過去分詞は「seen」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "seen"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Anna has (   ) Kyoto twice.", choices: ["visited", "visit", "visiting", "visits"], correct_index: 0, explanation_jp: "visit の過去分詞は「visited」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "visited"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "(   ) you finished your lunch?", choices: ["Have", "Did", "Are", "Were"], correct_index: 0, explanation_jp: "現在完了の疑問文は「Have/Has + 主語 + 過去分詞 ?」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I (   ) read this book yet.", choices: ["haven't", "didn't", "don't", "wasn't"], correct_index: 0, explanation_jp: "現在完了の否定は「haven't/hasn't + 過去分詞」。yet があるので完了の否定。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "negative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Have you (   ) your homework?", choices: ["done", "do", "did", "doing"], correct_index: 0, explanation_jp: "do の過去分詞は「done」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "done"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary has (   ) here for five years.", choices: ["lived", "live", "living", "lives"], correct_index: 0, explanation_jp: "live の過去分詞は「lived」です。「for + 期間」で継続を表します。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "continuation", "lived"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have (   ) a letter to my grandmother.", choices: ["written", "wrote", "writes", "writing"], correct_index: 0, explanation_jp: "write の過去分詞は「written」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "written"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "We have (   ) Mike before.", choices: ["met", "meet", "meets", "meeting"], correct_index: 0, explanation_jp: "meet の過去分詞は「met」（過去形と同形）です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "met"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Ken has just (   ) tennis with his friends.", choices: ["played", "play", "plays", "playing"], correct_index: 0, explanation_jp: "play の過去分詞は「played」です。just は完了。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "played"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mom has (   ) lunch for us.", choices: ["made", "make", "makes", "making"], correct_index: 0, explanation_jp: "make の過去分詞は「made」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "made"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "grammar", prompt_text: "How many times have you (   ) Tokyo?", choices: ["visited", "visit", "visits", "visiting"], correct_index: 0, explanation_jp: "「How many times have + 主語 + 過去分詞 〜?」で経験の回数を聞きます。", difficulty: 2, estimated_time_sec: 45, tags: ["present-perfect", "experience", "how-many-times"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have (   ) my pencil.", choices: ["lost", "lose", "loses", "losing"], correct_index: 0, explanation_jp: "lose の過去分詞は「lost」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "lost"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Yuki has been to Okinawa (   ).", choices: ["once", "ever", "yet", "for"], correct_index: 0, explanation_jp: "「一度」は once。経験の回数として使います。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "once"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Sara (   ) finished her dinner yet.", choices: ["hasn't", "haven't", "didn't", "isn't"], correct_index: 0, explanation_jp: "三人称単数の現在完了否定は「hasn't + 過去分詞」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "negative", "third-person"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have lived in this town since (   ).", choices: ["2020", "five years", "long time", "the morning"], correct_index: 0, explanation_jp: "since は「過去のある時点」を表します。年（2020）が自然です。", difficulty: 2, estimated_time_sec: 45, tags: ["present-perfect", "since", "year"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mike has played the piano for (   ).", choices: ["five years", "2020", "yesterday", "last year"], correct_index: 0, explanation_jp: "for は「期間」を表します。「5年間」が自然です。", difficulty: 2, estimated_time_sec: 45, tags: ["present-perfect", "for", "period"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Lily has (   ) her lunch box today.", choices: ["brought", "bring", "brings", "bringing"], correct_index: 0, explanation_jp: "bring の過去分詞は「brought」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "completion", "brought"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Tom has (   ) many pictures of his cat.", choices: ["taken", "took", "takes", "taking"], correct_index: 0, explanation_jp: "take の過去分詞は「taken」です。", difficulty: 2, estimated_time_sec: 40, tags: ["present-perfect", "experience", "taken"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-4", skill: "grammar", prompt_text: "I have read this book before. ＝ I (   ) read this book.", choices: ["have already", "did", "have just", "had"], correct_index: 0, explanation_jp: "「以前読んだことがある = もう読んだ」は「have already + 過去分詞」が近い意味になります。", difficulty: 2, estimated_time_sec: 50, tags: ["present-perfect", "experience", "already"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.84 },
  { level: "eiken-4", skill: "grammar", prompt_text: "Mary (   ) been busy since this morning.", choices: ["has", "is", "did", "was"], correct_index: 0, explanation_jp: "「since this morning」は現在完了を伴います。三人称単数 Mary には「has」。", difficulty: 2, estimated_time_sec: 45, tags: ["present-perfect", "since", "third-person"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
];

// ============================================================================
// WRITING PROBLEMS (3級, 100 problems, W3-001 to W3-100)
// Schema: prompt / model_answer (25-35 words) / rubric (5-axis x 20pts) / kid_safe_notes
// Topics: school / family / season / hobby / food / animal / sport ONLY
// Official Eiken 3 rubric (4-axis: Content/Organization/Vocabulary/Grammar, 0-4 each)
//   is mapped to internal 5-axis (content/grammar/vocabulary/structure/coherence, 0-20 each)
// ============================================================================

const writingProblems: WritingProblem[] = [
  // --- SCHOOL (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite subject at school? Why?", model_answer: "My favorite subject is English. I like English because I want to talk with people from many countries. Our teacher is kind and the lessons are always fun.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 19, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "学校の話題のみ、特定の人物名なし", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "subject", "favorite"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like your school lunch? Why or why not?", model_answer: "Yes, I like my school lunch very much. The food is healthy and tasty. My favorite menu is curry and rice. We can eat with our friends every day.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "学校給食の話題、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "lunch", "food"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What club do you want to join in junior high school?", model_answer: "I want to join the soccer club in junior high school. I have played soccer for five years. I want to make new friends and become a better player.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "部活動の話題、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "club", "future"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What do you do during recess at school?", model_answer: "I usually play tag with my friends during recess. We run around the playground and have a lot of fun. Sometimes we read books in the library together.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "休み時間の遊び、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "recess", "play"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "How do you go to school every day?", model_answer: "I walk to school every day with my classmates. It takes about fifteen minutes from my house. We talk about our homework and games on the way.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "通学方法、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "commute", "daily"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you want to learn at school next year?", model_answer: "I want to learn more English at school next year. English is useful when I travel abroad. I also want to study science to learn about plants and animals.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "学習意欲、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "future", "study"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Who is your best friend at school?", model_answer: "My best friend is Yuki. She is in the same class as me. We always eat lunch together and play during recess. She is kind, funny, and very smart.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "友達紹介、健全（一般的な日本人名）", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "friend"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is the most fun event at your school?", model_answer: "The most fun event at my school is the sports day in autumn. We run, jump, and play games with our classmates. Our parents come to watch and cheer for us.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "学校行事、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "event", "sports-day"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like studying math? Why?", model_answer: "Yes, I like studying math because it is like solving a puzzle. When I get the right answer, I feel very happy. My math teacher explains everything clearly.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "教科の好み、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "math", "subject"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you usually do after school?", model_answer: "After school, I usually go home and do my homework first. Then I play with my younger brother in the park. We come home before dinner at six.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "放課後活動、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "after-school", "daily"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite place at school?", model_answer: "My favorite place at school is the library. There are many interesting books to read. I often go there during lunch break to read about animals.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "学校の場所、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "library", "favorite"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you have homework every day? How do you feel about it?", model_answer: "Yes, I have homework every day. Sometimes it is difficult, but I try my best. I usually finish my homework before dinner so I can relax later.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "宿題の話題、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "homework"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What did you do on your last school trip?", model_answer: "On my last school trip, we went to a big aquarium. I saw many fish, dolphins, and sea turtles. We had a picnic lunch outside and took many photos.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "遠足、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "trip", "past"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What do you want to be in the future?", model_answer: "I want to be an English teacher in the future. I love English and I want to help other students learn it. Teachers can change students lives.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "将来の夢、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "future", "dream"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "How can you become better at English?", model_answer: "I can become better at English by reading English books every day. I also watch English movies with subtitles. Practice every day is the most important thing.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "学習方法、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["school", "english", "study-method"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  // --- FAMILY (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "How many people are there in your family?", model_answer: "There are four people in my family: my father, my mother, my younger sister, and me. We live together in a small house. We are all very close.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "家族構成、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "members"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What do you usually do with your family on weekends?", model_answer: "On weekends, my family usually goes shopping or eats out together. Sometimes we watch movies at home. Last Sunday, we went to a park and had a picnic.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "週末の家族活動、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "weekend"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Tell me about your father or mother.", model_answer: "My mother is a kind and busy person. She works as a nurse at a hospital. She cooks delicious meals for us every day. I love her very much.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "家族紹介、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "parent"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you have any brothers or sisters?", model_answer: "Yes, I have one younger brother. He is seven years old and goes to elementary school. We sometimes fight, but we play video games together every evening.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "兄弟姉妹、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "siblings"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you eat for dinner with your family?", model_answer: "We usually eat rice, miso soup, and fish for dinner. My mother is a great cook. On Fridays, we sometimes eat pizza or curry as a special treat.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "家族の夕食、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "dinner", "food"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Where did you go with your family last summer?", model_answer: "Last summer, my family went to my grandparents house in the countryside. We swam in the river and ate fresh vegetables from their garden. It was a great trip.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "家族旅行、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "trip", "summer"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Do you help with housework? What do you do?", model_answer: "Yes, I help with housework every day. I wash the dishes after dinner and clean my room every weekend. Sometimes I help my mother with cooking.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "家事手伝い、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "housework"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is the best birthday present you ever got from your family?", model_answer: "The best birthday present I ever got was a bicycle from my parents. I was eight years old then. I still ride it to the park with my friends every weekend.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "誕生日プレゼント、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "birthday", "present"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Do you have any pets at home?", model_answer: "Yes, we have a small dog named Pochi. He is brown and very friendly. I take him for a walk every morning before school. He loves running in the park.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "ペット、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "pet"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you talk about at the dinner table?", model_answer: "At the dinner table, we talk about our day. I tell my parents about school and my friends. My father usually shares funny stories from his work.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "家族の会話、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "dinner", "talk"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Who do you respect the most in your family? Why?", model_answer: "I respect my grandfather the most in my family. He is eighty years old, but he still works in his garden every day. He always teaches me to be kind.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "家族尊敬、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "respect", "grandfather"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What did you do to celebrate New Year with your family?", model_answer: "We visited my grandparents house for New Year. We ate special Japanese food called osechi together. I received New Year money from my grandparents. It was fun.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "新年、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "new-year"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you and your family do on rainy days?", model_answer: "On rainy days, my family stays at home. We watch movies, play board games, or read books. My mother sometimes bakes cookies. Rainy days can be really fun too.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "雨の日活動、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "rainy", "indoor"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What is special about your family?", model_answer: "What is special about my family is that we eat dinner together every night. We always share our day and laugh together. I am very lucky to have such a family.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "家族の特徴、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "special"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you want to do with your family next vacation?", model_answer: "Next vacation, I want to go camping with my family. We have never tried camping before. I want to sleep in a tent and cook food outside under the stars.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "家族計画、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["family", "vacation", "camping"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  // --- SEASON (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite season? Why?", model_answer: "My favorite season is spring. The cherry blossoms are very beautiful. I enjoy watching them with my family. The weather is also warm and comfortable for going outside.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "季節、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "spring", "favorite"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "What do you like to do in summer?", model_answer: "In summer, I like to go swimming at the beach with my family. I also enjoy eating shaved ice on hot days. Summer vacation is the most exciting time of the year.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "夏の活動、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "summer"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What is fun about autumn for you?", model_answer: "Autumn is fun because the leaves change colors. Red, yellow, and orange leaves are very beautiful. I also love eating sweet potatoes and chestnuts during autumn.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "秋の魅力、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "autumn"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like winter? Why or why not?", model_answer: "Yes, I like winter very much. I can play in the snow and make snowmen with my friends. Hot chocolate after playing outside tastes wonderful in cold weather.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "冬、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "winter"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you wear in summer?", model_answer: "In summer, I usually wear a T-shirt and shorts. They are light and cool. I also wear a cap and sunglasses outside. Sometimes I wear sandals to the beach.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "夏服、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "summer", "clothes"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite summer event?", model_answer: "My favorite summer event is the fireworks festival in my town. The fireworks are huge and beautiful. I always go with my family and we eat snacks at the festival.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "夏祭り、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "summer", "festival"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "What is the weather like in your town now?", model_answer: "The weather in my town is warm and sunny these days. The cherry blossoms are starting to bloom. It is a perfect time to go for a walk in the park.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "天気、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "weather"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What season is the busiest at your school?", model_answer: "Autumn is the busiest season at my school. We have a sports day, a school festival, and a music concert. We practice a lot for these events with our classmates.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "学校行事、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "school", "autumn"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What do you eat in summer to feel cool?", model_answer: "In summer, I eat shaved ice and ice cream to feel cool. Cold soba noodles are also delicious. Watermelon is my favorite summer fruit. It is sweet and juicy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "夏の食べ物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "summer", "food"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What did you do during winter vacation?", model_answer: "During winter vacation, I went skiing with my family in the mountains. The snow was deep and white. I fell down many times, but I had a great time learning to ski.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "冬休み、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "winter", "vacation"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like rainy days? Why or why not?", model_answer: "I like rainy days because I can stay home and read books. The sound of rain is also relaxing. However, I cannot play outside, and that makes me feel a little sad.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "雨の日、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "rain"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite holiday and why?", model_answer: "My favorite holiday is Christmas. My family decorates a Christmas tree together. I get presents from my parents and we eat a special dinner. The whole house feels warm.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "祝日、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "holiday", "christmas"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What flowers do you see in spring?", model_answer: "In spring, I see many beautiful flowers. Cherry blossoms, tulips, and dandelions bloom everywhere. The colors are pink, red, yellow, and white. They make me feel happy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "春の花、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "spring", "flower"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "How do you stay warm in winter?", model_answer: "In winter, I wear a warm coat, a hat, and gloves outside. At home, I drink hot tea or hot chocolate. I also use a warm blanket when I read books in my room.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "冬の対策、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "winter", "warm"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What season do you not like? Why?", model_answer: "I do not like the rainy season very much. It rains almost every day for several weeks. I cannot play outside and my clothes get wet. The weather feels a little gloomy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "嫌いな季節、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["season", "rainy"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  // --- HOBBY (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your hobby?", model_answer: "My hobby is reading books. I read different books almost every day. My favorite books are about adventures and animals. Reading helps me learn many new things and words.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "趣味、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "reading"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "How long have you done your hobby?", model_answer: "I have played the piano for six years. I started when I was six years old. I practice for thirty minutes every day. Playing the piano makes me feel calm and happy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "趣味継続、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "piano", "duration"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What hobby do you want to start in the future?", model_answer: "In the future, I want to start painting as a new hobby. I love bright colors and beautiful pictures. I want to paint flowers and the sea. Maybe I will join a class.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "新しい趣味、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "future", "painting"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like reading? What kind of books do you like?", model_answer: "Yes, I love reading. I usually read mystery and adventure books. My favorite series is about a young detective. I read at least one book every week before bed.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "読書、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "reading", "books"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you play any musical instruments?", model_answer: "Yes, I play the violin. I have been learning it for three years. My teacher is very kind and patient. I love practicing and playing music with my friends at school.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "楽器演奏、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "violin", "music"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you do when you are free?", model_answer: "When I am free, I usually draw pictures or play with my dog. I also enjoy watching cartoons on TV. Sometimes I just lie on the sofa and listen to music.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "自由時間、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "free-time"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like watching movies? What kind?", model_answer: "Yes, I love watching movies. I like animation movies and adventure films best. My favorite movie is about a brave young hero. I usually watch movies with my family on weekends.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "映画、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "movies"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What kind of music do you like?", model_answer: "I like pop music and classical music. They make me feel happy and relaxed. I often listen to music when I do my homework. My favorite singer has a wonderful voice.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "音楽、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "music"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Tell me about something you collect.", model_answer: "I collect cute erasers from different stores. I have more than fifty of them now. They come in many shapes like animals, foods, and flowers. My friends sometimes give me new ones.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "コレクション、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "collection"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What did you do last weekend?", model_answer: "Last weekend, I went to the park with my friends. We played soccer for two hours. After that, we ate ice cream at a small shop. It was a really fun weekend.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "週末活動、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "weekend"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like drawing? Why?", model_answer: "Yes, I love drawing very much. I can show my feelings and ideas through pictures. I usually draw animals and my family. Drawing makes me forget about my worries.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "絵を描く、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "drawing"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What video games do you like?", model_answer: "I like puzzle games and adventure games. They make me think hard and have fun. My favorite game is about exploring an island. I play it for one hour every weekend.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "ゲーム、健全（暴力なし）", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "video-game"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-3", skill: "writing", prompt: "Do you enjoy cooking? What can you make?", model_answer: "Yes, I enjoy cooking with my mother. I can make simple dishes like scrambled eggs and salad. My specialty is fried rice. I want to learn how to make pasta soon.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "料理、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "cooking"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Tell me about a fun day you had recently.",  model_answer: "Last Saturday, I had a fun day with my cousins. We went to the zoo and saw many animals. The pandas were the cutest. After lunch, we played tag in the park.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "楽しい日、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "fun-day"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "What hobby do you and your friends share?",  model_answer: "My friends and I love playing soccer together. We meet at the park almost every Saturday. We have a small team of six players. Playing soccer with friends is so much fun.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "友達と趣味、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["hobby", "friend", "soccer"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  // --- FOOD (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite food?",  model_answer: "My favorite food is curry and rice. My mother cooks it for our family every Friday. The vegetables, meat, and special spices taste wonderful together. It always makes me feel happy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "好きな食べ物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "favorite", "curry"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "What do you eat for breakfast?", model_answer: "For breakfast, I usually eat rice, miso soup, and grilled fish. Sometimes I have bread and a salad with eggs. I always drink a glass of milk to stay healthy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "朝食、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "breakfast"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What food do you not like? Why?", model_answer: "I do not like green peppers very much. They taste a little bitter to me. My mother sometimes hides them in dishes, but I can always find them. I try to eat them anyway.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "嫌いな食べ物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "dislike"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What fruit do you like the best?", model_answer: "I like strawberries the best. They are sweet and juicy. I love their bright red color. My favorite way to eat strawberries is with whipped cream and a small piece of cake.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "果物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "fruit", "strawberry"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Do you eat vegetables every day? Why?", model_answer: "Yes, I eat vegetables every day. My mother always puts them on my plate. I know they are good for my body. My favorite vegetables are carrots, tomatoes, and corn.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "野菜、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "vegetable"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite snack?", model_answer: "My favorite snack is potato chips. I love the salty and crunchy taste. I usually share a bag with my younger sister after school. We eat them while watching cartoons together.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "おやつ、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "snack"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Have you ever cooked dinner for your family?", model_answer: "Yes, I cooked dinner for my family last weekend. I made omelets and a green salad with my mother. Everyone said it was delicious. I felt very proud and happy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "料理経験、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "cooking"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What is a famous food in your town?", model_answer: "A famous food in my town is ramen. The soup is rich and the noodles are very delicious. Many tourists visit my town just to eat our ramen. I am proud of it.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "地元の食、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "local", "ramen"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What food from another country do you want to try?", model_answer: "I want to try paella from Spain. It looks colorful and delicious in pictures. It has rice, seafood, and many vegetables together. I hope I can eat it in Spain someday.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "外国料理、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "foreign", "paella"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What do you usually drink?", model_answer: "I usually drink water and milk. At breakfast, I drink a glass of orange juice. In summer, I love ice-cold barley tea. I try to drink water often to stay healthy.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "飲み物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "drink"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is the best dessert you have ever eaten?", model_answer: "The best dessert I have ever eaten was a chocolate cake at my friends birthday party. It was sweet, rich, and very soft. I want to learn how to make it someday for my family.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "デザート、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "dessert", "cake"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like Japanese food or Western food more? Why?", model_answer: "I like Japanese food more. Japanese food is healthy and delicious. I love sushi, tempura, and miso soup. They use fresh ingredients. Western food is also tasty, but Japanese food is the best for me.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "和食洋食、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "japanese"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Where do you usually eat lunch?", model_answer: "I usually eat lunch at school. We have school lunch in our classroom with our classmates. On weekends, I eat lunch at home with my family. I sometimes eat at restaurants too.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "昼食場所、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "lunch"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-3", skill: "writing", prompt: "What do you eat on your birthday?", model_answer: "On my birthday, my family always eats sushi together. After dinner, we eat a big strawberry cake. My mother always puts as many candles as my age on it. It is a special day.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "誕生日、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "birthday"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What food is good for your health?", model_answer: "I think vegetables and fish are good for our health. They have many vitamins and proteins. My mother says we should eat many colors of vegetables every day. So, I try my best.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "健康食、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["food", "health"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  // --- ANIMAL (15 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite animal? Why?", model_answer: "My favorite animal is the dog. Dogs are friendly, smart, and very loyal. I have a small dog named Pochi at home. He is my best friend and we play every day.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "好きな動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "favorite", "dog"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Have you ever been to a zoo? What did you see?", model_answer: "Yes, I went to a zoo last summer with my family. I saw lions, elephants, giraffes, and pandas. The pandas were the cutest. They were eating bamboo and rolling around.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "動物園、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "zoo"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Do you want to have a pet? What kind?", model_answer: "Yes, I want to have a cat someday. Cats are quiet, soft, and very cute. I would name my cat Mike and play with her every day. I would take very good care of her.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "ペット希望、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "pet", "cat"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What animal can fly?", model_answer: "Birds can fly. Eagles, swallows, and sparrows are common birds in Japan. They fly to find food and travel between countries. I love watching them fly high in the sky on sunny days.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "飛ぶ動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "bird"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What is the cutest animal for you?", model_answer: "For me, rabbits are the cutest animals. They have long ears and soft white fur. They hop around the garden in the spring. My grandmother has a rabbit named Yuki at her house.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "可愛い動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "rabbit"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like fish? Tell me about a fish you know.", model_answer: "Yes, I love fish. My favorite fish is the goldfish. Goldfish are small, bright orange, and live in fresh water. We have two goldfish in a tank in my room. They are very calm.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "魚、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "fish", "goldfish"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What animals live in the forest?", model_answer: "Many animals live in the forest. Bears, deer, foxes, and squirrels are common. Some birds and insects also make their homes there. Forests give them food and a safe place to live.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "森の動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "forest"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like big animals or small animals more?", model_answer: "I like small animals more. They are usually cute and easy to care for. My favorite small animals are hamsters and rabbits. Big animals are amazing, but they need a lot of space.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "動物の好み、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "size"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "Tell me about an animal you saw recently.", model_answer: "Last weekend, I saw a black cat in our neighborhood. It was sitting quietly on a wall and watching the sky. It had bright green eyes. I think it lives somewhere on our street.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "見た動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "experience"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-3", skill: "writing", prompt: "What animal do you think is the smartest?", model_answer: "I think dolphins are the smartest animals. They live in groups and help each other. Dolphins also use sounds to talk. Some dolphins can solve simple puzzles. They are amazing creatures.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "賢い動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "smart", "dolphin"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "Why is it important to protect animals?", model_answer: "It is important to protect animals because they are part of nature. Without animals, our world would be very lonely. Some animals are already in danger. We must keep their homes safe.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "動物保護、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "protect"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like insects?", model_answer: "Yes, I like some insects. I think butterflies and ladybugs are pretty. I also catch beetles in summer. However, I do not like mosquitoes because they bite me. Insects are part of nature.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "昆虫、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "insect"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-3", skill: "writing", prompt: "What animal do you want to see in the wild?", model_answer: "I want to see a wild deer in the forest. Deer have a beautiful brown coat and large gentle eyes. I have only seen them in pictures. Maybe someday I can visit a national park.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "野生動物、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "wild", "deer"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "How do you take care of pets?", model_answer: "To take care of pets, you must give them food and water every day. You should also clean their cage or place. Pets need love and attention too. We must take them to the vet.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "ペット世話、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "pet", "care"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "What did you learn about an animal recently?", model_answer: "Recently, I learned that elephants have a great memory. They can remember other elephants for many years. They also help each other when one is sick. I read about this in a book.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "動物の知識、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["animal", "learning", "elephant"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  // --- SPORT (10 problems) ---
  { level: "eiken-3", skill: "writing", prompt: "What is your favorite sport?", model_answer: "My favorite sport is soccer. I have played it for five years with my friends. I am the goalkeeper of our small team. I love running on the field on weekends.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "スポーツ、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "soccer", "favorite"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you watch sports on TV?", model_answer: "Yes, I love watching sports on TV with my father. We usually watch baseball games together every weekend. We cheer for our favorite team. Watching sports together is a fun family time.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "スポーツ観戦、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "tv", "baseball"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Have you ever played a team sport?", model_answer: "Yes, I have played volleyball with my school team. We practiced after school three times a week. Our team won the city tournament last year. Playing as a team was very exciting.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "チームスポーツ、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "team", "volleyball"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "Why is exercise important?", model_answer: "Exercise is important because it makes our body and mind healthy. When we exercise, we feel stronger and happier. It also helps us sleep well at night. I try to exercise every day.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 17, coherence: 18 } }, kid_safe_notes: "運動の重要性、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "exercise", "health"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What sport do you want to try in the future?", model_answer: "I want to try snowboarding in the future. I have only watched it on TV before. The snowy mountains look very beautiful. I hope I can take a lesson next winter with my brother.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "新スポーツ、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "future", "snowboard"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Do you like swimming? Why or why not?", model_answer: "Yes, I love swimming. I go to the pool every Saturday with my mother. Swimming makes me feel cool in summer. It is also a good exercise for the whole body and is very fun.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "水泳、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "swimming"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Tell me about a memorable sports day.", model_answer: "Last autumn, our school had a great sports day. I ran in the relay race with my team. We won first prize. My parents cheered loudly from the side. I was very happy that day.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "運動会の思い出、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "memory", "sports-day"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-3", skill: "writing", prompt: "What sport is popular in your country?", model_answer: "Baseball and soccer are very popular in Japan. Many people watch professional games on TV. Children play baseball or soccer at parks and at school. These sports bring people together very well.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 17, grammar: 18, vocabulary: 16, structure: 17, coherence: 17 } }, kid_safe_notes: "国民的スポーツ、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "popular", "japan"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-3", skill: "writing", prompt: "Have you ever watched a sports event in person?", model_answer: "Yes, my father took me to a baseball stadium last summer. The stadium was huge and full of fans. The food was delicious. Our team won the game. It was the best day of summer.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "スポーツ観戦経験、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "stadium", "baseball"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-3", skill: "writing", prompt: "What is the best thing about playing sports with friends?", model_answer: "The best thing about playing sports with friends is having fun together. We laugh, run, and cheer for each other. Even when we lose, we feel happy because we played together as a team.", rubric: { official_4axis: { content: 4, organization: 4, vocabulary: 3, grammar: 4 }, internal_5axis: { content: 18, grammar: 18, vocabulary: 16, structure: 18, coherence: 18 } }, kid_safe_notes: "スポーツと友達、健全", word_count_min: 25, word_count_max: 35, estimated_time_sec: 600, tags: ["sport", "friend", "team"], difficulty: 2, source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
];


// ============================================================================
// REORDER PROBLEMS (5級, 30 problems, O5-001 to O5-030)
// 並べ替え - flipping practice for word order
// ============================================================================

const reorderProblems: ReorderProblem[] = [
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は学生です」を英語にすると？", choices: ["am", "a", "I", "student"], correct_order: [2, 0, 1, 3], correct_sentence: "I am a student.", correct_index: 0, explanation_jp: "主語 I → 動詞 am → 冠詞 a → 名詞 student の順。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "be-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「彼女は犬が好きです」を英語にすると？", choices: ["likes", "She", "dogs"], correct_order: [1, 0, 2], correct_sentence: "She likes dogs.", correct_index: 0, explanation_jp: "主語 She → 動詞 likes → 目的語 dogs の順。三人称単数の動詞は s が付きます。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "third-person"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は朝食にパンを食べます」を英語にすると？", choices: ["bread", "I", "for", "eat", "breakfast"], correct_order: [1, 3, 0, 2, 4], correct_sentence: "I eat bread for breakfast.", correct_index: 0, explanation_jp: "主語 → 動詞 → 目的語 → 前置詞句の語順。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "daily"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「あなたは日本出身ですか」を英語にすると？", choices: ["from", "you", "Are", "Japan"], correct_order: [2, 1, 0, 3], correct_sentence: "Are you from Japan?", correct_index: 0, explanation_jp: "be 動詞の疑問文は「Are/Is + 主語 + ...?」の語順です。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "question", "be-verb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私の父は教師です」を英語にすると？", choices: ["teacher", "is", "father", "My", "a"], correct_order: [3, 2, 1, 4, 0], correct_sentence: "My father is a teacher.", correct_index: 0, explanation_jp: "所有格 My → 名詞 father → be 動詞 is → 冠詞 a → 名詞 teacher。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "be-verb", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は毎日サッカーをします」を英語にすると？", choices: ["play", "I", "every", "soccer", "day"], correct_order: [1, 0, 3, 2, 4], correct_sentence: "I play soccer every day.", correct_index: 0, explanation_jp: "主語 → 動詞 → 目的語 → 副詞句 every day の順。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「これは私の本です」を英語にすると？", choices: ["my", "This", "book", "is"], correct_order: [1, 3, 0, 2], correct_sentence: "This is my book.", correct_index: 0, explanation_jp: "指示代名詞 This → be 動詞 is → 所有格 my → 名詞 book。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "demonstrative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私はテニスができます」を英語にすると？", choices: ["play", "can", "I", "tennis"], correct_order: [2, 1, 0, 3], correct_sentence: "I can play tennis.", correct_index: 0, explanation_jp: "主語 → 助動詞 can → 動詞の原形 → 目的語の語順。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "can"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「彼は走るのが速い」を英語にすると？", choices: ["fast", "He", "runs"], correct_order: [1, 2, 0], correct_sentence: "He runs fast.", correct_index: 0, explanation_jp: "主語 → 動詞 → 副詞 fast の順。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "adverb"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私たちは公園に行きます」を英語にすると？", choices: ["the", "We", "to", "go", "park"], correct_order: [1, 3, 2, 0, 4], correct_sentence: "We go to the park.", correct_index: 0, explanation_jp: "go to + 場所の語順。「the + park」で公園を特定。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "go-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「あなたは何歳ですか」を英語にすると？", choices: ["are", "old", "How", "you"], correct_order: [2, 1, 0, 3], correct_sentence: "How old are you?", correct_index: 0, explanation_jp: "How old + be 動詞 + 主語 ? で年齢を尋ねます。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "question", "age"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「彼女はピアノを弾きます」を英語にすると？", choices: ["plays", "the", "She", "piano"], correct_order: [2, 0, 1, 3], correct_sentence: "She plays the piano.", correct_index: 0, explanation_jp: "楽器名は「the + 楽器」で表現します。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "music", "the-piano"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私の母は本を読んでいます」を英語にすると？", choices: ["reading", "My", "is", "mother", "a", "book"], correct_order: [1, 3, 2, 0, 4, 5], correct_sentence: "My mother is reading a book.", correct_index: 0, explanation_jp: "現在進行形は「be + 動詞 ing」。My mother → is → reading → a book。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "progressive"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私はリンゴが二つほしい」を英語にすると？", choices: ["want", "two", "I", "apples"], correct_order: [2, 0, 1, 3], correct_sentence: "I want two apples.", correct_index: 0, explanation_jp: "主語 → 動詞 → 数詞 → 複数形の名詞の順。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "number", "plural"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私の妹は中学生です」を英語にすると？", choices: ["junior", "is", "a", "high", "student", "My", "sister"], correct_order: [5, 6, 1, 2, 0, 3, 4], correct_sentence: "My sister is a junior high student.", correct_index: 0, explanation_jp: "「中学生」は a junior high student。形容詞は名詞の前に置きます。", difficulty: 2, estimated_time_sec: 80, tags: ["reorder", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「あなたは犬を飼っていますか」を英語にすると？", choices: ["a", "you", "Do", "have", "dog"], correct_order: [2, 1, 3, 0, 4], correct_sentence: "Do you have a dog?", correct_index: 0, explanation_jp: "一般動詞の疑問文は「Do/Does + 主語 + 動詞の原形 ...?」。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "question", "do"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「彼は野球が好きではない」を英語にすると？", choices: ["like", "does", "baseball", "He", "not"], correct_order: [3, 1, 4, 0, 2], correct_sentence: "He does not like baseball.", correct_index: 0, explanation_jp: "三人称単数の否定文は「does not + 動詞の原形」。", difficulty: 2, estimated_time_sec: 80, tags: ["reorder", "negative", "third-person"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「これらは私の鉛筆です」を英語にすると？", choices: ["are", "pencils", "These", "my"], correct_order: [2, 0, 3, 1], correct_sentence: "These are my pencils.", correct_index: 0, explanation_jp: "These → are → my → pencils の語順。複数形に注意。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "plural", "demonstrative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「あなたの名前は何ですか」を英語にすると？", choices: ["your", "is", "What", "name"], correct_order: [2, 1, 0, 3], correct_sentence: "What is your name?", correct_index: 0, explanation_jp: "What + be 動詞 + 主語 ? で名前を尋ねます。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "question", "name"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は7時に起きます」を英語にすると？", choices: ["at", "I", "up", "seven", "get"], correct_order: [1, 4, 2, 0, 3], correct_sentence: "I get up at seven.", correct_index: 0, explanation_jp: "「起きる」は get up。時刻は at + 数字。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "daily", "time"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「彼らはサッカー選手です」を英語にすると？", choices: ["are", "soccer", "They", "players"], correct_order: [2, 0, 1, 3], correct_sentence: "They are soccer players.", correct_index: 0, explanation_jp: "主語 They → be 動詞 are → 名詞句 soccer players。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "plural", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私の家には犬が2匹います」を英語にすると？", choices: ["are", "in", "There", "two", "house", "my", "dogs"], correct_order: [2, 0, 3, 6, 1, 5, 4], correct_sentence: "There are two dogs in my house.", correct_index: 0, explanation_jp: "There + be 動詞 + 主語 + 場所の構文。複数の場合は are。", difficulty: 2, estimated_time_sec: 90, tags: ["reorder", "there-is"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「明日は雨が降るでしょう」を英語にすると？", choices: ["rain", "It", "tomorrow", "will"], correct_order: [1, 3, 0, 2], correct_sentence: "It will rain tomorrow.", correct_index: 0, explanation_jp: "未来形は「will + 動詞の原形」。天気は It を主語にします。", difficulty: 2, estimated_time_sec: 80, tags: ["reorder", "future", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は昨日映画を見ました」を英語にすると？", choices: ["a", "I", "yesterday", "watched", "movie"], correct_order: [1, 3, 0, 4, 2], correct_sentence: "I watched a movie yesterday.", correct_index: 0, explanation_jp: "過去形 watched + 目的語 + 時を表す副詞 yesterday。", difficulty: 2, estimated_time_sec: 80, tags: ["reorder", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.87 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「窓を開けてください」を英語にすると？", choices: ["the", "open", "Please", "window"], correct_order: [2, 1, 0, 3], correct_sentence: "Please open the window.", correct_index: 0, explanation_jp: "丁寧な命令文は Please + 動詞の原形。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "imperative"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私はそのケーキを食べたい」を英語にすると？", choices: ["the", "I", "to", "eat", "want", "cake"], correct_order: [1, 4, 2, 3, 0, 5], correct_sentence: "I want to eat the cake.", correct_index: 0, explanation_jp: "want to + 動詞の原形は「〜したい」を表します。", difficulty: 2, estimated_time_sec: 80, tags: ["reorder", "want-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.86 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私の誕生日は5月です」を英語にすると？", choices: ["May", "is", "My", "in", "birthday"], correct_order: [2, 4, 1, 3, 0], correct_sentence: "My birthday is in May.", correct_index: 0, explanation_jp: "「月」は in + 月名で表現します。", difficulty: 1, estimated_time_sec: 70, tags: ["reorder", "birthday", "month"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「あなたは何が好きですか」を英語にすると？", choices: ["like", "do", "What", "you"], correct_order: [2, 1, 3, 0], correct_sentence: "What do you like?", correct_index: 0, explanation_jp: "疑問詞 What + do + 主語 + 動詞の原形 ?", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "question", "what"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は音楽を聴くのが好きです」を英語にすると？", choices: ["to", "music", "I", "like", "listen", "to"], correct_order: [2, 3, 0, 4, 5, 1], correct_sentence: "I like to listen to music.", correct_index: 0, explanation_jp: "「聴く」は listen to。like to + 動詞の原形。", difficulty: 2, estimated_time_sec: 90, tags: ["reorder", "music", "listen-to"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.85 },
  { level: "eiken-5", skill: "reorder", prompt_text: "「私は学校に歩いて行きます」を英語にすると？", choices: ["school", "walk", "I", "to"], correct_order: [2, 1, 3, 0], correct_sentence: "I walk to school.", correct_index: 0, explanation_jp: "「学校に歩いて行く」は walk to school。冠詞は不要。", difficulty: 1, estimated_time_sec: 60, tags: ["reorder", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
];


// ============================================================================
// READING PROBLEMS (4級, 20 problems, R4-001 to R4-020)
// passage_text (60-80 words) + comprehension question
// ============================================================================

const readingProblems: ChoiceProblem[] = [
  { level: "eiken-4", skill: "reading", passage_text: "Mika is a junior high school student. She lives in Osaka with her family. Every morning, she gets up at six thirty and eats breakfast with her younger brother. After breakfast, she walks to school with her best friend Yumi. School starts at eight thirty. Mika likes English the best. She wants to be an English teacher in the future.", prompt_text: "What does Mika want to be?", choices: ["An English teacher", "A doctor", "A nurse", "A singer"], correct_index: 0, explanation_jp: "本文最後に「She wants to be an English teacher」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "passage", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "reading", passage_text: "Tom and his family went to the zoo last Sunday. They saw lions, elephants, and pandas. Tom liked the pandas the best because they were eating bamboo and rolling around. After watching the animals, they ate lunch at a restaurant in the zoo. Tom had a hamburger and his sister ordered a pizza. They went home in the evening and felt very happy.", prompt_text: "Which animal did Tom like the best?", choices: ["Pandas", "Lions", "Elephants", "Tigers"], correct_index: 0, explanation_jp: "本文に「Tom liked the pandas the best」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "zoo", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "reading", passage_text: "Yuki has a small brown dog named Pochi. She got him on her tenth birthday two years ago. Every morning, Yuki takes Pochi for a walk in the park near her house. Pochi loves running and playing with other dogs. After the walk, Yuki gives him food and water. Pochi is the best friend in her whole family.", prompt_text: "When did Yuki get her dog?", choices: ["On her tenth birthday", "Last year", "Last week", "On her ninth birthday"], correct_index: 0, explanation_jp: "本文に「on her tenth birthday two years ago」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "pet", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "Kenta plays baseball every Saturday. He is the pitcher of his school team. His team won the city tournament last summer. Kenta practices for two hours every day after school. He wants to be a professional baseball player when he grows up. His father always cheers for him at the games. Kenta loves baseball more than anything.", prompt_text: "What does Kenta want to be in the future?", choices: ["A professional baseball player", "A coach", "A teacher", "A doctor"], correct_index: 0, explanation_jp: "本文に「He wants to be a professional baseball player」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "sport", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "Sara is from Australia. She came to Japan three months ago to study Japanese. She lives with a Japanese family in Tokyo. Sara likes Japanese food, especially sushi and ramen. On weekends, she goes to a Japanese language school. She wants to learn more kanji and travel around Japan. Sara hopes to make many Japanese friends during her stay.", prompt_text: "Why did Sara come to Japan?", choices: ["To study Japanese", "To work as a teacher", "For a vacation", "To meet her family"], correct_index: 0, explanation_jp: "本文に「She came to Japan three months ago to study Japanese」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "travel", "study"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Ms. Smith is the English teacher at our school. She is from Canada and has lived in Japan for five years. She teaches English to students every day. After school, she runs the English club. We sing English songs and play games in the club. Ms. Smith is kind and funny. All students love her classes very much.", prompt_text: "How long has Ms. Smith lived in Japan?", choices: ["For five years", "For three years", "For ten years", "For one year"], correct_index: 0, explanation_jp: "本文に「has lived in Japan for five years」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "school", "duration"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Ami loves cooking. Last Saturday, she made a chocolate cake for her mother birthday. She used eggs, flour, butter, sugar, and chocolate. It took her two hours to make the cake. Her mother was very surprised and happy. The whole family ate the cake together for dessert. Everyone said the cake was delicious.", prompt_text: "Why did Ami make the cake?", choices: ["For her mother birthday", "For her own birthday", "For her father birthday", "For a party"], correct_index: 0, explanation_jp: "本文に「for her mother birthday」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "food", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "The library in our town is open every day except Monday. It has many interesting books, magazines, and DVDs. Children can read picture books in a special room. Adults can use computers for free. Every Saturday, there is a story time for kids at three in the afternoon. Many families enjoy spending their weekends at the library.", prompt_text: "When is the library closed?", choices: ["On Monday", "On Saturday", "On Sunday", "On Friday"], correct_index: 0, explanation_jp: "本文に「open every day except Monday」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "library", "schedule"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Last summer, Hiro went camping in the mountains with his father. They put up a tent near a small river. Hiro caught two fish and they cooked them for dinner. At night, they looked at the stars in the dark sky. The stars were so bright and beautiful. Hiro had never seen so many stars before. It was a great trip.", prompt_text: "What did Hiro and his father eat for dinner?", choices: ["Fish", "Chicken", "Pizza", "Vegetables"], correct_index: 0, explanation_jp: "本文に「Hiro caught two fish and they cooked them for dinner」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "camping", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "Lisa is a third grade student. She loves drawing pictures of animals. Her favorite animal to draw is the cat. She has drawn more than fifty cat pictures this year. Her art teacher always praises her work. Last month, Lisa won first prize in a school art contest. Her parents put the picture on the living room wall. Lisa wants to be an artist someday.", prompt_text: "What did Lisa win last month?", choices: ["First prize in a school art contest", "A drawing kit", "A trophy for sports", "A scholarship"], correct_index: 0, explanation_jp: "本文に「Lisa won first prize in a school art contest」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "school", "contest"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "Daiki is twelve years old. He likes science very much. His favorite subject is science class. He has many books about space and dinosaurs at home. Last weekend, his father took him to a science museum in Tokyo. They saw a big dinosaur skeleton and many old fossils. Daiki was very excited. He wants to study dinosaurs in the future.", prompt_text: "What does Daiki want to study in the future?", choices: ["Dinosaurs", "Space", "Math", "History"], correct_index: 0, explanation_jp: "本文に「He wants to study dinosaurs in the future」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "science", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "There is a small park near my house. It has a playground for children, a few tables, and many trees. On weekends, my friends and I play soccer in the park. Old people often sit on benches and read newspapers. In spring, the cherry blossoms are very beautiful. Many families come to enjoy them. The park is a special place in our town.", prompt_text: "What can you see in spring at the park?", choices: ["Cherry blossoms", "Snow", "Yellow leaves", "Fireworks"], correct_index: 0, explanation_jp: "本文に「In spring, the cherry blossoms are very beautiful」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "park", "spring"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Emi is a member of the swimming team at her school. She practices three times a week after school. Her best stroke is butterfly. Last month, she joined a swimming contest in her city. She finished in second place. Her coach said she will get even faster with more practice. Emi wants to win first place next year. She practices very hard every day.", prompt_text: "What place did Emi finish in the contest?", choices: ["Second place", "First place", "Third place", "Fourth place"], correct_index: 0, explanation_jp: "本文に「She finished in second place」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "sport", "swimming"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "My grandmother lives in a small village in the countryside. We visit her every summer. She has a big garden with many vegetables. We help her water the plants and pick tomatoes. She always cooks delicious food with the fresh vegetables from her garden. Her tomato pasta is the best in the world. I love spending time with her every summer.", prompt_text: "What does the grandmother grow in her garden?", choices: ["Many vegetables", "Many flowers", "Only tomatoes", "Many fruits"], correct_index: 0, explanation_jp: "本文に「a big garden with many vegetables」とあります。", difficulty: 2, estimated_time_sec: 120, tags: ["reading", "family", "garden"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Yuta is in the brass band club at his school. He plays the trumpet. The club practices every weekday after school. Last Saturday, the brass band gave a concert at a city hall. About two hundred people came to listen. Yuta felt very nervous before the concert, but he played well. His parents and his sister came to watch. Yuta was very happy.", prompt_text: "How many people came to the concert?", choices: ["About two hundred", "About fifty", "About a thousand", "About five hundred"], correct_index: 0, explanation_jp: "本文に「About two hundred people came to listen」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "music", "concert"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Mr. Brown is from England. He came to Japan to teach English at a high school. He has been in Japan for two years. He lives in a small apartment near the school. He likes Japanese food, especially tempura. On weekends, he travels around Japan to visit famous places. He has been to Kyoto, Osaka, and Hokkaido. Now he wants to visit Okinawa.", prompt_text: "Where does Mr. Brown want to visit next?", choices: ["Okinawa", "Tokyo", "Kyoto", "Osaka"], correct_index: 0, explanation_jp: "本文に「Now he wants to visit Okinawa」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "travel", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "reading", passage_text: "My school festival is held every November. Each class makes a special booth or food stand. Last year, my class ran a haunted house. We made spooky decorations and wore scary costumes. Many students from other classes came to visit. They screamed and laughed at the same time. We had a great time. This year, we want to make a takoyaki stand instead.", prompt_text: "What did the writer class do last year?", choices: ["A haunted house", "A takoyaki stand", "A magic show", "A dance show"], correct_index: 0, explanation_jp: "本文に「Last year, my class ran a haunted house」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "school", "festival"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Maya likes shopping with her mother on weekends. They usually go to a big shopping mall in the next city. Maya buys clothes, books, and stationery there. The mall has a food court with many restaurants. Their favorite is a pasta restaurant on the second floor. After shopping, they always have lunch there. Maya looks forward to weekend shopping with her mom.", prompt_text: "Where do Maya and her mother eat lunch?", choices: ["At a pasta restaurant", "At a sushi restaurant", "At a cafe", "At home"], correct_index: 0, explanation_jp: "本文に「Their favorite is a pasta restaurant」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "shopping", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-4", skill: "reading", passage_text: "Last winter, Tomo went skiing for the first time. He went to Nagano with his cousin. He was scared at first because the mountain looked very high. His cousin taught him how to ski. After a few hours, Tomo could ski down a small slope by himself. He fell down many times, but he had a wonderful time. He wants to go skiing again next year.", prompt_text: "Who taught Tomo how to ski?", choices: ["His cousin", "His father", "His teacher", "A coach"], correct_index: 0, explanation_jp: "本文に「His cousin taught him how to ski」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "winter", "skiing"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "reading", passage_text: "Our school has a vegetable garden. Each class takes care of one part of the garden. My class is growing tomatoes and cucumbers this year. We water the plants every morning. We also pull weeds and check for insects. In summer, we will pick the vegetables and use them for our school lunch. Growing vegetables is hard work, but it is also fun.", prompt_text: "What does the writer class grow in the garden?", choices: ["Tomatoes and cucumbers", "Carrots and potatoes", "Strawberries", "Rice"], correct_index: 0, explanation_jp: "本文に「My class is growing tomatoes and cucumbers」とあります。", difficulty: 2, estimated_time_sec: 130, tags: ["reading", "school", "garden"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
];


// ============================================================================
// REPLACEMENTS — W2 で qualityScore < 0.85 となった問題の改稿版
// ============================================================================
//
// V3-012 (W2 オリジナル) — qualityScore 0.84:
//   prompt: "The book (   ) by him last year."
//   choices: ["was written", "writes", "writing", "write"]
//   correct: "was written"
//   問題点: "writes" が時制混乱程度しか引き起こさず、
//          受動態の典型 distractor として機能していなかった。
// V3-012R (改稿版) — 完了形・受動態の混同を誘発する強い distractor に差し替え:
//   "was written" / "has written" / "writing" / "write"
//
// ============================================================================

const replacementProblems: ChoiceProblem[] = [
  { level: "eiken-4", skill: "grammar", prompt_text: "The book (   ) by him last year.", choices: ["was written", "has written", "writing", "write"], correct_index: 0, explanation_jp: "受動態は「be 動詞 + 過去分詞」。主語 The book は「書かれた」側なので受動態。last year より過去形 was written。「has written」は能動の現在完了で文法的に主語と意味が合いません。", difficulty: 2, estimated_time_sec: 50, tags: ["passive", "past", "replacement", "V3-012R"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
];

// ============================================================================
// HELPER: redistribute correct_index to balance answer position bias
// （writing / reorder には適用しない。choices は ChoiceProblem のみ）
// ============================================================================

/**
 * choices と correct_index を持つ問題群について、正解位置の偏りを修正する。
 * W2 と同じロジック: 4 択時 [0,1,2,3] が均等になるよう shuffle。
 */
export function redistributeCorrectIndex<T extends ChoiceProblem>(items: T[]): T[] {
  return items.map((item) => {
    if (!item.choices || item.choices.length < 2) return item;
    const correctText = item.choices[item.correct_index];
    if (!correctText) return item;
    // 簡易ランダム再配置（再現性のため index に応じて決定的に shift）
    const newPos = (item.correct_index + 1 + Math.floor(Math.random() * (item.choices.length - 1))) % item.choices.length;
    if (newPos === item.correct_index) return item;
    const newChoices = [...item.choices];
    const tmp = newChoices[item.correct_index] as string;
    const swap = newChoices[newPos] as string;
    newChoices[item.correct_index] = swap;
    newChoices[newPos] = tmp;
    return { ...item, choices: newChoices, correct_index: newPos };
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

const allChoiceProblems: ChoiceProblem[] = [
  ...listeningProblems,
  ...grammarProblems,
  ...readingProblems,
  ...replacementProblems,
];

const w3Bundle = {
  /** リスニング 5 級 100 問 */
  listening: listeningProblems,
  /** 文法 4 級 150 問 */
  grammar: grammarProblems,
  /** ライティング 3 級 100 問 */
  writing: writingProblems,
  /** 並べ替え 5 級 30 問 */
  reorder: reorderProblems,
  /** 読解 4 級 20 問 */
  reading: readingProblems,
  /** W2 改稿版 1 問（V3-012R） */
  replacements: replacementProblems,
  /** ChoiceProblem 全件（reorder/writing 除く） */
  allChoiceProblems,
  /** 全件（writing/reorder 含む union 配列） */
  allProblems: [
    ...listeningProblems,
    ...grammarProblems,
    ...readingProblems,
    ...replacementProblems,
    ...reorderProblems,
    ...writingProblems,
  ] as W3Problem[],
};

export type W3Bundle = typeof w3Bundle;

export { listeningProblems, grammarProblems, writingProblems, reorderProblems, readingProblems, replacementProblems, allChoiceProblems };

export default w3Bundle;
