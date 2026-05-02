# Review Report W12-T2.5 / DEC-067

## Verdict

APPROVE (commit / push GO = yes)

## Summary

CEO trust-but-verify (typecheck / lint warning 0 / vitest 53 files 801 PASS / next build 25 routes / E2E shop 6 PASS / admin-kpi-experiment 2 PASS) を独立追検証として 5 ファイル / +269 行を逐一精査。8 観点すべてグリーン。Critical 0 / Major 0 / Minor 1 / Nit 2。Minor は cron loop の per-row fail-soft が既存設計通り未導入の点 (本 atomic では DEC-067 で scope 外と明示済) であり commit blocker ではない。

## Counts

- Critical: 0
- Major: 0
- Minor: 1
- Nit: 2

## Minor (1)

### M-1: monthly grant ループに per-row try/catch fail-soft が無い (既存設計継承 / 本 atomic 範囲外)

- File: src/app/api/cron/streak-freeze-monthly/route.ts:65-95
- 内容: monthly grant ループ全体が単一外側 try/catch で囲まれているため、ある learner の getOrAssignVariant が throw (例: learner_profiles row 不在 / DB 一時エラー) すると、その時点でループ break + 後続 learner の grant も exam-bonus loop もまとめて中断される。W8-T1 既存設計の継承であり、本 atomic 自体は CEO 推奨 Promise.all + per-task fail-soft に reach する規模ではない。後続 atomic で cron route 全体の per-row fail-soft 化を別 atomic として分離検討推奨。本 atomic の commit blocker ではない (DEC-067 で cron route 全体の純関数化リファクタは別 atomic と整合)。

## Nit (2)

### N-1: resolveStreakFreezeGrantTickets の最後の nullish coalescing 1 は dead branch

- File: src/lib/experiments/streak-freeze-variants.ts:52
- 内容: hasOwnProperty.call で hit したあとの map lookup は、map に登録されている key の値が必ず数値 (1 / 2) であるため fallback 1 経路は到達しない。多層防御として残置可。コメント追記で意図明示推奨。

### N-2: route.ts レスポンス JSON の monthlyGrantedByVariant 初期値が空 object

- File: src/app/api/cron/streak-freeze-monthly/route.ts:60
- 内容: 月初以外 (monthlyGrant === false) のときレスポンスは monthlyGrantedByVariant が空 object となる。observability 上、外部監視が control / variant_a key 常時存在前提を持つと undefined アクセスになる可能性。利用者側 fallback 0 で吸収するのが慣例で、現状実装は spec 通り。ドキュメント側で月初以外は空 object を明記推奨。

## 8 観点すべての適合確認

| 観点 | 判定 | 1 行根拠 |
|------|------|----------|
| DEC-024 罰則ゼロ哲学 | OK | grantFreezeTicketsN が内部で grantFreezeTicket を呼ぶため FREEZE_MAX_TICKETS=2 上限が構造的に伝播 / variant_a でも 2 枚で打ち止め / 罰語 grep 0 件 (cron / variants / unit test 全て) / 中立トーン doc-comment で貯まりすぎ抑止思想を明記。 |
| DEC-003 三層認可 | OK | cron 認可 (x-vercel-cron-signature or Bearer CRON_SECRET) は完全不変 / getOrAssignVariant は learner ID 受領のみで auth-agnostic / cron は全 streaks 対象なので所有権概念無し / family / learner row は新たに露出していない。 |
| DEC-006 API surface 不変 | OK | 新規 server action 0 / 新規 route 0 / cron route signature (GET + POST=GET alias) 不変 / next build 25 routes 不変 / レスポンス JSON は追加フィールド (monthlyGrantedLearners / monthlyGrantedByVariant) のみで monthlyGranted を含む既存フィールド保持 (後方互換)。 |
| DEC-055 idempotency triple guarantee | OK | (a) getOrAssignVariant の existing-valid 早期 return で DB write 0 / (b) grantFreezeTicketsN の granted false early break で上限到達後 no-op / (c) isFirstDayOfMonthJst で月 1 回限定 / 同日 cron 二重起動でも streaks.freezeTickets は max 上限到達のため変化なし。 |
| Turbopack use-server sync export ban | OK | streak-freeze-variants.ts に use server directive 不在 (コメント文字列言及のみ) / DOM-free / DB-free / experiments-catalog.ts を import せず独立分離 / Server Component / cron / Server Action から直 import 可能 / 8 度目の構造定着パターン適合。 |
| W8 既存 grantFreezeTicket 不変 | OK | 既存関数 (streak-freeze.ts:79-86) は完全に未改変 / git diff で関数本体に -/+ 0 行 / 既存 grantFreezeTicket 単独 unit test と applyStreakFreeze / applyLearnDayUpdate 全件 regression 0 (53 files / 801 PASS = baseline 782 + 新規 19)。 |
| catalog vs variants map 整合 | OK | catalog の variants key 集合 = control variant_a と map の key 集合が完全一致 / unit test の構造ガードで variants 各 key + default key が map に存在を実行時検証 / 将来 catalog 拡張時の構造防衛 OK。 |
| scope creep 確認 | OK | 受験 30 日前ボーナスループ (route.ts:97-136) は完全不変 / cron route 全体の純関数化リファクタは未実施 / 2 件目以降 experiment 登録は未実施 / DEC-067 含まない全項目を遵守 / 純粋追加 +269 行のうち削除はわずか -3 行 (旧 monthlyGranted 加算ロジックの差し替え) のみ。 |

## 副次観点の確認

- grantFreezeTicketsN 防御: NaN / Infinity を 0 化、負値 / 0 で no-op、非整数で Math.floor、n=100 でも上限 2 で打ち止め (unit test 10 ケース網羅 / study.streak-freeze.test.ts:98-153)。
- prototype-pollution 防御: Object.prototype.hasOwnProperty.call (variants.ts:45) / unit test で toString / __proto__ / hasOwnProperty の 3 ケース fallback 1 枚を検証。
- catalog vs variants map 整合性 unit guard: test file:59-82 で構造的 guard 実施 / default key も含む。
- monthlyGranted 意味変更の後方互換: monthlyGrantedLearners 別フィールドで併記し、外部監視がこちらに切り替えれば旧挙動を再現可能。コメント明示済 (route.ts:55-57 / 146-150)。
- SQL injection: getOrAssignVariant 内で experimentKey は drizzle template literal の bind parameter として渡されており sql.raw 不使用 (assignment.ts:121-128) / 本 atomic で assignment.ts への変更は 0 行 (W12-T2 既存実装そのまま) / 新規 SQL 構築なし。
- grantFreezeTicketsN の代数的一貫性: 内部で grantFreezeTicket を n 回呼ぶ実装で early break 担保 / 直接 n 回呼んだ場合と等価な結果を返すことを 10 ケースで検証。

## commit / push GO 判定

yes

### 理由

1. Critical / Major 0 件 / Minor 1 件は既存設計継承 + DEC-067 で scope 外と明示済 / Nit 2 件は dead branch + ドキュメント追記レベル。
2. 8 観点すべてグリーン (DEC-024 / DEC-003 / DEC-006 / DEC-055 / Turbopack ban / W8 既存関数不変 / catalog vs variants 整合 / scope creep)。
3. CEO trust-but-verify (typecheck / lint warning 0 / vitest 53 files 801 PASS / next build 25 routes / E2E shop 6 PASS / admin-kpi-experiment 2 PASS) と独立確認結果が完全一致。
4. W12-T2 で catalog 登録のみだった streak_freeze_monthly_grant experiment が本 atomic で実走化 (DEC-067 主旨達成)。
5. monthlyGrantedByVariant 観測性確保により、次回月初発火時のログ + dashboard 経由で A/B test の現実コホート動向を測定開始可能。

## 後続提案

- W12-T1.5 KPI 拡張 polish: 模試結果分布 + DEC-066 Minor 2 / Nit 1 吸収 (0.25 人日 / P1)。
- cron per-row fail-soft 化 (本レビュー Minor M-1): cron route 全体の純関数化 + Promise.all + per-task try/catch (0.5 人日 / P2 / scope 拡大のため別 atomic)。
- W12-T3 ベータユーザー受入準備 (DEC-067 後続候補 / 1.5 人日 / P0)。

## レビュー委任経路

- レビュー部門 で CEO 経由 trust-but-verify 独立追確認完了 / commit and push GO 判定。
