/**
 * HANEI - Layer 1 NG ワード辞書 (子ども安全 / research-w1-legal-kidsafe.md 由来)
 *
 * 60 語以上の雛形。Phase 1 中に 100+ 語に拡張する。
 * 三重ガード Layer 1 (高速・コスト 0) として最初に検査。
 *
 * カテゴリ:
 *  - violence: 暴力
 *  - sexual: 性的
 *  - discrimination: 差別・侮辱
 *  - self-harm: 自傷・自殺
 *  - drugs: 違法薬物
 *  - bullying: いじめ
 *  - gambling: ギャンブル・酒
 *  - personal-info: 個人情報誘導
 *  - extremism: 過激思想
 */

export interface NgWordEntry {
  word: string;
  category:
    | "violence"
    | "sexual"
    | "discrimination"
    | "self_harm"
    | "drugs"
    | "bullying"
    | "gambling"
    | "personal_info"
    | "extremism";
  severity: "high" | "medium" | "low";
}

export const NG_WORDS_JA: readonly NgWordEntry[] = [
  // violence
  { word: "殺す", category: "violence", severity: "high" },
  { word: "殺し", category: "violence", severity: "high" },
  { word: "ころす", category: "violence", severity: "high" },
  { word: "殴る", category: "violence", severity: "high" },
  { word: "蹴る", category: "violence", severity: "medium" },
  { word: "刺す", category: "violence", severity: "high" },
  { word: "撃つ", category: "violence", severity: "high" },
  { word: "暴力", category: "violence", severity: "medium" },
  // sexual
  { word: "セックス", category: "sexual", severity: "high" },
  { word: "セクシー", category: "sexual", severity: "medium" },
  { word: "エロ", category: "sexual", severity: "high" },
  { word: "おっぱい", category: "sexual", severity: "high" },
  { word: "ちんこ", category: "sexual", severity: "high" },
  { word: "アダルト", category: "sexual", severity: "high" },
  { word: "わいせつ", category: "sexual", severity: "high" },
  // discrimination
  { word: "バカ", category: "discrimination", severity: "low" },
  { word: "アホ", category: "discrimination", severity: "low" },
  { word: "死ね", category: "discrimination", severity: "high" },
  { word: "クズ", category: "discrimination", severity: "medium" },
  { word: "気持ち悪い", category: "discrimination", severity: "low" },
  { word: "障害者", category: "discrimination", severity: "medium" },
  // self-harm
  { word: "自殺", category: "self_harm", severity: "high" },
  { word: "死にたい", category: "self_harm", severity: "high" },
  { word: "リストカット", category: "self_harm", severity: "high" },
  { word: "オーバードーズ", category: "self_harm", severity: "high" },
  { word: "首吊り", category: "self_harm", severity: "high" },
  // drugs
  { word: "覚醒剤", category: "drugs", severity: "high" },
  { word: "麻薬", category: "drugs", severity: "high" },
  { word: "大麻", category: "drugs", severity: "high" },
  { word: "シャブ", category: "drugs", severity: "high" },
  { word: "コカイン", category: "drugs", severity: "high" },
  { word: "ヘロイン", category: "drugs", severity: "high" },
  // bullying
  { word: "ハブ", category: "bullying", severity: "medium" },
  { word: "シカト", category: "bullying", severity: "medium" },
  { word: "つまはじき", category: "bullying", severity: "medium" },
  { word: "いじめる", category: "bullying", severity: "medium" },
  // gambling
  { word: "賭博", category: "gambling", severity: "medium" },
  { word: "パチンコ", category: "gambling", severity: "low" },
  { word: "酒", category: "gambling", severity: "low" },
  { word: "タバコ", category: "gambling", severity: "low" },
  // personal_info
  { word: "本名教えて", category: "personal_info", severity: "high" },
  { word: "住所教えて", category: "personal_info", severity: "high" },
  { word: "電話番号", category: "personal_info", severity: "high" },
  { word: "学校名", category: "personal_info", severity: "high" },
  { word: "クラス名", category: "personal_info", severity: "medium" },
  // extremism
  { word: "テロ", category: "extremism", severity: "high" },
  { word: "爆弾", category: "extremism", severity: "high" },
  { word: "武器", category: "extremism", severity: "medium" },
] as const;

export const NG_WORDS_EN: readonly NgWordEntry[] = [
  { word: "kill", category: "violence", severity: "high" },
  { word: "die", category: "violence", severity: "medium" },
  { word: "stupid", category: "discrimination", severity: "low" },
  { word: "idiot", category: "discrimination", severity: "low" },
  { word: "fuck", category: "discrimination", severity: "high" },
  { word: "shit", category: "discrimination", severity: "high" },
  { word: "damn", category: "discrimination", severity: "low" },
  { word: "sex", category: "sexual", severity: "high" },
  { word: "porn", category: "sexual", severity: "high" },
  { word: "drug", category: "drugs", severity: "medium" },
  { word: "suicide", category: "self_harm", severity: "high" },
  { word: "bomb", category: "extremism", severity: "high" },
  { word: "gun", category: "violence", severity: "medium" },
  { word: "drunk", category: "gambling", severity: "low" },
] as const;

/**
 * 入力テキスト中に NG ワードがあれば、ヒットしたエントリを返す。
 */
export function findNgWords(text: string): NgWordEntry[] {
  const hits: NgWordEntry[] = [];
  const lower = text.toLowerCase();
  for (const entry of NG_WORDS_JA) {
    if (text.includes(entry.word)) hits.push(entry);
  }
  for (const entry of NG_WORDS_EN) {
    if (lower.includes(entry.word)) hits.push(entry);
  }
  return hits;
}

/**
 * 出力フィルタ: NG ワードを「***」でマスク
 */
export function maskNgWords(text: string): string {
  let out = text;
  for (const entry of NG_WORDS_JA) {
    out = out.replaceAll(entry.word, "*".repeat(entry.word.length));
  }
  // EN は大文字小文字を区別せずマスク (簡易版)
  for (const entry of NG_WORDS_EN) {
    const re = new RegExp(entry.word, "gi");
    out = out.replace(re, "*".repeat(entry.word.length));
  }
  return out;
}

export const NG_WORDS_TOTAL_COUNT =
  NG_WORDS_JA.length + NG_WORDS_EN.length;
