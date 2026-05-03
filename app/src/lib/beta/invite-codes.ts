/**
 * HANEI - β Invite Code Pure Helpers (W12-T3-A / DEC-069)
 *
 * Turbopack `"use server"` sync export ban パターン 9 度目構造定着:
 *  - "use server" 不在 / DOM-free / DB-free / 純関数のみ.
 *  - signup action / scripts / unit test の全方向から import 可能.
 *  - DB 副作用や Next.js runtime API への依存ゼロ.
 *
 * 招待コード仕様 (DEC-069):
 *  - 長さ 8 文字 / 大文字英数のみ.
 *  - 紛らわしい文字 `0` / `O` / `1` / `I` / `L` は alphabet から除外.
 *    (= 配布時の誤読を構造的に減らす — 子ども/保護者が手入力するシナリオ)
 *  - normalize 後にのみ DB 比較する (trim + uppercase + 内部空白除去).
 *  - 形式検証は normalize 後の値に対して行う = 早期 fail で DB SELECT 削減.
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - 本ファイルは形式検証のみで「コードを確認してください」相当のメッセージを
 *    返す責務は持たない (= signup action / page.tsx で中立文言に整形).
 *
 * 環境変数:
 *  - BETA_INVITE_REQUIRED === "true" のときのみ signup で invite_code が必須化される.
 *  - dev / staging / E2E は default `false` で既存挙動維持 (regression 0).
 */

/** 招待コード長 (固定 / scripts / signup / unit から共有) */
export const INVITE_CODE_LENGTH = 8 as const;

/**
 * 招待コードに使う文字集合 (大文字英数 / `0` `O` `1` `I` `L` 除外).
 *
 * 31 文字 = 26 (英大文字) + 10 (数字) - 5 (除外).
 *  - 0 / O は「ゼロとオー」混同
 *  - 1 / I / L は「イチ・アイ・エル」混同
 *  - generateInviteCode は crypto.randomBytes ベースで一様分布 (rejection sampling).
 */
export const INVITE_CODE_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZ23456789" as const;

/**
 * 招待コードを正規化する純関数.
 *  - trim 前後空白除去.
 *  - 内部空白 (空白 / タブ / 改行) を全削除 ("AB CD-EFGH" → "ABCD-EFGH").
 *  - uppercase で大文字統一.
 *  - ハイフン等の区切り文字は除去しない (validateInviteCodeFormat の alphabet 検証で
 *    弾く / 形式違反として扱う).
 *
 * @param input - 生入力 (form 値 / CLI 引数 / 配布コピーペースト想定).
 * @returns 正規化済の比較・検証用文字列. null / undefined / 非文字列は "" を返す.
 */
export function normalizeInviteCode(input: unknown): string {
  if (typeof input !== "string") return "";
  // 内部空白系を全削除 (\u3000 全角スペース含む) してから uppercase.
  return input.replace(/[\s\u3000]+/g, "").toUpperCase();
}

/** 形式検証の結果型 (合格時はそれ以上の理由を返さない / 不合格時のみ reason). */
export type InviteCodeFormatResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "length" | "alphabet" };

/**
 * 招待コードの形式検証 (DB 参照不要 / 早期 fail / Turbopack 制約遵守).
 *  - 1) empty: 空文字 (normalize 後 "").
 *  - 2) length: 長さが INVITE_CODE_LENGTH と一致しない.
 *  - 3) alphabet: 1 文字でも INVITE_CODE_ALPHABET に含まれない.
 *
 * `{ ok: true }` を返した場合のみ DB SELECT に進む (signup action 規約).
 *
 * @param code - normalize 済 想定 (呼び出し側が normalizeInviteCode を先に通すこと).
 *               生入力を渡しても動くが、空白未除去で length 不一致になる可能性がある.
 */
export function validateInviteCodeFormat(code: string): InviteCodeFormatResult {
  if (typeof code !== "string" || code.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (code.length !== INVITE_CODE_LENGTH) {
    return { ok: false, reason: "length" };
  }
  for (const ch of code) {
    if (!INVITE_CODE_ALPHABET.includes(ch)) {
      return { ok: false, reason: "alphabet" };
    }
  }
  return { ok: true };
}

/**
 * 暗号学的乱数で招待コードを 1 件生成する純関数.
 *
 * 設計:
 *  - node:crypto.randomBytes を使用 (Math.random は非暗号 = 衝突や予測攻撃に弱い).
 *  - alphabet 31 文字に対して rejection sampling: 256 / 31 = 8.258... の余り部分
 *    (256 - (256 % 31) = 248) を超えるバイトは捨てて再抽選 (一様分布担保).
 *  - 8 文字なので生成失敗確率は実用上ゼロ (250 試行で 1e-13 程度の上限).
 *
 * @returns 8 文字 / 大文字英数 / `0/O/1/I/L` 除外 / 一様分布の招待コード.
 */
export function generateInviteCode(): string {
  // dynamic require 風: crypto を eager import.
  // node:crypto は edge runtime でも提供されるが、本関数は scripts/CLI + signup
  // (server runtime) のみで呼ばれるため node 側だけ考慮すれば十分.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  const alphabet = INVITE_CODE_ALPHABET;
  const alphabetLen = alphabet.length;
  // 一様分布のため 256 を alphabetLen で割った余りを超えるバイトは reject.
  const threshold = 256 - (256 % alphabetLen);
  const out: string[] = [];
  // 余裕を持たせて 4 倍程度のバイトを取り、足りなければ追加抽選.
  let pool = randomBytes(INVITE_CODE_LENGTH * 4);
  let cursor = 0;
  while (out.length < INVITE_CODE_LENGTH) {
    if (cursor >= pool.length) {
      pool = randomBytes(INVITE_CODE_LENGTH * 4);
      cursor = 0;
    }
    const b = pool[cursor++];
    if (b === undefined) continue; // noUncheckedIndexedAccess 対策 (実際は到達しない)
    if (b < threshold) {
      const ch = alphabet[b % alphabetLen];
      if (ch !== undefined) out.push(ch);
    }
  }
  return out.join("");
}

/**
 * `BETA_INVITE_REQUIRED === "true"` の env flag を読み取る純関数.
 *  - dev / staging / E2E では default false (= signup 既存挙動完全維持 / regression 0).
 *  - 本番のみ true にして β 招待ゲーティングを有効化する運用想定.
 *
 * 注意: 純関数だが process.env を直接参照するため、テストでは `vi.stubEnv` 等で
 *       上書きすること.
 */
export function isBetaInviteRequired(): boolean {
  return process.env.BETA_INVITE_REQUIRED === "true";
}
