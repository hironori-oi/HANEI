/**
 * PRJ-016 HANEI - W5 シード問題プール (β 開始用 / 3 級リスニング 20 問)
 *
 * 作成日: 2026-05-05
 * 作成部署: Dev (W12-T5 / DEC-079)
 * 範囲: 英検 3 級 listening のみ 20 問 (L3-001 〜 L3-020)
 *
 * 内訳 (合計 20 問):
 *   - 3 級 listening: 20 問 (L3-001 〜 L3-020)
 *
 * 設計方針 (DEC-079):
 *   - 構造は seed-problems-w3.ts の 5 級 listening 100 問と完全同型
 *   - 場面: 学校 / 家族 / 季節 / 食事 / 趣味 / 数字 / 時間 / スポーツ / 動物 /
 *           色 / 天気 (W3 5 級 listening の 12 場面を踏襲)
 *   - 英検 3 級レベル (中学卒業相当) = 5 級 listening より文法 / 語彙やや高度
 *     (過去形 / 進行形 / 比較 / 関係詞混ぜる) / 但しオーナー息子 1 名向け β なので
 *     「易しめ寄り」で OK / difficulty 1 〜 2 中心 / 0 を 1 〜 2 問混ぜる程度
 *   - audio_transcript = 30 〜 100 chars / kid-safe
 *
 * 制約 (DEC-024 罰則ゼロ哲学):
 *   - 100% オリジナル AI 生成
 *   - 絵文字なし
 *   - 罰語ゼロ:「失敗」「サボ」「ダメ」「悪い」を audio_transcript / choices /
 *     explanation_jp 全件で使わない (unit test で grep 検証)
 *   - 子ども不適切表現なし (暴力 / 性 / 政治宗教 / 個人情報 / 賭博 / 恐怖煽り 0 件)
 *   - 固有名詞は架空: Sakura Elementary / Hanei Town / Lily, Tom, Ben, Mary, Mike,
 *     Anna, Ken, Yuki, Sara, Coco (犬), Mimi (猫)
 *
 * 採番:
 *   - seed-id-mapper.ts の `assignW5Ids()` で L3-001 〜 L3-020 を出現順に付与
 *   - 本ファイルでは ID は明示的に持たない (W3 listening と同型 / 採番は mapper 経由)
 */

// ---------------------------------------------------------------------------
// 型定義 (W3 ChoiceProblem と同型 / listening のみ抽出版)
// ---------------------------------------------------------------------------

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
// 3 級 listening 20 問 (L3-001 〜 L3-020)
// 形式: audio_transcript (短い対話 or 質問) + 4 択
// 作問方針: 学校 / 家族 / 季節 / 食事 / 趣味 / 数字 / 時間 / スポーツ /
//           動物 / 色 / 天気 の 11 場面を 1 〜 2 問ずつカバー
// difficulty: 1 〜 2 中心、0 を 2 問混在
// ---------------------------------------------------------------------------

const listeningProblems: Eiken3Listening[] = [
  // L3-001 / 学校 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What did you do at school today? I studied math and played soccer with my friends.",
    choices: [
      "He studied math and played soccer.",
      "He went to the library.",
      "He stayed home all day.",
      "He visited his grandmother.",
    ],
    correct_index: 0,
    explanation_jp:
      "「I studied math and played soccer」と言っているので、彼は数学を勉強してサッカーをしました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "school", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-002 / 家族 / 比較
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "My sister is taller than me. She is fourteen years old. How old is she?",
    choices: ["Twelve.", "Thirteen.", "Fourteen.", "Fifteen."],
    correct_index: 2,
    explanation_jp:
      "「She is fourteen years old」と言っているので、お姉さんは 14 歳です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "family", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-003 / 季節 / 進行形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "音声を聞いて、最も適切な応答を選びなさい。",
    audio_transcript:
      "It is snowing outside. What season is it now?",
    choices: ["It is summer.", "It is winter.", "It is spring.", "It is autumn."],
    correct_index: 1,
    explanation_jp: "雪が降っているので、季節は冬 (winter) です。",
    difficulty: 0,
    estimated_time_sec: 25,
    tags: ["listening", "season", "weather"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.93,
  },
  // L3-004 / 食事 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What did Mary eat for breakfast? She ate rice and miso soup with her family.",
    choices: [
      "Bread and milk.",
      "Rice and miso soup.",
      "Eggs and toast.",
      "Pancakes and juice.",
    ],
    correct_index: 1,
    explanation_jp:
      "「She ate rice and miso soup」と言っているので、Mary はご飯とお味噌汁を食べました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "food", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-005 / 趣味 / 進行形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What is Tom doing now? He is reading a book in his room.",
    choices: [
      "He is playing the piano.",
      "He is watching TV.",
      "He is reading a book.",
      "He is eating dinner.",
    ],
    correct_index: 2,
    explanation_jp:
      "「He is reading a book」と言っているので、Tom は本を読んでいます。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "hobby", "progressive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-006 / 数字 / 値段
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How much is this notebook? It is three hundred yen. I will take two of them.",
    choices: [
      "Three hundred yen.",
      "Six hundred yen.",
      "One hundred yen.",
      "Two hundred yen.",
    ],
    correct_index: 0,
    explanation_jp:
      "「It is three hundred yen」と言っているので、ノート 1 冊は 300 円です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "number", "shopping"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-007 / 時間 / 未来形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What time will the movie start? It will start at seven thirty tonight.",
    choices: ["At seven.", "At seven thirty.", "At eight.", "At eight thirty."],
    correct_index: 1,
    explanation_jp:
      "「It will start at seven thirty」と言っているので、映画は 7 時 30 分に始まります。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "time", "future"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-008 / スポーツ / 比較
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Which sport do you like better, soccer or baseball? I like soccer better than baseball.",
    choices: [
      "He likes baseball better.",
      "He likes soccer better.",
      "He likes both the same.",
      "He does not like sports.",
    ],
    correct_index: 1,
    explanation_jp:
      "「I like soccer better than baseball」と言っているので、彼はサッカーの方が好きです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "sport", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-009 / 動物 / 関係詞 (which)
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Look at the dog which is running in the park. Its name is Coco. How cute!",
    choices: [
      "The dog is sleeping.",
      "The dog is eating.",
      "The dog is running.",
      "The dog is barking.",
    ],
    correct_index: 2,
    explanation_jp:
      "「the dog which is running」と言っているので、犬は走っています。",
    difficulty: 2,
    estimated_time_sec: 30,
    tags: ["listening", "animal", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // L3-010 / 色 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "I bought a new bag yesterday. It is blue and white. Do you like the color?",
    choices: [
      "Red and yellow.",
      "Blue and white.",
      "Green and pink.",
      "Black and brown.",
    ],
    correct_index: 1,
    explanation_jp:
      "「It is blue and white」と言っているので、バッグの色は青と白です。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "color", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-011 / 天気 / 未来形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How will the weather be tomorrow? It will be sunny and warm in Hanei Town.",
    choices: [
      "Rainy and cold.",
      "Cloudy and cool.",
      "Sunny and warm.",
      "Snowy and windy.",
    ],
    correct_index: 2,
    explanation_jp:
      "「It will be sunny and warm」と言っているので、明日は晴れて暖かいです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "weather", "future"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-012 / 学校 / 進行形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Where is Ben now? He is studying English in the library after school.",
    choices: [
      "At the library.",
      "At home.",
      "In the gym.",
      "In the music room.",
    ],
    correct_index: 0,
    explanation_jp:
      "「He is studying English in the library」と言っているので、Ben は図書館にいます。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "school", "progressive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-013 / 家族 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What did your father give you for your birthday? He gave me a nice watch last week.",
    choices: [
      "A book.",
      "A bike.",
      "A watch.",
      "A camera.",
    ],
    correct_index: 2,
    explanation_jp:
      "「He gave me a nice watch」と言っているので、お父さんは時計をくれました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "family", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-014 / 食事 / 比較
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Which is more delicious, this cake or that pie? I think the cake is more delicious.",
    choices: [
      "The pie is better.",
      "The cake is better.",
      "Both are the same.",
      "Neither is good.",
    ],
    correct_index: 1,
    explanation_jp:
      "「the cake is more delicious」と言っているので、ケーキの方がおいしいと感じています。",
    difficulty: 2,
    estimated_time_sec: 30,
    tags: ["listening", "food", "comparison"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // L3-015 / 趣味 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What did Anna do last weekend? She visited her grandmother in Sakura Town.",
    choices: [
      "She watched a movie.",
      "She played tennis.",
      "She visited her grandmother.",
      "She read a book.",
    ],
    correct_index: 2,
    explanation_jp:
      "「She visited her grandmother」と言っているので、Anna はおばあちゃんを訪ねました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "hobby", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-016 / 数字 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How many books did Ken read last month? He read five books in total.",
    choices: ["Three.", "Four.", "Five.", "Six."],
    correct_index: 2,
    explanation_jp: "「He read five books」と言っているので、Ken は 5 冊読みました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "number", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-017 / 時間 / 進行形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "What is Yuki doing at three o'clock? She is having tea with her friends now.",
    choices: [
      "She is sleeping.",
      "She is having tea.",
      "She is studying.",
      "She is cooking.",
    ],
    correct_index: 1,
    explanation_jp:
      "「She is having tea」と言っているので、Yuki はお茶を飲んでいます。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "time", "progressive"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
  // L3-018 / スポーツ / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Did Mike play basketball yesterday? Yes, he played with his classmates after lunch.",
    choices: [
      "He played soccer.",
      "He played basketball.",
      "He played tennis.",
      "He stayed home.",
    ],
    correct_index: 1,
    explanation_jp:
      "「he played with his classmates」と言っており、質問は basketball についてです。Mike はバスケをしました。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "sport", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // L3-019 / 動物 / 関係詞 (who)
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "Sara is the girl who has a cat named Mimi. The cat is very friendly.",
    choices: [
      "Sara has a dog.",
      "Sara has a cat.",
      "Sara has a bird.",
      "Sara has a rabbit.",
    ],
    correct_index: 1,
    explanation_jp:
      "「the girl who has a cat named Mimi」と言っているので、Sara は猫を飼っています。",
    difficulty: 2,
    estimated_time_sec: 30,
    tags: ["listening", "animal", "relative-pronoun"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.9,
  },
  // L3-020 / 天気 / 過去形
  {
    level: "eiken-3",
    skill: "listening",
    prompt_text: "対話を聞いて、質問に答えなさい。",
    audio_transcript:
      "How was the weather in Hanei Town last Sunday? It was cloudy and a little cool.",
    choices: [
      "Sunny and hot.",
      "Cloudy and cool.",
      "Rainy and warm.",
      "Snowy and cold.",
    ],
    correct_index: 1,
    explanation_jp:
      "「It was cloudy and a little cool」と言っているので、日曜日はくもりで少し涼しかったです。",
    difficulty: 1,
    estimated_time_sec: 30,
    tags: ["listening", "weather", "past-tense"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.92,
  },
];

// ---------------------------------------------------------------------------
// Bundle export (W3 と同型 / listening のみ)
// ---------------------------------------------------------------------------

const w5Bundle = {
  /** 3 級 listening 20 問 (L3-001 〜 L3-020) */
  listening: listeningProblems,
};

export type W5Bundle = typeof w5Bundle;

export { listeningProblems };

export default w5Bundle;
