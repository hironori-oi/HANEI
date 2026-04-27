/**
 * PRJ-016 HANEI - W4 シード問題プール（第 3 陣 221 問 + G4-080 改稿）
 *
 * 作成日: 2026-04-26
 * 作成部署: Research（W4）
 * 範囲: 英検 5 級 / 4 級 / 3 級
 *
 * 内訳（合計 221 問 = W2 200 問 + W3 401 問 + W4 221 問 = 822 問体制）:
 *   - 5 級 vocab:     100 問（V5W4-001 〜 V5W4-100）— 既存と重複しない領域
 *   - 4 級 listening:  80 問（L4-001 〜 L4-080）— 短い対話 + 短いモノローグ
 *   - 3 級 reading:    40 問（R3-001 〜 R3-040）— passage 100〜150 語 + 設問
 *
 * 加えて W3 で 0.84 だった G4-080 系の改稿版を REPLACEMENTS セクションに配置:
 *   旧: I have read this book before. ＝ I (   ) read this book.
 *       choices: ["have already", "did", "have just", "had"]
 *       問題点: "have just" と "have already" の差が微妙で4級レベルでは判定困難。
 *   新版（G4-080R）: 文脈ヒントを追加し、distractor を時制混乱型に変更。
 *
 * フォーマット仕様:
 *   - リスニングは音声前提なので audioScript フィールド（読み上げ原稿）必須
 *   - 4 級リスニング対話は最大 2 名・最大 5 往復・10〜20 秒目安
 *   - リーディング 3 級は passage（150 語以下）+ questions 配列
 *
 * 制約:
 *   - 100% オリジナル AI 生成（過去問・市販教材を 1 文字も流用しない）
 *   - 絵文字なし
 *   - 子ども不適切表現なし（暴力 / 性 / 政治宗教 / 個人情報 / 賭博 / 恐怖煽り 0 件）
 *   - リーディング passage は kid-safe 7 ジャンル限定（school / family / season /
 *     animal / hobby / food / sport / travel）
 *   - 固有名詞は架空（W2/W3 と同じセット: Sakura Elementary / Hanei Town /
 *     Lily, Tom, Ben, Mary, Mike, Anna, Ken, Yuki, Sara, Coco（犬）, Mimi（猫））
 *
 * Self-judge:
 *   - 5 軸（answerCorrectness / distractorQuality / levelAlignment /
 *           originality / childSafety）各 0-20 点 → 0-100 → /100 で 0-1 表示
 *   - 閾値 0.85 / 全 221 問が 0.85 以上（再生成済）
 *
 * 連動:
 *   - research-w4-problems.md §3（Self-judge ヒストグラム）
 *   - research-w3-problems.md §7（W4 申し送り）
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type EikenLevel = "eiken-5" | "eiken-4" | "eiken-3";
type Skill = "vocab" | "grammar" | "listening" | "reading";

/** 4 択問題（ChoiceProblem）— W3 と互換 */
export type ChoiceProblem = {
  level: EikenLevel;
  skill: Skill;
  prompt_text: string;
  passage_text?: string;
  choices: string[];
  correct_index: number;
  explanation_jp: string;
  difficulty: 0 | 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  /** リスニング問題: 読み上げ原稿（必須）。W3 の audio_transcript の後継。*/
  audioScript?: string;
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  generated_quality_score: number;
};

/**
 * 3 級リーディング問題: passage（短文） + questions（設問配列）構造化型。
 * 1 つの passage に対し 2 問（設問形式）の構造を取る。
 */
export type ReadingPassageProblem = {
  level: "eiken-3";
  skill: "reading";
  passage: string;
  /** passage の語数（150 語以下） */
  word_count: number;
  /** kid-safe ジャンル */
  genre:
    | "school"
    | "family"
    | "season"
    | "animal"
    | "hobby"
    | "food"
    | "sport"
    | "travel";
  /** 1 つの passage に紐づく設問 2 問 */
  questions: Array<{
    question: string;
    choices: string[];
    correct_index: number;
    explanation_jp: string;
  }>;
  difficulty: 1 | 2;
  estimated_time_sec: number;
  tags: string[];
  source_license: "ORIGINAL_AI";
  copyright_safe: true;
  generated_quality_score: number;
};

export type W4Problem = ChoiceProblem | ReadingPassageProblem;

// ===========================================================================
// 5 級 vocabulary 100 問（V5W4-001 〜 V5W4-100）
// 重複回避: W2 の vocab 60 問（be 動詞 / 基本動詞 / 家族 / 学校 / 食べ物 / 動物 /
// 色 / 数字 / 曜日 / 月 / 季節 / 天気 / 体 / スポーツ）と重複しない領域:
//   - 動作動詞拡張（jump, dance, draw, watch, listen, help, wash, clean,
//     fly, ride, open, close, find, ask, answer, tell, show, buy, use,
//     learn, teach, start, finish, win, visit, move, climb, jump, throw,
//     catch, paint, build）30 問
//   - 副詞（often, sometimes, always, usually, never, here, there, now,
//     today, tomorrow, yesterday, early, late, fast, well）15 問
//   - 前置詞拡張（at, from, with, by, for, near, before, after, between,
//     over, behind, into, of）15 問
//   - 形容詞拡張（new, young, tall, short, long, easy, busy, free, tired,
//     hungry, sleepy, sick, clean, cute, cool, funny, strong, quiet,
//     popular, important, lucky, rainy, cloudy, snowy, full）25 問
//   - 名詞拡張（room: kitchen, bathroom, garden / vehicle: bus, train, bike,
//     plane / instrument: guitar, drum / school item: notebook, eraser,
//     ruler / time: morning, evening, night / place: park, station,
//     library, hospital, post-office）15 問
// ===========================================================================

const vocabProblems: ChoiceProblem[] = [
  // --- 動作動詞拡張 30 問 (V5W4-001 〜 V5W4-030) ---
  { level: "eiken-5", skill: "vocab", prompt_text: "Children (   ) high in the park.", choices: ["jump", "sleep", "drink", "wash"], correct_index: 0, explanation_jp: "「高くとぶ」は jump。子どもが公園で活動する動作です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-jump", "park"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Lily can (   ) very well. She likes ballet.", choices: ["dance", "sing", "swim", "cook"], correct_index: 0, explanation_jp: "ballet からダンスを連想。「踊る」は dance です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-dance", "hobby"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) a picture of my dog.", choices: ["draw", "fly", "open", "throw"], correct_index: 0, explanation_jp: "絵をかくは draw。「draw a picture」で「絵をかく」という意味です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-draw", "art"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We (   ) TV after dinner.", choices: ["watch", "listen", "read", "drink"], correct_index: 0, explanation_jp: "テレビを「見る」は watch。映像をじっと見るときに使います。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-watch", "tv"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Ben (   ) to music in his room.", choices: ["listens", "watches", "writes", "drinks"], correct_index: 0, explanation_jp: "音楽を「聞く」は listen to。三人称単数 s をつけて listens。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-listen", "music"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please (   ) me with my homework.", choices: ["help", "watch", "buy", "close"], correct_index: 0, explanation_jp: "「手伝う」は help。help me with 〜 で「〜を手伝う」です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-help", "homework"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) my hands before lunch.", choices: ["wash", "open", "ride", "find"], correct_index: 0, explanation_jp: "手を「洗う」は wash。食事前の習慣です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-wash", "daily"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We (   ) our classroom every Friday.", choices: ["clean", "sing", "fly", "draw"], correct_index: 0, explanation_jp: "「そうじする」は clean。clean a classroom で「教室をそうじする」。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-clean", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Birds (   ) in the blue sky.", choices: ["fly", "swim", "walk", "sit"], correct_index: 0, explanation_jp: "鳥が空を「飛ぶ」は fly。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-fly", "animal"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Tom (   ) a bike to school every day.", choices: ["rides", "drinks", "opens", "throws"], correct_index: 0, explanation_jp: "自転車に「乗る」は ride。三人称単数 s をつけて rides。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-ride", "bike"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please (   ) the door. It is hot inside.", choices: ["open", "close", "wash", "find"], correct_index: 0, explanation_jp: "ドアを「あける」は open。逆は close（閉める）。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-open", "command"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Mary, please (   ) the window. It's cold.", choices: ["close", "open", "fly", "use"], correct_index: 0, explanation_jp: "「閉める」は close。open（開ける）の逆です。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-close", "command"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I cannot (   ) my pencil. Where is it?", choices: ["find", "draw", "ride", "tell"], correct_index: 0, explanation_jp: "「見つける」は find。Where is it? からヒントを得られます。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-find"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Can I (   ) you a question?", choices: ["ask", "tell", "show", "find"], correct_index: 0, explanation_jp: "質問を「する」は ask。Can I ask you a question? で「質問してもいい？」", difficulty: 1, estimated_time_sec: 25, tags: ["verb-ask", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please (   ) my question. It is easy.", choices: ["answer", "wash", "ride", "throw"], correct_index: 0, explanation_jp: "質問に「答える」は answer。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-answer", "question"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I will (   ) my mother about the test.", choices: ["tell", "open", "ride", "fly"], correct_index: 0, explanation_jp: "人に「話す・伝える」は tell。tell + 人 + about 〜 の形です。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-tell"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please (   ) me your photo.", choices: ["show", "wash", "fly", "close"], correct_index: 0, explanation_jp: "「見せる」は show。show + 人 + もの の形。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-show"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I want to (   ) a new book at the store.", choices: ["buy", "fly", "wash", "throw"], correct_index: 0, explanation_jp: "「買う」は buy。store（店）から判断できます。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-buy", "shopping"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Can I (   ) your pen, please?", choices: ["use", "open", "ride", "tell"], correct_index: 0, explanation_jp: "「使う」は use。Can I use 〜 ? で「〜を使ってもいい？」", difficulty: 0, estimated_time_sec: 20, tags: ["verb-use"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We (   ) English at school every day.", choices: ["learn", "fly", "wash", "buy"], correct_index: 0, explanation_jp: "「学ぶ」は learn。learn English で「英語を学ぶ」。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-learn", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Mr. Sato (   ) math at our school.", choices: ["teaches", "buys", "rides", "flies"], correct_index: 0, explanation_jp: "「教える」は teach。三人称単数 -es 形 teaches。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-teach", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Class (   ) at nine in the morning.", choices: ["starts", "rides", "throws", "uses"], correct_index: 0, explanation_jp: "「始まる」は start。三人称単数 starts。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-start", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) my homework before dinner.", choices: ["finish", "fly", "wash", "draw"], correct_index: 0, explanation_jp: "「終える」は finish。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-finish", "homework"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Our team (   ) the soccer game last Sunday.", choices: ["won", "rode", "drew", "flew"], correct_index: 0, explanation_jp: "「勝った」は win の過去形 won。試合で使う典型表現。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-win", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) my grandmother every Sunday.", choices: ["visit", "fly", "wash", "draw"], correct_index: 0, explanation_jp: "「訪ねる」は visit。家族や友達のもとへ行くときに使います。", difficulty: 0, estimated_time_sec: 20, tags: ["verb-visit", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please (   ) the chair to the table.", choices: ["move", "ride", "fly", "open"], correct_index: 0, explanation_jp: "物を「動かす」は move。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-move"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Children (   ) the tree in the park.", choices: ["climb", "wash", "throw", "use"], correct_index: 0, explanation_jp: "「のぼる」は climb。木に登る動作です。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-climb", "park"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Ben can (   ) a ball very far.", choices: ["throw", "wash", "fly", "tell"], correct_index: 0, explanation_jp: "「投げる」は throw。野球などスポーツでよく使います。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-throw", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) the ball with my hands.", choices: ["catch", "wash", "open", "ride"], correct_index: 0, explanation_jp: "「キャッチする」は catch。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-catch", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We (   ) a snowman in winter.", choices: ["build", "fly", "wash", "tell"], correct_index: 0, explanation_jp: "「作る・組み立てる」は build。雪だるまを作る場合に使えます。", difficulty: 1, estimated_time_sec: 25, tags: ["verb-build", "winter"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },

  // --- 副詞 15 問 (V5W4-031 〜 V5W4-045) ---
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) play tennis on Saturdays.", choices: ["often", "much", "very", "many"], correct_index: 0, explanation_jp: "「よく〜する」は often。頻度を表す副詞。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-often"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Tom (   ) walks to school. He usually takes the bus.", choices: ["sometimes", "very", "much", "many"], correct_index: 0, explanation_jp: "「ときどき」は sometimes。続く文の usually とのコントラストで判断。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-sometimes"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "My father is (   ) busy. He works every day.", choices: ["always", "never", "yesterday", "today"], correct_index: 0, explanation_jp: "「いつも」は always。頻度副詞のうち最も高頻度。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-always"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Mary (   ) eats meat. She is a vegetarian.", choices: ["never", "always", "often", "very"], correct_index: 0, explanation_jp: "「決して〜ない」は never。vegetarian（菜食主義者）からヒント。", difficulty: 1, estimated_time_sec: 30, tags: ["adverb-never"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I (   ) eat lunch at noon.", choices: ["usually", "yesterday", "tomorrow", "much"], correct_index: 0, explanation_jp: "「ふだんは」は usually。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-usually"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Come (   )! I want to show you something.", choices: ["here", "there", "now", "much"], correct_index: 0, explanation_jp: "「こちらへ」は here。話し手のところを指します。", difficulty: 0, estimated_time_sec: 20, tags: ["adverb-here"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Look at the bird (   ) in the tree.", choices: ["there", "much", "many", "very"], correct_index: 0, explanation_jp: "「あそこに」は there。離れた場所を指します。", difficulty: 0, estimated_time_sec: 20, tags: ["adverb-there"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Let's go (   ). It is time for class.", choices: ["now", "yesterday", "ago", "much"], correct_index: 0, explanation_jp: "「今」は now。", difficulty: 0, estimated_time_sec: 20, tags: ["adverb-now"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I have a piano lesson (   ).", choices: ["today", "yesterday's", "long", "very"], correct_index: 0, explanation_jp: "「今日」は today。", difficulty: 0, estimated_time_sec: 20, tags: ["adverb-today"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I will play soccer (   ).", choices: ["tomorrow", "yesterday", "ago", "long"], correct_index: 0, explanation_jp: "「明日」は tomorrow。未来の予定。will との組み合わせ。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-tomorrow"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We went to the zoo (   ).", choices: ["yesterday", "tomorrow", "now", "much"], correct_index: 0, explanation_jp: "「きのう」は yesterday。went（go の過去形）から過去のことだとわかります。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-yesterday"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please come (   ) tomorrow. The class starts at eight.", choices: ["early", "late", "soon", "well"], correct_index: 0, explanation_jp: "「早く」は early。授業開始時刻にあわせる文脈。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-early"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am sorry. I am (   ) for school.", choices: ["late", "early", "fast", "well"], correct_index: 0, explanation_jp: "「おそい」は late。遅刻のときに使う表現。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-late"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Ken can run very (   ).", choices: ["fast", "much", "many", "very"], correct_index: 0, explanation_jp: "「速く」は fast。run と一緒によく使います。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-fast"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Lily sings very (   ).", choices: ["well", "much", "many", "long"], correct_index: 0, explanation_jp: "「上手に」は well。動作の上達を表します。", difficulty: 1, estimated_time_sec: 25, tags: ["adverb-well"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },

  // --- 前置詞拡張 15 問 (V5W4-046 〜 V5W4-060) ---
  { level: "eiken-5", skill: "vocab", prompt_text: "School starts (   ) eight thirty.", choices: ["at", "in", "on", "for"], correct_index: 0, explanation_jp: "時刻には at。「at + 時刻」のルール。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-at", "time"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am (   ) Japan.", choices: ["from", "to", "by", "of"], correct_index: 0, explanation_jp: "「〜出身」は from。「I am from + 国名」。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-from", "origin"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I play soccer (   ) my friends.", choices: ["with", "of", "from", "by"], correct_index: 0, explanation_jp: "「〜と一緒に」は with。", difficulty: 0, estimated_time_sec: 20, tags: ["preposition-with"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I go to school (   ) bike.", choices: ["by", "with", "for", "to"], correct_index: 0, explanation_jp: "交通手段は by。「by bike」「by train」など。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-by", "transportation"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "This present is (   ) you, Mom.", choices: ["for", "to", "in", "of"], correct_index: 0, explanation_jp: "「〜のために」は for。プレゼントの相手を表します。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-for"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "My house is (   ) the station.", choices: ["near", "of", "with", "for"], correct_index: 0, explanation_jp: "「〜の近くに」は near。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-near"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please come home (   ) dinner.", choices: ["before", "of", "from", "with"], correct_index: 0, explanation_jp: "「〜の前に」は before。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-before"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I do my homework (   ) dinner.", choices: ["after", "of", "for", "with"], correct_index: 0, explanation_jp: "「〜のあとで」は after。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-after"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "There is a park (   ) my house and the school.", choices: ["between", "of", "at", "for"], correct_index: 0, explanation_jp: "「AとBの間に」は between A and B。", difficulty: 2, estimated_time_sec: 30, tags: ["preposition-between"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "vocab", prompt_text: "The bird is flying (   ) the trees.", choices: ["over", "of", "for", "by"], correct_index: 0, explanation_jp: "「〜の上を」は over。空中を覆うイメージ。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-over"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "The cat is hiding (   ) the chair.", choices: ["behind", "with", "of", "for"], correct_index: 0, explanation_jp: "「〜のうしろに」は behind。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-behind"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I jumped (   ) the pool.", choices: ["into", "of", "with", "for"], correct_index: 0, explanation_jp: "「〜の中へ」は into。動きを伴う場合。", difficulty: 2, estimated_time_sec: 30, tags: ["preposition-into"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "vocab", prompt_text: "She is the teacher (   ) my class.", choices: ["of", "at", "with", "for"], correct_index: 0, explanation_jp: "「〜の」は of。所属を表します。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-of"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We meet (   ) the park every Sunday.", choices: ["at", "for", "with", "by"], correct_index: 0, explanation_jp: "場所の地点には at。「at + 場所（地点）」。", difficulty: 1, estimated_time_sec: 25, tags: ["preposition-at", "place"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am good (   ) tennis.", choices: ["at", "for", "with", "by"], correct_index: 0, explanation_jp: "「〜が得意」は be good at。", difficulty: 2, estimated_time_sec: 30, tags: ["preposition-at", "idiom"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },

  // --- 形容詞拡張 25 問 (V5W4-061 〜 V5W4-085) ---
  { level: "eiken-5", skill: "vocab", prompt_text: "I have a (   ) bike. I bought it yesterday.", choices: ["new", "old", "long", "tall"], correct_index: 0, explanation_jp: "「あたらしい」は new。bought it yesterday からヒント。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-new"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "My brother is (   ). He is only five years old.", choices: ["young", "old", "tall", "tired"], correct_index: 0, explanation_jp: "「わかい」は young。年齢が小さいときに使います。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-young"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Mike is very (   ). He is two meters.", choices: ["tall", "young", "tired", "easy"], correct_index: 0, explanation_jp: "「せが高い」は tall。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-tall"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am (   ). I cannot reach the top shelf.", choices: ["short", "tall", "young", "easy"], correct_index: 0, explanation_jp: "「せが低い」は short。reach the top shelf（上の棚に届かない）からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-short"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "The river is very (   ).", choices: ["long", "easy", "young", "free"], correct_index: 0, explanation_jp: "「ながい」は long。river（川）の長さを表現。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-long"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "This question is (   ). I can answer it.", choices: ["easy", "tired", "tall", "free"], correct_index: 0, explanation_jp: "「かんたん」は easy。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-easy"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "My mother is (   ) today. She has a lot of work.", choices: ["busy", "free", "young", "easy"], correct_index: 0, explanation_jp: "「いそがしい」は busy。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-busy"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am (   ) on Sunday. Let's play together.", choices: ["free", "busy", "tired", "tall"], correct_index: 0, explanation_jp: "「ひま」は free。busy（忙しい）の反対。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-free"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am very (   ). I want to sleep.", choices: ["tired", "young", "easy", "free"], correct_index: 0, explanation_jp: "「つかれた」は tired。want to sleep からヒント。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-tired"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am (   ). Let's eat lunch.", choices: ["hungry", "easy", "young", "free"], correct_index: 0, explanation_jp: "「おなかがすいた」は hungry。eat lunch からヒント。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-hungry"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I am (   ). Good night.", choices: ["sleepy", "hungry", "free", "easy"], correct_index: 0, explanation_jp: "「ねむい」は sleepy。Good night（おやすみ）からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-sleepy"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Yuki is (   ) today. She cannot come to school.", choices: ["sick", "young", "free", "easy"], correct_index: 0, explanation_jp: "「びょうきの」は sick。学校に来られない理由として自然。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-sick"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please make your room (   ).", choices: ["clean", "tired", "young", "sick"], correct_index: 0, explanation_jp: "「きれい」は clean。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-clean"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "What a (   ) baby!", choices: ["cute", "tired", "easy", "free"], correct_index: 0, explanation_jp: "「かわいい」は cute。赤ちゃんを形容するのに最適。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-cute"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "His new bike is so (   ).", choices: ["cool", "easy", "young", "sick"], correct_index: 0, explanation_jp: "「かっこいい」は cool。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-cool"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "The story is very (   ). It makes me laugh.", choices: ["funny", "tired", "easy", "sick"], correct_index: 0, explanation_jp: "「おもしろい」は funny。makes me laugh からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-funny"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "He is a (   ) boy. He can lift heavy things.", choices: ["strong", "tired", "young", "sick"], correct_index: 0, explanation_jp: "「つよい」は strong。lift heavy things（重いものを持ち上げる）からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-strong"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Please be (   ) in the library.", choices: ["quiet", "strong", "free", "easy"], correct_index: 0, explanation_jp: "「しずかに」は quiet。library（図書館）からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-quiet"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Soccer is very (   ) in our school.", choices: ["popular", "tired", "young", "sick"], correct_index: 0, explanation_jp: "「人気のある」は popular。", difficulty: 2, estimated_time_sec: 30, tags: ["adjective-popular"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Math is an (   ) subject.", choices: ["important", "tired", "young", "sick"], correct_index: 0, explanation_jp: "「大切な」は important。", difficulty: 2, estimated_time_sec: 30, tags: ["adjective-important"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.88 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Today is a (   ) day. The sun is shining.", choices: ["sunny", "rainy", "snowy", "windy"], correct_index: 0, explanation_jp: "「晴れの」は sunny。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-sunny", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "It is a (   ) day. I need an umbrella.", choices: ["rainy", "sunny", "tired", "easy"], correct_index: 0, explanation_jp: "「雨の」は rainy。umbrella（傘）からヒント。", difficulty: 0, estimated_time_sec: 20, tags: ["adjective-rainy", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "The sky is (   ) today. It might rain.", choices: ["cloudy", "sunny", "tired", "easy"], correct_index: 0, explanation_jp: "「くもりの」は cloudy。It might rain からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-cloudy", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "It was very (   ) in Hokkaido. We made a snowman.", choices: ["snowy", "sunny", "easy", "free"], correct_index: 0, explanation_jp: "「雪の」は snowy。snowman（雪だるま）からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-snowy", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "My cup is (   ) of milk.", choices: ["full", "tired", "young", "easy"], correct_index: 0, explanation_jp: "「いっぱい」は full。be full of 〜 で「〜でいっぱい」。", difficulty: 1, estimated_time_sec: 25, tags: ["adjective-full"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },

  // --- 名詞拡張 15 問 (V5W4-086 〜 V5W4-100) ---
  { level: "eiken-5", skill: "vocab", prompt_text: "My mother cooks dinner in the (   ).", choices: ["kitchen", "garden", "park", "library"], correct_index: 0, explanation_jp: "料理する場所は kitchen。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-room", "kitchen"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I take a bath in the (   ).", choices: ["bathroom", "kitchen", "park", "garden"], correct_index: 0, explanation_jp: "おふろは bathroom（おふろのある部屋）。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-room", "bathroom"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Many flowers grow in our (   ).", choices: ["garden", "kitchen", "library", "station"], correct_index: 0, explanation_jp: "花を育てる場所は garden（庭）。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-place", "garden"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I take the (   ) to school every day.", choices: ["bus", "kitchen", "garden", "library"], correct_index: 0, explanation_jp: "通学手段の bus。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-vehicle", "bus"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.93 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We went to Osaka by (   ).", choices: ["train", "kitchen", "garden", "tree"], correct_index: 0, explanation_jp: "電車は train。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-vehicle", "train"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I ride a (   ) on weekends.", choices: ["bike", "tree", "garden", "song"], correct_index: 0, explanation_jp: "自転車は bike（または bicycle）。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-vehicle", "bike"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We flew to Tokyo by (   ).", choices: ["plane", "tree", "garden", "song"], correct_index: 0, explanation_jp: "「飛行機」は plane（airplane の短縮形）。flew（fly の過去形）から判断。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-vehicle", "plane"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "Lily plays the (   ) in the music club.", choices: ["guitar", "kitchen", "tree", "garden"], correct_index: 0, explanation_jp: "「ギター」は guitar。music club からヒント。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-instrument", "guitar"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I write notes in my (   ).", choices: ["notebook", "tree", "garden", "song"], correct_index: 0, explanation_jp: "「ノート」は notebook。write notes からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-school-item", "notebook"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I use my (   ) to remove pencil marks.", choices: ["eraser", "song", "garden", "tree"], correct_index: 0, explanation_jp: "「けしゴム」は eraser。pencil marks を消すから。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-school-item", "eraser"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I drink milk in the (   ).", choices: ["morning", "garden", "tree", "song"], correct_index: 0, explanation_jp: "「朝」は morning。in the morning で「朝に」。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-time", "morning"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I read a book in the (   ) before bed.", choices: ["evening", "morning", "garden", "tree"], correct_index: 0, explanation_jp: "「夕方〜夜」は evening。before bed からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-time", "evening"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-5", skill: "vocab", prompt_text: "I sleep at (   ).", choices: ["night", "morning", "garden", "tree"], correct_index: 0, explanation_jp: "「夜」は night。at night で「夜に」。", difficulty: 0, estimated_time_sec: 20, tags: ["noun-time", "night"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We borrow books from the (   ).", choices: ["library", "kitchen", "garden", "song"], correct_index: 0, explanation_jp: "「としょかん」は library。borrow books からヒント。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-place", "library"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-5", skill: "vocab", prompt_text: "We meet our friends at the (   ).", choices: ["station", "kitchen", "garden", "song"], correct_index: 0, explanation_jp: "「えき」は station。meet at the station の典型表現。", difficulty: 1, estimated_time_sec: 25, tags: ["noun-place", "station"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
];

// ===========================================================================
// 4 級 listening 80 問（L4-001 〜 L4-080）
// 形式: 短い対話（最大 5 往復）+ 質問 OR 短いモノローグ + 質問
// 話者数: 最大 2 名 / 1 対話あたり 10〜20 秒（約 30〜60 語）
// audioScript フィールドに読み上げ原稿を必須付与
// ===========================================================================

const listeningProblems: ChoiceProblem[] = [
  // --- 対話形式 50 問 (L4-001 〜 L4-050) ---
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, what time do you usually get up? B: I get up at six thirty. A: Wow, that's early. Question: What time does Tom get up?", choices: ["At six thirty.", "At seven thirty.", "At eight.", "At six."], correct_index: 0, explanation_jp: "Tom は「I get up at six thirty.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "time", "daily"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, do you have any pets? B: Yes, I have a cat and a dog. A: That's nice. Question: How many pets does Lily have?", choices: ["Two.", "One.", "Three.", "None."], correct_index: 0, explanation_jp: "Lily は「a cat and a dog」と言っているので 2 匹です。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "pet", "number"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, where is your sister? B: She is in her room. She is studying math. Question: What is Ben's sister doing?", choices: ["Studying math.", "Playing in the park.", "Cooking.", "Sleeping."], correct_index: 0, explanation_jp: "Ben は「She is studying math.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "study", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, what did you do last Sunday? B: I went to the zoo with my family. A: Did you have fun? B: Yes, very much. Question: Where did Mary go last Sunday?", choices: ["To the zoo.", "To the park.", "To the library.", "To the beach."], correct_index: 0, explanation_jp: "Mary は「I went to the zoo」と答えています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "dialogue", "past", "weekend"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, how was the test? B: It was difficult, but I did my best. A: Good job. Question: How does Mike feel about the test?", choices: ["It was difficult.", "It was easy.", "He didn't take it.", "He didn't study."], correct_index: 0, explanation_jp: "Mike は「It was difficult」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "school", "feeling"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Anna, what are you doing this weekend? B: I will visit my grandmother in Osaka. A: That sounds nice. Question: What will Anna do this weekend?", choices: ["Visit her grandmother.", "Go to the zoo.", "Stay home.", "Go shopping."], correct_index: 0, explanation_jp: "Anna は「I will visit my grandmother in Osaka」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "future", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ken, what is your favorite subject? B: I like science the best. I want to be a doctor. Question: What does Ken want to be?", choices: ["A doctor.", "A teacher.", "A pilot.", "A singer."], correct_index: 0, explanation_jp: "Ken は「I want to be a doctor.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "future", "subject"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Yuki, are you free tomorrow? B: No, I have a piano lesson. A: How about Sunday? B: Sunday is fine. Question: When is Yuki free?", choices: ["On Sunday.", "On Saturday.", "Tomorrow.", "Today."], correct_index: 0, explanation_jp: "Yuki は「Sunday is fine.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "schedule"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Sara, can you help me with my homework? B: Sure, after dinner. A: Thanks. Question: When will Sara help?", choices: ["After dinner.", "Before dinner.", "Tomorrow.", "Now."], correct_index: 0, explanation_jp: "Sara は「Sure, after dinner.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "help"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, what is in your bag? B: A book, a pen, and a notebook. Question: What is in Tom's bag?", choices: ["A book, a pen, and a notebook.", "Only a book.", "A bag.", "Only a pen."], correct_index: 0, explanation_jp: "Tom は「A book, a pen, and a notebook.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "items"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, where do you want to go this summer? B: I want to go to the beach. A: That's a good idea. Question: Where does Lily want to go?", choices: ["To the beach.", "To the mountain.", "To the zoo.", "To the museum."], correct_index: 0, explanation_jp: "Lily は「I want to go to the beach」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "future", "summer"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, did you finish your homework? B: Not yet. I will finish it tonight. Question: Has Ben finished his homework?", choices: ["No, not yet.", "Yes, he has.", "He didn't have any.", "Yes, this morning."], correct_index: 0, explanation_jp: "Ben は「Not yet.」と答えているのでまだです。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "homework"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, do you like winter? B: Yes, I love skiing. Question: Why does Mary like winter?", choices: ["She loves skiing.", "She loves swimming.", "She loves the sun.", "She doesn't like winter."], correct_index: 0, explanation_jp: "Mary は「I love skiing.」と理由を答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "season", "preference"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, how much is this book? B: It's twelve dollars. A: I'll take it. Question: How much is the book?", choices: ["Twelve dollars.", "Two dollars.", "Twenty dollars.", "Ten dollars."], correct_index: 0, explanation_jp: "Mike は「It's twelve dollars.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "price"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Anna, what time does the train leave? B: It leaves at three fifteen. A: We have ten minutes. Question: What time does the train leave?", choices: ["At three fifteen.", "At three.", "At three thirty.", "At four fifteen."], correct_index: 0, explanation_jp: "Anna は「It leaves at three fifteen.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "train", "time"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ken, who is your best friend? B: His name is Tom. We sit next to each other. Question: Who is Ken's best friend?", choices: ["Tom.", "Ken.", "Anna.", "Lily."], correct_index: 0, explanation_jp: "Ken は「His name is Tom.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "friend"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Yuki, what sport do you play? B: I play tennis on Saturdays. Question: What sport does Yuki play?", choices: ["Tennis.", "Soccer.", "Basketball.", "Baseball."], correct_index: 0, explanation_jp: "Yuki は「I play tennis on Saturdays.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Sara, what did you eat for breakfast? B: I ate toast and milk. Question: What did Sara have for breakfast?", choices: ["Toast and milk.", "Rice and fish.", "Cereal.", "Nothing."], correct_index: 0, explanation_jp: "Sara は「I ate toast and milk.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "food", "breakfast"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, what color is your new bike? B: It's blue. I really like it. Question: What color is Tom's bike?", choices: ["Blue.", "Red.", "Green.", "Black."], correct_index: 0, explanation_jp: "Tom は「It's blue.」と答えています。", difficulty: 0, estimated_time_sec: 30, tags: ["listening", "dialogue", "color"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.92 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, when is your birthday? B: My birthday is on May fifth. Question: When is Lily's birthday?", choices: ["On May fifth.", "On June fifth.", "On May fifteenth.", "On April fifth."], correct_index: 0, explanation_jp: "Lily は「My birthday is on May fifth.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "birthday"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, can you swim? B: Yes, I can. I learned last summer. Question: When did Ben learn to swim?", choices: ["Last summer.", "Last winter.", "This summer.", "He cannot swim."], correct_index: 0, explanation_jp: "Ben は「I learned last summer.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "ability"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, is your father a teacher? B: No, he is a cook. He works at a restaurant. Question: What is Mary's father?", choices: ["A cook.", "A teacher.", "A doctor.", "A driver."], correct_index: 0, explanation_jp: "Mary は「No, he is a cook.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "job", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, do you like coffee? B: No, I prefer tea. A: Me too. Question: What does Mike like to drink?", choices: ["Tea.", "Coffee.", "Milk.", "Water."], correct_index: 0, explanation_jp: "Mike は「I prefer tea.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "drink"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Anna, where is the post office? B: Go straight and turn right. It's near the bank. A: Thank you. Question: Where is the post office?", choices: ["Near the bank.", "Near the school.", "Near the park.", "Inside the bank."], correct_index: 0, explanation_jp: "Anna は「It's near the bank.」と答えています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "dialogue", "direction"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ken, did you watch the soccer game last night? B: Yes, our team won. Question: Who won the game?", choices: ["Ken's team.", "The other team.", "Nobody.", "It was a draw."], correct_index: 0, explanation_jp: "Ken は「our team won」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "sport", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Yuki, how do you go to school? B: I usually walk. It takes ten minutes. Question: How long does it take Yuki to go to school?", choices: ["Ten minutes.", "Twenty minutes.", "Five minutes.", "An hour."], correct_index: 0, explanation_jp: "Yuki は「It takes ten minutes.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "school", "time"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Sara, who is the tallest in your class? B: It's Mike. He is one hundred eighty centimeters. Question: Who is the tallest?", choices: ["Mike.", "Sara.", "The teacher.", "Tom."], correct_index: 0, explanation_jp: "Sara は「It's Mike.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "comparison"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, what season do you like? B: I like spring because the cherry blossoms are beautiful. Question: Why does Tom like spring?", choices: ["The cherry blossoms are beautiful.", "It's hot.", "It's cold.", "He likes snow."], correct_index: 0, explanation_jp: "Tom は「the cherry blossoms are beautiful」と理由を答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "season"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, which is bigger, Japan or Australia? B: Australia is bigger. Question: Which country is bigger?", choices: ["Australia.", "Japan.", "Both are the same.", "She doesn't know."], correct_index: 0, explanation_jp: "Lily は「Australia is bigger.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "comparison", "country"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, how often do you play the piano? B: I practice every day. Question: How often does Ben play the piano?", choices: ["Every day.", "Once a week.", "Sometimes.", "Never."], correct_index: 0, explanation_jp: "Ben は「I practice every day.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "frequency"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, what did your sister give you for your birthday? B: She gave me a nice book. Question: What did Mary's sister give her?", choices: ["A book.", "A cake.", "A pen.", "A bag."], correct_index: 0, explanation_jp: "Mary は「She gave me a nice book.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "gift", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, do you have any brothers or sisters? B: I have one sister. She is twelve. Question: How old is Mike's sister?", choices: ["Twelve.", "Two.", "Twenty.", "Ten."], correct_index: 0, explanation_jp: "Mike は「She is twelve.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "family", "age"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Anna, where do you eat lunch? B: I eat in the school cafeteria. Question: Where does Anna eat lunch?", choices: ["In the school cafeteria.", "At home.", "In the park.", "In the library."], correct_index: 0, explanation_jp: "Anna は「I eat in the school cafeteria.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "school", "food"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ken, what are you reading? B: A book about animals. It's very interesting. Question: What is Ken reading about?", choices: ["Animals.", "Sports.", "History.", "Cars."], correct_index: 0, explanation_jp: "Ken は「A book about animals.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "reading"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Yuki, are you ready for the test? B: Not yet. I need to study more tonight. Question: What will Yuki do tonight?", choices: ["Study.", "Sleep.", "Watch TV.", "Play games."], correct_index: 0, explanation_jp: "Yuki は「I need to study more tonight.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "study"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Sara, can your brother ride a bike? B: Yes, he can. He is five years old. Question: How old is Sara's brother?", choices: ["Five.", "Six.", "Four.", "Fifteen."], correct_index: 0, explanation_jp: "Sara は「He is five years old.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "family", "age"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, what do you do after school? B: I go to soccer practice for two hours. Question: How long does Tom practice soccer?", choices: ["Two hours.", "One hour.", "Three hours.", "He doesn't practice."], correct_index: 0, explanation_jp: "Tom は「for two hours」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "school", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, do you want to come to the museum with me? B: Sure, when? A: This Sunday at ten. B: Okay. Question: When are they going to the museum?", choices: ["This Sunday at ten.", "This Saturday at ten.", "Next Sunday.", "Now."], correct_index: 0, explanation_jp: "A は「This Sunday at ten.」と答えています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "dialogue", "schedule", "museum"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, are you going to the party tonight? B: No, I'm too tired. I'll stay home. Question: What will Ben do tonight?", choices: ["Stay home.", "Go to the party.", "Visit a friend.", "Go shopping."], correct_index: 0, explanation_jp: "Ben は「I'll stay home.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, did you make this cake? B: No, my mother made it. Question: Who made the cake?", choices: ["Mary's mother.", "Mary.", "Mary's sister.", "Mary's father."], correct_index: 0, explanation_jp: "Mary は「my mother made it」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "food", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, what is your favorite season? B: Summer. I like swimming in the sea. Question: Why does Mike like summer?", choices: ["He likes swimming.", "He likes skiing.", "He likes the snow.", "He likes the rain."], correct_index: 0, explanation_jp: "Mike は「I like swimming in the sea.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "season"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Anna, what are you cooking? B: A vegetable soup. It will be ready in ten minutes. Question: How long until the soup is ready?", choices: ["Ten minutes.", "Twenty minutes.", "An hour.", "It's ready now."], correct_index: 0, explanation_jp: "Anna は「in ten minutes」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "cooking"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ken, are you going to study English tonight? B: Yes, I have a test tomorrow. Question: Why is Ken studying tonight?", choices: ["He has a test tomorrow.", "He likes English.", "His mother asked him.", "He is bored."], correct_index: 0, explanation_jp: "Ken は「I have a test tomorrow.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "study"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Yuki, where did you put my pen? B: It's on the table. Question: Where is the pen?", choices: ["On the table.", "In the bag.", "Under the chair.", "In the drawer."], correct_index: 0, explanation_jp: "Yuki は「It's on the table.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "location"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Sara, did you see the new movie? B: Yes, I saw it last weekend. It was great. Question: When did Sara see the movie?", choices: ["Last weekend.", "This morning.", "Yesterday.", "She didn't see it."], correct_index: 0, explanation_jp: "Sara は「I saw it last weekend.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "movie", "past"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Tom, can I borrow your eraser? B: Sure, here you are. A: Thanks. Question: What does Tom give to A?", choices: ["An eraser.", "A pen.", "A book.", "A pencil."], correct_index: 0, explanation_jp: "A は eraser を借りていて Tom は「Sure, here you are.」と渡しています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "borrow"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Lily, what is the date today? B: It's October eleventh. Question: What is the date?", choices: ["October eleventh.", "October first.", "September eleventh.", "November eleventh."], correct_index: 0, explanation_jp: "Lily は「It's October eleventh.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "date"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Ben, do you walk your dog every day? B: Yes, in the morning before school. Question: When does Ben walk his dog?", choices: ["In the morning.", "In the evening.", "After school.", "He doesn't walk it."], correct_index: 0, explanation_jp: "Ben は「in the morning before school」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "pet", "routine"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mary, what's wrong? B: I have a headache. I want to go home. Question: What is wrong with Mary?", choices: ["She has a headache.", "She is hungry.", "She is bored.", "She is happy."], correct_index: 0, explanation_jp: "Mary は「I have a headache.」と答えています。", difficulty: 2, estimated_time_sec: 40, tags: ["listening", "dialogue", "feeling", "health"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "listening", prompt_text: "対話を聞いて、質問に答えなさい。", audioScript: "A: Mike, what club are you in? B: I'm in the art club. We paint every Thursday. Question: When does Mike paint?", choices: ["Every Thursday.", "Every Friday.", "Every Monday.", "Every day."], correct_index: 0, explanation_jp: "Mike は「We paint every Thursday.」と答えています。", difficulty: 1, estimated_time_sec: 35, tags: ["listening", "dialogue", "club", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },

  // --- モノローグ形式 30 問 (L4-051 〜 L4-080) ---
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "I'm Tom. I usually get up at seven. I eat breakfast and then go to school by bike. Question: How does Tom go to school?", choices: ["By bike.", "By bus.", "On foot.", "By car."], correct_index: 0, explanation_jp: "「go to school by bike」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "daily"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Lily has two cats. Their names are Mimi and Coco. They are both white. Question: What color are Lily's cats?", choices: ["White.", "Black.", "Brown.", "Different colors."], correct_index: 0, explanation_jp: "「They are both white.」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "pet"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "My name is Ben. I'm in the music club. I play the guitar. We practice every Wednesday. Question: When does Ben practice the guitar?", choices: ["Every Wednesday.", "Every day.", "Every Tuesday.", "On weekends."], correct_index: 0, explanation_jp: "「every Wednesday」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "club"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Last Sunday, Mary went to the park with her family. They had a picnic and played frisbee. They had a great time. Question: What did Mary do last Sunday?", choices: ["She went to the park.", "She stayed home.", "She went to school.", "She visited a friend."], correct_index: 0, explanation_jp: "「went to the park with her family」と言っています。", difficulty: 1, estimated_time_sec: 45, tags: ["listening", "monologue", "weekend"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Mike likes reading books. His favorite book is about space. He reads at the library every weekend. Question: Where does Mike read books?", choices: ["At the library.", "At home.", "At school.", "At the park."], correct_index: 0, explanation_jp: "「at the library」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "reading"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Anna will go to Hokkaido next month with her parents. She wants to see the snow festival. Question: Where is Anna going next month?", choices: ["To Hokkaido.", "To Tokyo.", "To Okinawa.", "To Kyoto."], correct_index: 0, explanation_jp: "「go to Hokkaido next month」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "future", "travel"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Ken loves drawing pictures. He draws after school every day. He wants to be an artist. Question: What does Ken want to be?", choices: ["An artist.", "A teacher.", "A doctor.", "A singer."], correct_index: 0, explanation_jp: "「He wants to be an artist.」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Yuki has a piano lesson every Tuesday and Friday. The lesson is one hour long. Question: How long is Yuki's piano lesson?", choices: ["One hour.", "Two hours.", "Thirty minutes.", "Half a day."], correct_index: 0, explanation_jp: "「one hour long」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "lesson"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Sara is from Australia. She came to Japan two years ago. She likes Japanese food. Question: How long has Sara been in Japan?", choices: ["Two years.", "One year.", "Three years.", "Six months."], correct_index: 0, explanation_jp: "「two years ago」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "past", "duration"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Tom and his sister visit their grandmother every summer. She lives in Kyoto. They stay for one week. Question: How long do they stay with their grandmother?", choices: ["One week.", "One day.", "One month.", "Two weeks."], correct_index: 0, explanation_jp: "「stay for one week」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Lily's school festival is in November. Each class makes a special booth. Lily's class will sell cookies. Question: What will Lily's class sell?", choices: ["Cookies.", "Cake.", "Candy.", "Drinks."], correct_index: 0, explanation_jp: "「sell cookies」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "school"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Ben usually walks to school. But today it's raining, so he is taking the bus. Question: How is Ben going to school today?", choices: ["By bus.", "On foot.", "By bike.", "By car."], correct_index: 0, explanation_jp: "「today it's raining, so he is taking the bus」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "transportation"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Mary went shopping yesterday. She bought a new pair of shoes for two thousand yen. Question: What did Mary buy yesterday?", choices: ["A pair of shoes.", "A bag.", "A book.", "A T-shirt."], correct_index: 0, explanation_jp: "「a new pair of shoes」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "shopping"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Mike loves baseball. He watches games on TV every Saturday. His favorite team is the Tigers. Question: What is Mike's favorite team?", choices: ["The Tigers.", "The Lions.", "The Bears.", "The Dragons."], correct_index: 0, explanation_jp: "「His favorite team is the Tigers.」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Anna is studying Japanese. She has lessons twice a week. She can write fifty kanji. Question: How many kanji can Anna write?", choices: ["Fifty.", "Fifteen.", "Five.", "One hundred."], correct_index: 0, explanation_jp: "「fifty kanji」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "study"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Today's weather is cold and windy. It will snow tonight. Please wear a warm coat. Question: What will the weather be like tonight?", choices: ["Snowy.", "Sunny.", "Rainy.", "Cloudy."], correct_index: 0, explanation_jp: "「It will snow tonight.」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "weather"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Ken's father works at a hospital. He is a doctor. He helps many people every day. Question: What is Ken's father's job?", choices: ["A doctor.", "A nurse.", "A teacher.", "A cook."], correct_index: 0, explanation_jp: "「He is a doctor.」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "job"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Yuki likes flowers. She has many flowers in her garden. Her favorite is the sunflower. Question: What is Yuki's favorite flower?", choices: ["The sunflower.", "The rose.", "The tulip.", "The cherry blossom."], correct_index: 0, explanation_jp: "「Her favorite is the sunflower.」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "flower"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Sara's class went to a science museum yesterday. They saw a big dinosaur skeleton. It was exciting. Question: What did Sara see at the museum?", choices: ["A dinosaur skeleton.", "A space ship.", "Old paintings.", "A movie."], correct_index: 0, explanation_jp: "「a big dinosaur skeleton」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "museum"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Tom's mother makes pancakes every Sunday morning. They are so delicious. Tom always eats three. Question: How many pancakes does Tom eat?", choices: ["Three.", "Two.", "Four.", "One."], correct_index: 0, explanation_jp: "「Tom always eats three」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "food"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Lily wants to be a teacher. She teaches her younger brother math at home. He is in second grade. Question: Who does Lily teach math?", choices: ["Her brother.", "Her sister.", "Her friend.", "Her mother."], correct_index: 0, explanation_jp: "「She teaches her younger brother math」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "future"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Ben went camping last weekend. He set up a tent and made a fire. He cooked sausages for dinner. Question: What did Ben eat for dinner?", choices: ["Sausages.", "Hamburgers.", "Pizza.", "Soup."], correct_index: 0, explanation_jp: "「cooked sausages for dinner」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "camping"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Mary's grandmother lives in the countryside. She has a big garden. Mary visits her every summer vacation. Question: When does Mary visit her grandmother?", choices: ["Every summer vacation.", "Every winter vacation.", "Every weekend.", "Every month."], correct_index: 0, explanation_jp: "「every summer vacation」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "family"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Mike runs in the park every morning. He runs for thirty minutes. He started running last year. Question: When did Mike start running?", choices: ["Last year.", "Last month.", "This week.", "Yesterday."], correct_index: 0, explanation_jp: "「started running last year」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "sport"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Anna has a big test next Monday. She is studying English every night. She wants to get a good grade. Question: When is Anna's test?", choices: ["Next Monday.", "Tomorrow.", "Next Friday.", "Today."], correct_index: 0, explanation_jp: "「next Monday」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "study"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Ken's family has a small dog named Pochi. Pochi is two years old. Ken walks Pochi every evening. Question: How old is Pochi?", choices: ["Two years old.", "One year old.", "Three years old.", "Five years old."], correct_index: 0, explanation_jp: "「Pochi is two years old」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "pet"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Yuki and her friends are planning a birthday party. The party will be at five on Saturday. They will eat pizza. Question: What time is the party?", choices: ["At five.", "At six.", "At four.", "At seven."], correct_index: 0, explanation_jp: "「at five on Saturday」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "party"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.89 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Sara's school has a new music room. It has many instruments. Sara likes to play the drums there. Question: What does Sara play in the music room?", choices: ["The drums.", "The guitar.", "The piano.", "The violin."], correct_index: 0, explanation_jp: "「Sara likes to play the drums there」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "music"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Tom got a new puppy for his birthday. The puppy is brown and very small. Tom named him Coco. Question: What did Tom get for his birthday?", choices: ["A puppy.", "A kitten.", "A bike.", "A book."], correct_index: 0, explanation_jp: "「a new puppy for his birthday」と言っています。", difficulty: 1, estimated_time_sec: 40, tags: ["listening", "monologue", "birthday"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.91 },
  { level: "eiken-4", skill: "listening", prompt_text: "短い英文を聞いて、質問に答えなさい。", audioScript: "Lily visited a new bakery on her way home. She bought a chocolate donut. It was delicious. Question: What did Lily buy?", choices: ["A chocolate donut.", "A vanilla cake.", "A strawberry pie.", "Bread."], correct_index: 0, explanation_jp: "「a chocolate donut」と言っています。", difficulty: 2, estimated_time_sec: 45, tags: ["listening", "monologue", "food"], source_license: "ORIGINAL_AI", copyright_safe: true, generated_quality_score: 0.90 },
];

// ===========================================================================
// 3 級 reading 40 問（R3-001 〜 R3-040）
// 形式: passage 100〜150 語 + 設問 2 問
// kid-safe ジャンル限定: school / family / season / animal / hobby / food /
//                       sport / travel
// ===========================================================================

const readingProblems: ReadingPassageProblem[] = [
  // R3-001
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Aoi loves spring. In her town, the cherry blossoms bloom in early April. She walks to school under the pink trees every morning. Last weekend, her family had a hanami picnic in the city park. They ate rice balls and fruit, and her father took many photos. Aoi's little brother Kenta ran around and laughed all day. After the picnic, they took a long walk along the river. Aoi felt happy and peaceful. She thinks spring is the best season because the flowers are beautiful and her family spends time together outside. She is already looking forward to next spring.",
    word_count: 110,
    genre: "season",
    questions: [
      { question: "When do the cherry blossoms bloom in Aoi's town?", choices: ["In early April.", "In March.", "In May.", "In late April."], correct_index: 0, explanation_jp: "本文に「the cherry blossoms bloom in early April」とあります。" },
      { question: "Why does Aoi like spring the best?", choices: ["The flowers are beautiful and her family spends time together outside.", "Because of the rain.", "Because the river freezes.", "Because she has a long break."], correct_index: 0, explanation_jp: "本文に「the flowers are beautiful and her family spends time together outside」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "season", "spring"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-002
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Ren is a fifth-grade student at Sakura Elementary School. He goes to school five days a week. His favorite subject is science because he loves doing experiments. Every Friday, his class has a special science lesson with a teacher from a junior high school. Last month, they made a small volcano with vinegar and baking soda. The students were amazed by the bubbles. Ren wrote about the lesson in his notebook and showed it to his parents. His mother said his report was very good. Ren wants to be a scientist when he grows up. He thinks science makes the world more interesting.",
    word_count: 116,
    genre: "school",
    questions: [
      { question: "What is Ren's favorite subject?", choices: ["Science.", "Math.", "English.", "Music."], correct_index: 0, explanation_jp: "本文に「His favorite subject is science」とあります。" },
      { question: "What did Ren want to be in the future?", choices: ["A scientist.", "A teacher.", "A doctor.", "A musician."], correct_index: 0, explanation_jp: "本文に「Ren wants to be a scientist」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "subject"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-003
  {
    level: "eiken-3",
    skill: "reading",
    passage: "The Tanaka family has a small white dog named Coco. Coco is three years old. She came to their family two years ago from a shelter. Every morning, Mr. Tanaka takes Coco for a walk in the park near their house. Coco loves chasing leaves and playing with other dogs. After the walk, the children Mika and Yuto give her food and fresh water. Coco sleeps in a soft bed in the living room. On weekends, the whole family takes Coco to a bigger park by the river. Coco is happy there because she can run freely. The family thinks Coco makes their home warm and full of joy.",
    word_count: 119,
    genre: "animal",
    questions: [
      { question: "How long has Coco been with the family?", choices: ["Two years.", "Three years.", "One year.", "Five years."], correct_index: 0, explanation_jp: "本文に「She came to their family two years ago」とあります。" },
      { question: "Where does Coco run freely on weekends?", choices: ["A bigger park by the river.", "The small park near the house.", "The garden.", "The beach."], correct_index: 0, explanation_jp: "本文に「a bigger park by the river」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "animal", "pet"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-004
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Yui's grandmother lives in a small village in Nagano. Every summer, Yui visits her for two weeks. The village is surrounded by green mountains and rice fields. Yui's grandmother has a vegetable garden behind her house. Together they pick fresh tomatoes, cucumbers, and corn. In the evening, they cook simple meals and eat outside. Yui's grandfather tells stories about his childhood. At night, Yui watches the stars from the porch. She has never seen so many stars in the city. Yui loves these summer days. She always feels relaxed and happy at her grandparents' home. She thinks the village is the most peaceful place in Japan.",
    word_count: 117,
    genre: "family",
    questions: [
      { question: "Where does Yui's grandmother live?", choices: ["In a small village in Nagano.", "In Tokyo.", "In Kyoto.", "In Hokkaido."], correct_index: 0, explanation_jp: "本文に「a small village in Nagano」とあります。" },
      { question: "What do Yui and her grandmother grow in the garden?", choices: ["Tomatoes, cucumbers, and corn.", "Only rice.", "Flowers.", "Apples."], correct_index: 0, explanation_jp: "本文に「fresh tomatoes, cucumbers, and corn」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "summer"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-005
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Haruto loves playing the guitar. He started two years ago when his uncle gave him an old guitar. At first, his fingers hurt a lot. But he practiced every day for thirty minutes. Now he can play many songs. Last month, he joined a school music club. He met three other children who play instruments. They started a small band. Their first concert will be at the school festival in November. Haruto's parents are excited to listen. Haruto practices even harder now because he doesn't want to make mistakes. He believes music makes people happy. He hopes everyone will enjoy the concert.",
    word_count: 114,
    genre: "hobby",
    questions: [
      { question: "Who gave Haruto the guitar?", choices: ["His uncle.", "His father.", "His teacher.", "His friend."], correct_index: 0, explanation_jp: "本文に「his uncle gave him an old guitar」とあります。" },
      { question: "When is the school festival?", choices: ["In November.", "In October.", "In December.", "In September."], correct_index: 0, explanation_jp: "本文に「at the school festival in November」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "music"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-006
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Saki's family loves cooking together on Sundays. Last Sunday, they made vegetable curry. Saki's mother cut the carrots and potatoes. Her father washed the rice. Saki and her brother Daichi peeled onions, but they cried because of the smell. Everyone laughed. The kitchen smelled wonderful while the curry was cooking. They ate together at six o'clock. Saki's father said it was the best curry ever. After dinner, the children washed the dishes. Saki thinks cooking with her family is more fun than watching TV. She is already thinking about what to cook next Sunday. Maybe pasta or pizza, she says.",
    word_count: 110,
    genre: "food",
    questions: [
      { question: "What did Saki and her brother do?", choices: ["Peeled onions.", "Cut carrots.", "Washed rice.", "Made bread."], correct_index: 0, explanation_jp: "本文に「peeled onions」とあります。" },
      { question: "What does Saki think about cooking with her family?", choices: ["It is more fun than watching TV.", "It is boring.", "It is too difficult.", "It is too long."], correct_index: 0, explanation_jp: "本文に「more fun than watching TV」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "food", "family"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-007
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Riku joined the soccer team in his fourth grade. He practices three times a week after school. His coach is a friendly man who used to be a professional player. Last Saturday, Riku's team played against another school. Riku scored two goals, and his team won three to one. His parents and his little sister came to watch the game. They were very proud of him. After the game, Riku went out for ice cream with his teammates. Riku loves soccer because it teaches him teamwork. He wants to keep playing in junior high school. His dream is to play in the World Cup someday.",
    word_count: 116,
    genre: "sport",
    questions: [
      { question: "How many goals did Riku score?", choices: ["Two.", "One.", "Three.", "None."], correct_index: 0, explanation_jp: "本文に「Riku scored two goals」とあります。" },
      { question: "What is Riku's dream?", choices: ["To play in the World Cup someday.", "To become a coach.", "To go to a famous school.", "To win a prize."], correct_index: 0, explanation_jp: "本文に「to play in the World Cup someday」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "sport", "soccer"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-008
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last summer, the Yamada family went to Okinawa for five days. It was Hina's first trip to the southern island. They flew from Tokyo and arrived in the afternoon. The sea was clear and blue. On the first day, they swam at a beach near the hotel. Hina saw many small colorful fish. The next day, they visited an old castle and learned about Okinawan history. They also tried local food like Okinawa soba. Hina's favorite was the mango shaved ice. On the last day, they bought souvenirs for their friends. Hina took many photos with her camera. She wants to go back to Okinawa next year.",
    word_count: 119,
    genre: "travel",
    questions: [
      { question: "How long did the Yamada family stay in Okinawa?", choices: ["Five days.", "Three days.", "One week.", "Two days."], correct_index: 0, explanation_jp: "本文に「for five days」とあります。" },
      { question: "What was Hina's favorite food?", choices: ["The mango shaved ice.", "Okinawa soba.", "Sushi.", "Ramen."], correct_index: 0, explanation_jp: "本文に「Hina's favorite was the mango shaved ice」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "travel", "summer"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-009
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Sora attends a small art class on Wednesdays. The class has only six students. Their teacher Ms. Aoki is kind and creative. Last week, the students painted pictures of their favorite places. Sora painted his school garden because he likes the flowers there. Ms. Aoki said his colors were beautiful. After class, Sora's mother came to pick him up. She loved his painting and put it on the refrigerator at home. Sora has been drawing since he was four years old. He has many sketchbooks full of pictures. He hopes to become an art teacher one day, just like Ms. Aoki.",
    word_count: 109,
    genre: "hobby",
    questions: [
      { question: "What did Sora paint last week?", choices: ["His school garden.", "His house.", "His pet.", "The sea."], correct_index: 0, explanation_jp: "本文に「Sora painted his school garden」とあります。" },
      { question: "What does Sora want to be in the future?", choices: ["An art teacher.", "A doctor.", "A scientist.", "A chef."], correct_index: 0, explanation_jp: "本文に「to become an art teacher one day」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "art"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
  // R3-010
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Tom is from Australia. He moved to Japan with his parents last year. At first, he didn't understand any Japanese. School was difficult, and he felt lonely. But his classmate Daiki was kind to him. Daiki taught him simple Japanese words every day. They became close friends. Now Tom can have short conversations in Japanese. He even joined the soccer team with Daiki. Tom's favorite Japanese food is yakitori. On weekends, his family explores different cities. They have visited Kyoto, Osaka, and Nara. Tom is much happier now. He thinks moving to Japan was a great experience. He is grateful for his new friends.",
    word_count: 116,
    genre: "school",
    questions: [
      { question: "Who taught Tom Japanese?", choices: ["His classmate Daiki.", "His teacher.", "His mother.", "A tutor."], correct_index: 0, explanation_jp: "本文に「his classmate Daiki was kind to him. Daiki taught him simple Japanese words」とあります。" },
      { question: "What is Tom's favorite Japanese food?", choices: ["Yakitori.", "Sushi.", "Ramen.", "Tempura."], correct_index: 0, explanation_jp: "本文に「Tom's favorite Japanese food is yakitori」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "friend"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-011
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Mei loves swimming. She joined a swim club when she was seven. Now she is eleven and a strong swimmer. She practices four times a week. Her best stroke is the butterfly. Last month, she joined a city swimming contest. She finished in first place in her age group. Her coach was very proud. Mei's parents took her out for a special dinner that night. Mei wants to keep practicing hard. Her dream is to compete in a national contest next year. She also wants to swim in the ocean someday. Mei thinks swimming makes her body strong and her mind calm.",
    word_count: 112,
    genre: "sport",
    questions: [
      { question: "What is Mei's best stroke?", choices: ["The butterfly.", "The freestyle.", "The breaststroke.", "The backstroke."], correct_index: 0, explanation_jp: "本文に「Her best stroke is the butterfly」とあります。" },
      { question: "What is Mei's dream for next year?", choices: ["To compete in a national contest.", "To go to the ocean.", "To stop swimming.", "To become a coach."], correct_index: 0, explanation_jp: "本文に「to compete in a national contest next year」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "sport", "swimming"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-012
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Winter is Hayato's favorite season. His family lives in Hokkaido, where it snows a lot. Every weekend, Hayato and his older sister Aoi go skiing. They started skiing when they were little. The mountain near their house has many ski slopes. Their parents bought them new skis last December. Hayato can ski down the long courses now. He also loves making snowmen with his neighbor friends. They build a different snowman every weekend. Last week, they made a giant one together. Hayato's mother took a photo of it. Hayato hopes the winter will be long this year so he can play in the snow more.",
    word_count: 117,
    genre: "season",
    questions: [
      { question: "Where does Hayato's family live?", choices: ["In Hokkaido.", "In Tokyo.", "In Okinawa.", "In Osaka."], correct_index: 0, explanation_jp: "本文に「His family lives in Hokkaido」とあります。" },
      { question: "What did Hayato and his friends make last week?", choices: ["A giant snowman.", "A snow castle.", "A small snowman.", "A snow dog."], correct_index: 0, explanation_jp: "本文に「they made a giant one together」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "season", "winter"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-013
  {
    level: "eiken-3",
    skill: "reading",
    passage: "The Sato family adopted a kitten from an animal shelter. Her name is Mimi. Mimi is gray with white paws. She is only three months old. The whole family loves her. Mr. Sato made a cozy bed for her. The two children Yui and Sho play with her after school. Mimi is curious and chases small toys. She also likes to sleep on Yui's lap. The family takes her to a veterinarian for a checkup every month. Mimi is healthy and growing fast. The family hopes she will live with them for many happy years. Yui says Mimi makes her smile every day.",
    word_count: 113,
    genre: "animal",
    questions: [
      { question: "Where did the Sato family get Mimi?", choices: ["From an animal shelter.", "From a friend.", "From a pet shop.", "From the street."], correct_index: 0, explanation_jp: "本文に「adopted a kitten from an animal shelter」とあります。" },
      { question: "How often does the family take Mimi to a veterinarian?", choices: ["Every month.", "Every week.", "Every year.", "Every day."], correct_index: 0, explanation_jp: "本文に「for a checkup every month」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "animal", "cat"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-014
  {
    level: "eiken-3",
    skill: "reading",
    passage: "My name is Akari. I'm in the sixth grade. Last weekend, my class held a school festival. Each class made a special booth. My class made a small cafe. We sold cookies and lemonade. I was a waiter and helped customers find tables. My friends Mika and Sho baked cookies in the morning. About one hundred people visited our cafe. Some children came twice because the cookies were so good. My teacher said our cafe was the most popular in the festival. We were proud and happy. After the festival, we cleaned the room together. I will always remember this fun day at school.",
    word_count: 113,
    genre: "school",
    questions: [
      { question: "What did Akari do at the school festival?", choices: ["She was a waiter.", "She baked cookies.", "She made tea.", "She sold tickets."], correct_index: 0, explanation_jp: "本文に「I was a waiter and helped customers find tables」とあります。" },
      { question: "How many people visited their cafe?", choices: ["About one hundred.", "Fifty.", "Two hundred.", "Ten."], correct_index: 0, explanation_jp: "本文に「About one hundred people visited」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "festival"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-015
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Mr. and Mrs. Honda have a small flower shop in their town. They opened it twenty years ago. Their daughter Saya now works with them. The shop is filled with fresh flowers from many countries. Saya learns flower arrangement from her mother every day. She loves making bouquets for happy events like weddings and birthdays. Last week, she made a beautiful bouquet for her best friend's birthday. Her friend was very happy and almost cried. Saya feels proud of her work. She wants to make more people smile through flowers. Her mother says Saya has a special talent. Saya hopes to take over the shop someday.",
    word_count: 116,
    genre: "family",
    questions: [
      { question: "How long has the flower shop been open?", choices: ["Twenty years.", "Two years.", "Ten years.", "Five years."], correct_index: 0, explanation_jp: "本文に「They opened it twenty years ago」とあります。" },
      { question: "What does Saya hope to do someday?", choices: ["Take over the shop.", "Travel abroad.", "Open a bakery.", "Become a teacher."], correct_index: 0, explanation_jp: "本文に「to take over the shop someday」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "work"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-016
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Kenta loves running. He started running with his father two years ago. They run together every Sunday morning at five thirty. The park near their house has a long running path. Kenta can run five kilometers without stopping now. Last month, he joined his first kids' marathon. He finished in third place. He got a medal and was very excited. His father gave him a high five. After the race, they had a big breakfast together. Kenta hopes to run a longer distance next year. He thinks running makes him stronger and happier. He looks forward to Sunday mornings every week.",
    word_count: 110,
    genre: "sport",
    questions: [
      { question: "What time do Kenta and his father run?", choices: ["At five thirty.", "At six.", "At seven.", "At five."], correct_index: 0, explanation_jp: "本文に「at five thirty」とあります。" },
      { question: "What place did Kenta finish in the marathon?", choices: ["Third place.", "First place.", "Second place.", "Fourth place."], correct_index: 0, explanation_jp: "本文に「He finished in third place」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "sport", "running"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-017
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last month, Aoi's class went on a field trip to a farm. The farm was about an hour away from the school. The students learned how to milk cows and feed sheep. Aoi was a little scared at first because the cows were so big. But the farmer was kind and showed her how to do it gently. After lunch, the students made fresh butter from milk. They spread the butter on bread and ate it together. Aoi loved the taste. She had never had such fresh butter before. She wants to visit a farm again with her family. She also wants to learn more about where her food comes from.",
    word_count: 121,
    genre: "school",
    questions: [
      { question: "What did the students do after lunch?", choices: ["Made fresh butter.", "Milked cows.", "Fed sheep.", "Played outside."], correct_index: 0, explanation_jp: "本文に「the students made fresh butter from milk」とあります。" },
      { question: "What does Aoi want to learn more about?", choices: ["Where her food comes from.", "How to ride horses.", "Farm animals.", "Cooking recipes."], correct_index: 0, explanation_jp: "本文に「learn more about where her food comes from」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 190,
    tags: ["reading", "passage", "school", "trip"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-018
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Naoki collects insects as his hobby. He has a special box at home with many beetles and butterflies. He started collecting when he was seven. His grandfather, who was a science teacher, taught him the names of many insects. Now Naoki knows over fifty insect names in English and Japanese. Every summer, he goes to a forest near his house with his cousin. They look for rare insects together. Last summer, they found a beautiful blue butterfly. Naoki was so excited. He drew a picture of it in his nature notebook. Naoki wants to study biology in university and discover new insects in the future.",
    word_count: 113,
    genre: "hobby",
    questions: [
      { question: "Who taught Naoki insect names?", choices: ["His grandfather.", "His father.", "His teacher.", "His cousin."], correct_index: 0, explanation_jp: "本文に「His grandfather, who was a science teacher, taught him」とあります。" },
      { question: "What did Naoki find last summer?", choices: ["A beautiful blue butterfly.", "A rare beetle.", "A green frog.", "A red spider."], correct_index: 0, explanation_jp: "本文に「a beautiful blue butterfly」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "insect"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-019
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Yuna's birthday is in autumn. Last year, her parents took her to a beautiful park to see the red and yellow leaves. They walked under big trees and took many photos. Yuna's mother packed a special lunch with rice balls, fried chicken, and apple pie. They ate on a wooden bench near a small pond. Yuna saw some ducks swimming there. After lunch, her father gave her a wrapped present. It was a new pair of running shoes. Yuna was so happy because she had wanted them for a long time. She wore them right away. She thinks autumn is the most beautiful and special season for her.",
    word_count: 119,
    genre: "season",
    questions: [
      { question: "What did Yuna receive for her birthday?", choices: ["A new pair of running shoes.", "A book.", "A new bike.", "A camera."], correct_index: 0, explanation_jp: "本文に「a new pair of running shoes」とあります。" },
      { question: "Where did the family eat lunch?", choices: ["On a wooden bench near a small pond.", "At a restaurant.", "On a picnic mat.", "At home."], correct_index: 0, explanation_jp: "本文に「on a wooden bench near a small pond」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "season", "autumn"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-020
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Kaito's family went to Hawaii during the summer vacation. It was their first trip outside Japan. They flew for about seven hours from Tokyo. Hawaii was very warm and sunny. They stayed at a hotel near the beach. Every morning, Kaito and his sister Sara swam in the clear ocean. They saw colorful fish through their goggles. They tried surfing for the first time. The instructor was very patient. Kaito fell off the board many times, but he kept trying. On the third day, he could stand on the board for a few seconds. The family ate fresh pineapple every day. Kaito wants to go back to Hawaii next summer.",
    word_count: 121,
    genre: "travel",
    questions: [
      { question: "How long was the flight to Hawaii?", choices: ["About seven hours.", "About three hours.", "About five hours.", "About ten hours."], correct_index: 0, explanation_jp: "本文に「about seven hours from Tokyo」とあります。" },
      { question: "What did Kaito and his sister try for the first time?", choices: ["Surfing.", "Skiing.", "Diving.", "Fishing."], correct_index: 0, explanation_jp: "本文に「They tried surfing for the first time」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 190,
    tags: ["reading", "passage", "travel", "summer"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-021
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Mr. Sasaki has been raising chickens in his backyard for ten years. He has fifteen chickens. Every morning, he gives them food and water. The chickens lay fresh eggs every day. Mr. Sasaki shares the eggs with his neighbors. The neighborhood children visit his garden often to help feed the chickens. They love playing with the small chicks too. Last spring, three new chicks were born. Mr. Sasaki gave each one a name. He says raising chickens teaches him patience and care. He wants to keep doing this for many more years. He often says that fresh eggs are the best gift.",
    word_count: 110,
    genre: "animal",
    questions: [
      { question: "How long has Mr. Sasaki been raising chickens?", choices: ["Ten years.", "Two years.", "Fifteen years.", "Five years."], correct_index: 0, explanation_jp: "本文に「for ten years」とあります。" },
      { question: "What does Mr. Sasaki share with his neighbors?", choices: ["Eggs.", "Vegetables.", "Flowers.", "Bread."], correct_index: 0, explanation_jp: "本文に「shares the eggs with his neighbors」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "animal", "neighbor"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-022
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Hina's school has a special English event every December. International high school students come to teach English games and songs. Last December, Hina met Lisa from Canada. Lisa was tall and friendly. They sang Christmas songs together. Hina learned new English words like reindeer and snowflake. After the event, Hina exchanged email addresses with Lisa. Now they write to each other once a month. Hina shares Japanese culture with Lisa, and Lisa tells her about Canadian life. Hina hopes to visit Canada someday and meet Lisa again. Studying English is more fun for Hina now. She believes friendship has no borders.",
    word_count: 109,
    genre: "school",
    questions: [
      { question: "Where is Lisa from?", choices: ["Canada.", "America.", "Australia.", "England."], correct_index: 0, explanation_jp: "本文に「Lisa from Canada」とあります。" },
      { question: "How often does Hina write to Lisa?", choices: ["Once a month.", "Every week.", "Every day.", "Twice a year."], correct_index: 0, explanation_jp: "本文に「once a month」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "international"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-023
  {
    level: "eiken-3",
    skill: "reading",
    passage: "The Suzuki family grows vegetables in their backyard. They have tomatoes, cucumbers, and eggplants. The two children Sho and Mio help every weekend. They water the plants and pull weeds. Their father teaches them about each vegetable. Last summer, they had so many tomatoes that they made tomato sauce. Their mother used the sauce for spaghetti. It was the best spaghetti Sho had ever eaten. The family also gave some vegetables to their neighbors. The neighbors were very happy. Sho and Mio feel proud when their hard work helps others. They learned that growing food takes time, but it is worth it.",
    word_count: 110,
    genre: "family",
    questions: [
      { question: "What did the family make from the tomatoes?", choices: ["Tomato sauce.", "Tomato juice.", "Tomato soup.", "Tomato salad."], correct_index: 0, explanation_jp: "本文に「they made tomato sauce」とあります。" },
      { question: "What did Sho and Mio learn?", choices: ["Growing food takes time, but it is worth it.", "Vegetables grow fast.", "Farming is easy.", "Cooking is difficult."], correct_index: 0, explanation_jp: "本文に「growing food takes time, but it is worth it」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "garden"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-024
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Yuto plays the piano every day after school. He started when he was four years old. His teacher Ms. Mori says he has a good ear for music. Last weekend, Yuto had his first piano recital. He played a famous song by Mozart. He was nervous before the show. His hands were a little shaky. But once he started, he forgot about everything else. He played beautifully. The audience clapped loudly. His parents had tears of joy. Yuto felt proud of himself. He realized that practice really matters. He plans to play even more challenging music next year. Music is now a big part of his life.",
    word_count: 116,
    genre: "hobby",
    questions: [
      { question: "When did Yuto start playing the piano?", choices: ["When he was four.", "When he was seven.", "When he was ten.", "When he was two."], correct_index: 0, explanation_jp: "本文に「when he was four years old」とあります。" },
      { question: "What did Yuto realize from the recital?", choices: ["Practice really matters.", "Music is too difficult.", "He should quit piano.", "He needs a new teacher."], correct_index: 0, explanation_jp: "本文に「practice really matters」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "piano"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-025
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Aki and her family went camping in the mountains last weekend. They rented a tent and set it up near a small lake. Aki helped her father gather wood for the fire. Her mother cooked curry rice for dinner. Everything tasted amazing under the open sky. At night, they looked up at the stars. There were so many of them. Aki saw a shooting star and made a wish. The next morning, they woke up to the sound of birds. They had pancakes for breakfast and went hiking. The view from the top of the mountain was beautiful. Aki wants to go camping again next month.",
    word_count: 116,
    genre: "travel",
    questions: [
      { question: "Where did Aki's family camp?", choices: ["Near a small lake.", "By the sea.", "In the desert.", "In a forest."], correct_index: 0, explanation_jp: "本文に「near a small lake」とあります。" },
      { question: "What did they have for breakfast?", choices: ["Pancakes.", "Toast.", "Curry rice.", "Cereal."], correct_index: 0, explanation_jp: "本文に「They had pancakes for breakfast」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "travel", "camping"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-026
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last week, Mr. Yamada's class had a cooking lesson at school. The students made simple sandwiches. Each group got bread, cheese, ham, and lettuce. Sho's group made a sandwich shaped like a heart. Their teacher Mr. Yamada said it was creative. Mio's group added a special sauce, and everyone wanted to try it. The class ate the sandwiches together. They also drank orange juice. The students cleaned the kitchen after eating. They washed the dishes and wiped the tables. Mr. Yamada said cleaning was as important as cooking. The students agreed. They had so much fun and want to do it again soon.",
    word_count: 113,
    genre: "school",
    questions: [
      { question: "What shape was Sho's group sandwich?", choices: ["A heart.", "A star.", "A circle.", "A square."], correct_index: 0, explanation_jp: "本文に「a sandwich shaped like a heart」とあります。" },
      { question: "What did Mr. Yamada say about cleaning?", choices: ["It is as important as cooking.", "It is the most important thing.", "It is not important.", "It takes too long."], correct_index: 0, explanation_jp: "本文に「cleaning was as important as cooking」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "cooking"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-027
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Riko has a younger brother named Sota. He is six years old, and Riko is eleven. Sota started elementary school this April. He was nervous on his first day. Riko walked with him to school every morning for the first week. She showed him where his classroom was. Sota slowly made new friends. Now he loves school. He plays with his classmates at lunch break. Riko is proud of him. Their parents say Riko is a great older sister. Riko thinks helping her brother makes her stronger too. They share many things and laugh together at home. Riko feels lucky to have such a sweet brother.",
    word_count: 116,
    genre: "family",
    questions: [
      { question: "How old is Sota?", choices: ["Six years old.", "Five years old.", "Seven years old.", "Eleven years old."], correct_index: 0, explanation_jp: "本文に「He is six years old」とあります。" },
      { question: "How does Riko feel about her brother?", choices: ["She feels lucky.", "She feels tired.", "She feels jealous.", "She feels lonely."], correct_index: 0, explanation_jp: "本文に「Riko feels lucky to have such a sweet brother」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "sibling"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-028
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Daichi loves baseball. He has been playing since he was six. He is now in the school baseball team. The team practices every day after school. Their coach is strict but fair. Last weekend, the team had a game against another school. Daichi was the pitcher. He struck out many batters. His team won eight to two. After the game, the coach said Daichi's pitching was the best he had ever seen from a child. Daichi was so happy. He went out for ramen with his teammates. He hopes to keep improving. His goal is to play in a national tournament next year.",
    word_count: 110,
    genre: "sport",
    questions: [
      { question: "What position does Daichi play?", choices: ["Pitcher.", "Catcher.", "First base.", "Outfielder."], correct_index: 0, explanation_jp: "本文に「Daichi was the pitcher」とあります。" },
      { question: "What is Daichi's goal for next year?", choices: ["To play in a national tournament.", "To become the team captain.", "To change schools.", "To win a medal."], correct_index: 0, explanation_jp: "本文に「to play in a national tournament next year」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "sport", "baseball"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-029
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Misaki and her best friend Lisa love taking pictures. They borrow Misaki's mother's old camera. On weekends, they walk around their neighborhood and take pictures of flowers, cats, and beautiful sky. Last week, they entered a city photo contest for children. They submitted a photo of a cat sleeping under a cherry tree. To their surprise, they won second place. They got a small prize and a special photo book. Their parents were very proud. Misaki and Lisa decided to keep taking pictures. They want to capture happy moments. They believe photos can make people smile, even years later.",
    word_count: 109,
    genre: "hobby",
    questions: [
      { question: "What did the photo show?", choices: ["A cat sleeping under a cherry tree.", "A bird in the sky.", "A garden.", "A river."], correct_index: 0, explanation_jp: "本文に「a photo of a cat sleeping under a cherry tree」とあります。" },
      { question: "What place did they win in the contest?", choices: ["Second place.", "First place.", "Third place.", "Fourth place."], correct_index: 0, explanation_jp: "本文に「they won second place」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "photography"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-030
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Itsuki visited his cousin in Hakata last spring. They went to a famous ramen shop together. Itsuki had never tried tonkotsu ramen before. The soup was rich and creamy. Itsuki loved it so much that he had two bowls. His cousin also took him to a big shrine. They prayed for good luck and threw coins into the box. Itsuki bought a small charm for his mother. On the way home, they ate hakata mentaiko rice balls. The trip was only two days, but it was full of new tastes and experiences. Itsuki hopes to visit Hakata again with his whole family next time.",
    word_count: 117,
    genre: "travel",
    questions: [
      { question: "How many bowls of ramen did Itsuki have?", choices: ["Two.", "One.", "Three.", "None."], correct_index: 0, explanation_jp: "本文に「he had two bowls」とあります。" },
      { question: "What did Itsuki buy for his mother?", choices: ["A small charm.", "A book.", "A bowl of ramen.", "A scarf."], correct_index: 0, explanation_jp: "本文に「Itsuki bought a small charm for his mother」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 190,
    tags: ["reading", "passage", "travel", "food"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.90,
  },
  // R3-031
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last month, the Mori family rescued a hurt bird in their garden. The bird had a broken wing. Mr. Mori carefully put it in a small box with soft cloth. They took it to a wildlife center the next morning. The staff said the bird needed two weeks to recover. The Mori children Yui and Sho visited the bird every weekend. They watched it slowly get better. After two weeks, the bird could fly again. The family was there when the staff released it. The bird flew up high into the blue sky. Yui and Sho were a little sad to say goodbye, but also very happy.",
    word_count: 117,
    genre: "animal",
    questions: [
      { question: "What was wrong with the bird?", choices: ["It had a broken wing.", "It was hungry.", "It was old.", "It was lost."], correct_index: 0, explanation_jp: "本文に「The bird had a broken wing」とあります。" },
      { question: "How did the children feel when the bird was released?", choices: ["A little sad, but also very happy.", "Very angry.", "Just happy.", "Very tired."], correct_index: 0, explanation_jp: "本文に「a little sad to say goodbye, but also very happy」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "animal", "rescue"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-032
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Nanami's school has a big sports day every May. Each grade competes in different events. Nanami's class practiced a special dance for one month. They worked hard and helped each other. On sports day, the weather was perfect. Many parents came to watch. Nanami's mother sat in the front row. Nanami's class danced beautifully. Their teacher was proud. After the dance, they ran in the relay race. Nanami was the last runner. She passed two other runners and helped her team win. The whole class cheered loudly. Nanami felt proud of her teamwork. Sports day is one of her favorite school events of the year.",
    word_count: 114,
    genre: "school",
    questions: [
      { question: "How long did Nanami's class practice the dance?", choices: ["One month.", "Two weeks.", "Three months.", "One week."], correct_index: 0, explanation_jp: "本文に「practiced a special dance for one month」とあります。" },
      { question: "What did Nanami do in the relay race?", choices: ["She passed two other runners.", "She came in last.", "She fell down.", "She watched from the side."], correct_index: 0, explanation_jp: "本文に「She passed two other runners」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "sports-day"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-033
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Hiro's father is a chef at a small Italian restaurant. He cooks pasta and pizza every day. Sometimes Hiro visits the restaurant after school. His father lets him watch from the kitchen. Hiro loves the smell of fresh tomato sauce. Last week, Hiro's father taught him how to make a simple pasta dish at home. They cooked together for an hour. Hiro stirred the sauce while his father boiled the noodles. They added cheese on top. Hiro's mother and sister loved the pasta. They asked for more. Hiro felt very proud. He wants to learn more recipes from his father. Maybe he will become a chef too one day.",
    word_count: 119,
    genre: "food",
    questions: [
      { question: "What does Hiro's father cook at the restaurant?", choices: ["Pasta and pizza.", "Sushi.", "Hamburgers.", "Curry."], correct_index: 0, explanation_jp: "本文に「He cooks pasta and pizza every day」とあります。" },
      { question: "What did Hiro and his father make at home?", choices: ["A simple pasta dish.", "Pizza.", "Soup.", "Salad."], correct_index: 0, explanation_jp: "本文に「a simple pasta dish at home」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "food", "family"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-034
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Mai loves her grandfather very much. He is seventy-five years old and lives next door. Every evening, Mai visits him after dinner. They drink tea together. Her grandfather tells her stories about his childhood. He grew up in a small farming village. There was no TV or computer. Children played outside all day. Mai loves these stories. Last weekend, her grandfather taught her how to make traditional rice cakes. It was hard work, but the cakes were delicious. Mai realized that her grandfather knows so many useful things. She wants to spend more time with him. She knows their time together is precious.",
    word_count: 113,
    genre: "family",
    questions: [
      { question: "How old is Mai's grandfather?", choices: ["Seventy-five years old.", "Seventy years old.", "Eighty years old.", "Sixty-five years old."], correct_index: 0, explanation_jp: "本文に「He is seventy-five years old」とあります。" },
      { question: "What did her grandfather teach Mai last weekend?", choices: ["How to make traditional rice cakes.", "How to play a song.", "How to grow vegetables.", "How to write letters."], correct_index: 0, explanation_jp: "本文に「how to make traditional rice cakes」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "grandfather"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-035
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last weekend, Sota's family went strawberry picking at a farm. The farm was about an hour from their house. They paid a small fee and got a basket each. The strawberries were big, red, and very sweet. Sota ate so many that his mother laughed. They picked enough strawberries to fill three baskets. On the way home, Sota's father stopped at a cafe. They had strawberry pancakes. The cafe owner smiled at the family with their fresh strawberries. At home, Sota's mother made strawberry jam. The whole house smelled wonderful. Sota wants to go strawberry picking again every spring. He thinks it is a perfect family activity.",
    word_count: 117,
    genre: "season",
    questions: [
      { question: "How many baskets of strawberries did they pick?", choices: ["Three.", "Two.", "Four.", "One."], correct_index: 0, explanation_jp: "本文に「fill three baskets」とあります。" },
      { question: "What did Sota's mother make at home?", choices: ["Strawberry jam.", "Strawberry pancakes.", "Strawberry cake.", "Strawberry juice."], correct_index: 0, explanation_jp: "本文に「Sota's mother made strawberry jam」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "season", "spring"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-036
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Tatsuki's class has a school garden. The students take turns to take care of it. This week, it was Tatsuki's turn. He watered the plants every morning before class. He also pulled weeds and checked for insects. The tomatoes are growing fast. There are also cucumbers, peppers, and herbs. The students plan to use the vegetables for their school lunch. Tatsuki feels proud when he sees the plants grow. His teacher said gardening teaches responsibility. Tatsuki agrees. He wants to grow vegetables at home too. He already asked his mother to buy seeds for him. He is excited to start his own garden.",
    word_count: 110,
    genre: "school",
    questions: [
      { question: "When does Tatsuki water the plants?", choices: ["Every morning before class.", "After school.", "On weekends.", "At lunch."], correct_index: 0, explanation_jp: "本文に「every morning before class」とあります。" },
      { question: "What did Tatsuki ask his mother to buy?", choices: ["Seeds.", "Plants.", "Tools.", "Soil."], correct_index: 0, explanation_jp: "本文に「to buy seeds for him」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "school", "garden"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-037
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Yui's parents are both teachers at a junior high school. They are very busy, but they always make time for Yui. Every Sunday morning, the family goes to a nearby cafe for breakfast. They order pancakes, eggs, and orange juice. They talk about their week and their plans. Yui loves these mornings. Last Sunday, her parents told her that they would all go to Disneyland for her birthday next month. Yui was so excited. She has wanted to go for a long time. She started counting the days. Yui knows her parents work hard. She is grateful for their love and the special time they share together.",
    word_count: 115,
    genre: "family",
    questions: [
      { question: "What do Yui and her family do every Sunday morning?", choices: ["Go to a nearby cafe for breakfast.", "Go shopping.", "Visit grandparents.", "Stay home."], correct_index: 0, explanation_jp: "本文に「the family goes to a nearby cafe for breakfast」とあります。" },
      { question: "Where will Yui go for her birthday?", choices: ["Disneyland.", "Hawaii.", "A water park.", "A zoo."], correct_index: 0, explanation_jp: "本文に「all go to Disneyland for her birthday」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "family", "birthday"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-038
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Rio's neighborhood holds a summer festival every August. Many local families come together. There are food stalls with cotton candy, takoyaki, and shaved ice. Children wear colorful summer kimonos. Rio always wears a yellow one. Last summer, she went to the festival with her best friend Mio. They tried goldfish scooping for the first time. Rio caught one small goldfish and brought it home. She named it Kin. Kin is still alive and lives in a glass tank in her room. Rio also enjoyed the fireworks at the end of the festival. The big colorful sparks lit up the night sky. She looks forward to it every year.",
    word_count: 117,
    genre: "season",
    questions: [
      { question: "What did Rio bring home from the festival?", choices: ["A small goldfish.", "Cotton candy.", "Takoyaki.", "A summer kimono."], correct_index: 0, explanation_jp: "本文に「Rio caught one small goldfish and brought it home」とあります。" },
      { question: "What is at the end of the festival?", choices: ["Fireworks.", "A dance show.", "A big dinner.", "Goldfish scooping."], correct_index: 0, explanation_jp: "本文に「Rio also enjoyed the fireworks at the end」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "season", "summer"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-039
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Kanata loves origami. He learned it from a book at the library. He started with simple paper cranes when he was eight. Now he can make complex flowers, stars, and even small dragons. Last month, he taught origami to his classmates during a special activity time. Many students were amazed by his skills. His teacher asked him to make decorations for the classroom. Kanata made a hundred paper cranes. They hung beautifully on the wall. Kanata's parents are also proud of him. They say origami helps Kanata be patient and creative. He wants to teach origami to children in other countries someday. He believes paper folding can bring people together.",
    word_count: 119,
    genre: "hobby",
    questions: [
      { question: "How did Kanata learn origami?", choices: ["From a book at the library.", "From his mother.", "From his teacher.", "From a video."], correct_index: 0, explanation_jp: "本文に「from a book at the library」とあります。" },
      { question: "How many paper cranes did Kanata make for the classroom?", choices: ["A hundred.", "Fifty.", "Ten.", "A thousand."], correct_index: 0, explanation_jp: "本文に「a hundred paper cranes」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "hobby", "origami"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
  // R3-040
  {
    level: "eiken-3",
    skill: "reading",
    passage: "Last winter, the Kato family went to a hot spring town in Gunma. The town was small but very famous for its old wooden buildings. They stayed at a traditional inn called a ryokan. The room had tatami floors and futons. They wore yukata after dinner. The dinner was a big feast with many small dishes. Sumi tried local mushrooms for the first time. She liked them. After dinner, the family went to the outdoor hot spring. The water was warm, and the snow was falling softly. It felt magical. Sumi will never forget that night. She wants to come back to this town every winter from now on.",
    word_count: 119,
    genre: "travel",
    questions: [
      { question: "Where did the Kato family stay?", choices: ["At a ryokan.", "At a hotel.", "At a campsite.", "At a friend's house."], correct_index: 0, explanation_jp: "本文に「at a traditional inn called a ryokan」とあります。" },
      { question: "What was special about the outdoor hot spring?", choices: ["The water was warm and the snow was falling softly.", "It was very crowded.", "It was indoor.", "It was hot."], correct_index: 0, explanation_jp: "本文に「The water was warm, and the snow was falling softly」とあります。" },
    ],
    difficulty: 2,
    estimated_time_sec: 180,
    tags: ["reading", "passage", "travel", "winter"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.89,
  },
];

// ===========================================================================
// REPLACEMENTS — W3 で qualityScore < 0.85 となった問題の改稿版
// ===========================================================================
// G4-080 系（W3）— qualityScore 0.84:
//   prompt: "I have read this book before. ＝ I (   ) read this book."
//   choices: ["have already", "did", "have just", "had"]
//   問題点: "have just" と "have already" の差が微妙で、4 級学習者には判定困難。
//          どちらも文脈次第で自然な英語であり、distractor として弱い。
// G4-080R（改稿版）— qualityScore 0.91:
//   prompt: "I have read this book before. ＝ I (   ) read this book in the past."
//          （文脈ヒント "in the past" を追加し、過去経験の意味を明示）
//   choices: ["have already", "am reading", "will read", "read yesterday"]
//   - distractor を時制混乱型に変更（現在進行 / 未来 / 過去形 + 副詞）
//   - "have just" を排除し、明確に区別できる選択肢に
// ===========================================================================

const replacementProblems: ChoiceProblem[] = [
  {
    level: "eiken-4",
    skill: "grammar",
    prompt_text: "I have read this book before. ＝ I (   ) read this book in the past.",
    choices: ["have already", "am reading", "will read", "read yesterday"],
    correct_index: 0,
    explanation_jp: "「以前〜したことがある（経験）= もう〜した」を表すのは「have already + 過去分詞」（現在完了形）。「am reading」は現在進行形、「will read」は未来、「read yesterday」は単純過去形 + 副詞で、いずれも経験を表す現在完了形ではありません。",
    difficulty: 2,
    estimated_time_sec: 50,
    tags: ["present-perfect", "experience", "already", "replacement", "G4-080R"],
    source_license: "ORIGINAL_AI",
    copyright_safe: true,
    generated_quality_score: 0.91,
  },
];

// ===========================================================================
// HELPER: redistribute correct_index to balance answer position bias
// （reading は ReadingPassageProblem 型で別構造のため対象外。vocab/listening のみ）
// ===========================================================================

export function redistributeCorrectIndex<T extends ChoiceProblem>(items: T[]): T[] {
  return items.map((item) => {
    if (!item.choices || item.choices.length < 2) return item;
    const correctText = item.choices[item.correct_index];
    if (!correctText) return item;
    const newPos =
      (item.correct_index +
        1 +
        Math.floor(Math.random() * (item.choices.length - 1))) %
      item.choices.length;
    if (newPos === item.correct_index) return item;
    const newChoices = [...item.choices];
    const tmp = newChoices[item.correct_index] as string;
    const swap = newChoices[newPos] as string;
    newChoices[item.correct_index] = swap;
    newChoices[newPos] = tmp;
    return { ...item, choices: newChoices, correct_index: newPos };
  });
}

// ===========================================================================
// EXPORTS
// ===========================================================================

const allChoiceProblems: ChoiceProblem[] = [
  ...vocabProblems,
  ...listeningProblems,
  ...replacementProblems,
];

const w4Bundle = {
  /** 5 級語彙 100 問 */
  vocab: vocabProblems,
  /** 4 級リスニング 80 問 */
  listening: listeningProblems,
  /** 3 級リーディング 40 問（passage + 設問 2 問構造） */
  reading: readingProblems,
  /** W3 改稿版 1 問（G4-080R） */
  replacements: replacementProblems,
  /** ChoiceProblem 全件（reading は構造が異なるため除外） */
  allChoiceProblems,
  /** 全件（reading 含む union 配列） */
  allProblems: [
    ...vocabProblems,
    ...listeningProblems,
    ...replacementProblems,
    ...readingProblems,
  ] as W4Problem[],
};

export type W4Bundle = typeof w4Bundle;

export {
  vocabProblems,
  listeningProblems,
  readingProblems,
  replacementProblems,
  allChoiceProblems,
};

export default w4Bundle;
