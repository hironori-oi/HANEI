/**
 * HANEI - A/B Test Experiments Catalog (W12-T2 / DEC-066)
 *
 * 純関数のみ / DB I/O 0 / DOM-free / DB-free.
 *
 * 不変条件 (Turbopack `"use server"` sync export ban / 7 度目適用):
 *   - 純関数のみ. `"use server"` directive 不使用.
 *   - server-only モジュール (assignment.ts) からも、Server Component (admin/kpi/page.tsx) からも
 *     直接 import 可能 (純関数だから副作用伝搬なし).
 *   - W11-T1 / W11-T2 / W11-T3 / W11-T5 / W11-T5 / W12-T1 で確立した「純関数を server-only ファイル外に
 *     隔離する」パターンの 7 度目再適用.
 *
 * 設計指針 (DEC-024 罰則ゼロ哲学 / DEC-066):
 *   - 内部運営 catalog でも罰語不在 (「失敗」「劣位」「最下位」等は使用しない / 中立トーン).
 *   - variant の label は admin 表示にも露出しうるため平仮名中心 + 中立コピー.
 *
 * 認可境界 (DEC-003 三層認可 / 構造的担保):
 *   - 純関数は family scope を意識しなくてよい (構造データのみ受け取る).
 *   - cohort 割当の deterministic hash 入力は呼び出し元責任 (= "${learnerId}:${experimentKey}").
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 1 つの variant 定義 (key + 重み + 表示 label). */
export interface VariantDef {
  /** variant 識別子 (例: "control" / "variant_a"). */
  key: string;
  /** 重み (任意の正整数 / 合計が 100 以外でも比率で正規化). */
  weight: number;
  /** admin / 内部運営向け表示 label. */
  label: string;
}

/** 1 つの experiment 定義. */
export interface ExperimentDef {
  /** experiment 識別子 (例: "streak_freeze_monthly_grant"). */
  key: string;
  /** 内部運営向け説明 (中立トーン). */
  description: string;
  /** variants. 重み合計 0 / 空配列は assignVariant で throw する. */
  variants: ReadonlyArray<VariantDef>;
  /** 取得失敗時 / variant 未設定時の defaultVariant key (catalog の variants[].key と一致必須). */
  default: string;
}

// ---------------------------------------------------------------------------
// EXPERIMENTS Catalog
// ---------------------------------------------------------------------------

/**
 * HANEI で稼働する A/B test catalog.
 *
 * 初回 (W12-T2): `streak_freeze_monthly_grant` 1 件のみ.
 *   - 月次 streak freeze 自動付与の枚数を比較する catalog 登録のみ.
 *   - 実際の grant 適用ロジックは W12-T2.5 atomic で別途実装する (本 atomic 範囲外).
 *   - control = 1 枚 / variant_a = 2 枚 で 50/50 deterministic 割当.
 */
export const EXPERIMENTS = {
  streak_freeze_monthly_grant: {
    key: "streak_freeze_monthly_grant",
    description: "月次 streak freeze 自動付与の枚数",
    variants: [
      { key: "control", weight: 50, label: "1 枚 (control)" },
      { key: "variant_a", weight: 50, label: "2 枚" },
    ],
    default: "control",
  },
} as const satisfies Record<string, ExperimentDef>;

/** EXPERIMENTS の key 列挙型 (catalog 拡張時に自動的に narrow される). */
export type ExperimentKey = keyof typeof EXPERIMENTS;

// ---------------------------------------------------------------------------
// FNV-1a 32-bit hash (deterministic / 依存無し / Edge runtime 互換)
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash. 同一 string → 同一 32-bit unsigned 整数を返す.
 *
 *  - 依存無し / Edge runtime 互換 (`crypto.subtle` 不使用 / `Buffer` 不使用).
 *  - charCodeAt のみ使用するため UTF-16 BMP 内文字は安全に扱える.
 *  - 50/50 割当の精度を担保する程度の分布性があれば十分.
 */
function fnv1a32(input: string): number {
  // FNV offset basis (32-bit)
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // FNV prime (32-bit) = 16777619, but Math.imul is safer for 32-bit overflow
    hash = Math.imul(hash, 0x01000193);
  }
  // unsigned 32-bit に丸める
  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// assignVariant: deterministic な variant 割当
// ---------------------------------------------------------------------------

/**
 * 決定論的に variant を割り当てる純関数.
 *
 *  - 同一 seed × 同一 variants → 必ず同じ variant.key が返る (deterministic).
 *  - 異なる seed なら weight 比率に従って分布する (FNV-1a 32-bit / 50/50 で約 ±0.5% 以内に収束).
 *  - 空 variants → throw (catalog 登録ミスを防御).
 *  - weight 合計 0 / 負値 → throw (catalog 登録ミスを防御).
 *  - 単一 variant (weight > 0) → 必ずその variant.
 *
 * @param seed - hash 入力 (推奨 = `${learnerId}:${experimentKey}`)
 * @param variants - variant 候補 (weight > 0 の合計が正であること)
 */
export function assignVariant(
  seed: string,
  variants: ReadonlyArray<VariantDef>,
): string {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error(
      "[experiments-catalog] assignVariant: variants must be a non-empty array",
    );
  }
  let totalWeight = 0;
  for (const v of variants) {
    if (
      !v ||
      typeof v.key !== "string" ||
      typeof v.weight !== "number" ||
      !Number.isFinite(v.weight) ||
      v.weight < 0
    ) {
      throw new Error(
        "[experiments-catalog] assignVariant: invalid variant (key/weight)",
      );
    }
    totalWeight += v.weight;
  }
  if (totalWeight <= 0) {
    throw new Error(
      "[experiments-catalog] assignVariant: total weight must be > 0",
    );
  }
  // 0..(totalWeight - 1) の整数バケットに落とす
  const hash = fnv1a32(seed);
  // hash は uint32. totalWeight 単位の bucket index に落とす (整数演算で十分).
  // weight が 50 / 50 のような小さい合計でも uint32 の解像度から十分均等になる.
  const bucket = hash % totalWeight;
  let cum = 0;
  for (const v of variants) {
    cum += v.weight;
    if (bucket < cum) {
      return v.key;
    }
  }
  // 浮動小数点なし整数演算なので理論上ここに来ないが、防御的に末尾 variant を返す
  return variants[variants.length - 1]!.key;
}

// ---------------------------------------------------------------------------
// validateExperimentsJson: DB から読み込んだ JSON を防御的に正規化
// ---------------------------------------------------------------------------

/**
 * `learner_profiles.experiments` JSON を防御的に正規化する純関数.
 *
 *  - 期待 shape: `Record<string, string>` (experimentKey → variantKey).
 *  - null / undefined / 配列 / 非 object / number / string / boolean → `{}`.
 *  - object 内の非 string value は除外 (key だけ残らないように entry ごと drop).
 *  - 元値は破壊しない.
 */
export function validateExperimentsJson(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && v.length > 0) {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 小さな lookup helper
// ---------------------------------------------------------------------------

/** catalog に該当 key が存在するかを返す純関数. */
export function isKnownExperiment(key: string): boolean {
  if (typeof key !== "string" || key.length === 0) return false;
  return Object.prototype.hasOwnProperty.call(EXPERIMENTS, key);
}

/** catalog から ExperimentDef を取り出す (未知なら undefined). */
export function getExperimentDef(key: string): ExperimentDef | undefined {
  if (!isKnownExperiment(key)) return undefined;
  return (EXPERIMENTS as Record<string, ExperimentDef>)[key];
}
