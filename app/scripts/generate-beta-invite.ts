/**
 * scripts/generate-beta-invite.ts (W12-T3-A / DEC-069)
 *
 * 用途:
 *   - 運営者がローカルから β 招待コードを N 件生成し、`beta_invite_codes` に
 *     直接 INSERT する CLI スクリプト.
 *   - 標準出力に生成済コード一覧を表示する (運営者がメール / Discord 等で β
 *     ユーザーに配布).
 *
 * 実行例:
 *   tsx --env-file=.env.local scripts/generate-beta-invite.ts --count=10
 *   tsx --env-file=.env.local scripts/generate-beta-invite.ts --count=5 \
 *       --max-redemptions=3 --note="early-beta-2026-05" --expires-days=30
 *
 * 引数:
 *   --count=N            生成する招待コード数 (default 1 / 1..1000)
 *   --max-redemptions=N  1 コードあたりの最大 redeem 回数 (default 1)
 *   --note="..."         発行メモ (任意 / DB に保存 / 配布履歴管理用)
 *   --expires-days=N     有効期限 (今から N 日後 / 未指定 = 無期限)
 *   --created-by="..."   発行者識別子 (任意 / 例: "ceo" / "dev")
 *
 * 設計 (DEC-069):
 *   - 招待コード生成は src/lib/beta/invite-codes.ts 純関数を呼ぶだけ.
 *   - DB 接続先は process.env.TURSO_DATABASE_URL (drizzle-config と同じ規約).
 *   - 衝突時は最大 5 回まで再抽選. 5 回失敗 = 異常 (=> non-zero exit).
 *   - admin UI 不要. β 期間中は数十〜数百件規模で運営者手動発行.
 *
 * 三層認可 (DEC-003):
 *   - 本スクリプトは運営者ローカルから直接 DB に書く = web ルート / API surface に
 *     一切露出しない (DEC-006 mutation 5 不変条件遵守).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { betaInviteCodes } from "@/lib/db/schema";
import {
  generateInviteCode,
  validateInviteCodeFormat,
} from "@/lib/beta/invite-codes";

interface ParsedArgs {
  count: number;
  maxRedemptions: number;
  note: string | null;
  expiresAt: Date | null;
  createdBy: string | null;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
  const get = (key: string): string | null => {
    for (const a of argv) {
      if (a.startsWith(`--${key}=`)) return a.slice(`--${key}=`.length);
    }
    return null;
  };

  const countRaw = get("count");
  const count =
    countRaw !== null && /^\d+$/.test(countRaw) ? Number(countRaw) : 1;
  if (count < 1 || count > 1000) {
    throw new Error(`--count は 1..1000 の範囲で指定してください (got=${count})`);
  }

  const maxRedRaw = get("max-redemptions");
  const maxRedemptions =
    maxRedRaw !== null && /^\d+$/.test(maxRedRaw) ? Number(maxRedRaw) : 1;
  if (maxRedemptions < 1) {
    throw new Error(
      `--max-redemptions は 1 以上で指定してください (got=${maxRedemptions})`,
    );
  }

  const note = get("note");

  const expiresDaysRaw = get("expires-days");
  let expiresAt: Date | null = null;
  if (expiresDaysRaw !== null) {
    const days = Number(expiresDaysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(
        `--expires-days は正の数で指定してください (got=${expiresDaysRaw})`,
      );
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const createdBy = get("created-by");

  return { count, maxRedemptions, note, expiresAt, createdBy };
}

async function generateUniqueCode(): Promise<string> {
  // 衝突 (UNIQUE 違反) はまず発生しないが、構造的安全網として 5 回まで再抽選.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const fmt = validateInviteCodeFormat(code);
    if (!fmt.ok) continue;
    const existing = await db
      .select({ id: betaInviteCodes.id })
      .from(betaInviteCodes)
      .where(eq(betaInviteCodes.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("招待コード生成: 5 回衝突しました. alphabet/length 設定を確認してください.");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();

  console.log("[beta-invite] 生成設定:", {
    count: args.count,
    maxRedemptions: args.maxRedemptions,
    note: args.note,
    expiresAt: args.expiresAt ? args.expiresAt.toISOString() : "(無期限)",
    createdBy: args.createdBy,
  });

  const generated: Array<{ id: string; code: string }> = [];
  for (let i = 0; i < args.count; i += 1) {
    const code = await generateUniqueCode();
    const id = `bic_${cryptoRandomId()}`;
    await db.insert(betaInviteCodes).values({
      id,
      code,
      createdBy: args.createdBy,
      note: args.note,
      maxRedemptions: args.maxRedemptions,
      redemptionCount: 0,
      expiresAt: args.expiresAt,
      disabledAt: null,
      createdAt: now,
    });
    generated.push({ id, code });
  }

  console.log(`\n[beta-invite] 生成済 ${generated.length} 件:`);
  for (const g of generated) {
    console.log(`  ${g.code}    (id=${g.id})`);
  }
  console.log("\n配布時は code のみを案内してください (id は内部識別子).");
}

function cryptoRandomId(): string {
  // 衝突懸念のない短 id (UUID v4 のハイフン除去後 12 文字).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[beta-invite] 失敗: ${msg}`);
  process.exitCode = 1;
});
