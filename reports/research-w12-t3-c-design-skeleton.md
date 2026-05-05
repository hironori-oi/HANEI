# PRJ-016 HANEI - W12-T3-C 設計骨子調査レポート（research / 2026-05-05）

## 0. メタ情報

- **対象 atomic**: W12-T3-C「緊急 hotfix 体制 + Sentry alert 強化 + α→β 移行アナウンス」
- **位置付け**: W12-T3 を 3 atomic に分解した第 3 弾（T3-A 完遂 / T3-B 実装中 → T3-C は本骨子の次 atomic で dev が実装）
- **本レポートの種類**: 調査・設計骨子のみ。コード変更ゼロ。実装は dev 部門が次 atomic で担当。
- **書き込みファイル**: 本ファイル 1 件のみ（`projects/PRJaa-016/reports/research-w12-t3-c-design-skeleton.md`）。
- **継承制約**: DEC-024 罰則ゼロ / DEC-006 GET 10 / mutation 5 不変 / DEC-003 三層認可 / DEC-013 Vercel Pro 単一プラン / DEC-055 idempotency。

---

## 1. 背景

### 1.1 直前の経緯

- **DEC-069 (T3-A 完遂)**: β 招待コード生成 + redeem 動線実装済。`BETA_INVITE_REQUIRED=true` で本番 signup gate 起動 / CLI 発行 (`scripts/generate-beta-invite.ts`)。**β ユーザーを「迎え入れる」インフラは完了**。
- **DEC-070 (T3-B 着手中)**: Sentry SDK 既存基盤完全流用の feedback 収集動線 (`Sentry.captureFeedback()` 経由)。完全 client-only / 新規 DB / Server Action / API route ゼロ。**β ユーザーから「声を受け取る」窓口が完了見込み**。
- **T3-C 前提**: 「迎え入れる」「声を受け取る」が揃った後の **「壊れたときに直す」「壊れる前に気づく」「迎え入れる準備が整ったことを知らせる」** の 3 軸を整備する atomic。

### 1.2 T3-C が解決する 3 つの欠落

| 欠落 | 現状 | T3-C 後の到達点 |
|---|---|---|
| **緊急時の手順書ゼロ** | `DEPLOYMENT.md §11` に 2 行だけ「Vercel Dashboard → Promote / DB は手動 SQL」と記載のみ | `RUNBOOK.md` に incident detection → triage → hotfix → re-deploy の完全フロー |
| **Sentry alert 未設定** | DSN は設定済 / SDK は init 済 / `tracesSampleRate: 0.1` / `replaysOnErrorSampleRate: 1.0` だが **alert ルールはコード側で何も指定なし**（= Sentry プロジェクト UI で人間が設定すべき範囲が未着手） | Sentry プロジェクト UI に何を設定するかの「運営者向け checklist」+ コード側で必要な ENV flag 整備 |
| **α→β 移行アナウンス未起草** | LP footer `現在クローズドβ準備中` のみ。既存 α ユーザー（仮に存在する場合の）への通知文面なし | メール文面草案 + LP 文言更新案 + Sentry user_feedback 連動 |

### 1.3 「α」の解釈について（重要 / CEO 確認推奨）

- HANEI は Phase 1 W10 までで **クローズド α** を「30〜50 家庭」想定で設計（Marketing 提案 = DEC-010 / A-05 採用）。
- ただし decisions.md 全文 grep の結果、**実際に α ユーザーに招待を出した形跡は見当たらない**（`α / alpha / アルファ` ヒット 10 件のうち α ユーザー実在を示す記述ゼロ / 設計時の想定文書のみ）。
- したがって T3-C のアナウンスは **(a) 既存 α ユーザー宛て** ではなく **(b) これから β に招待する全候補者向けの「β 公開開始のお知らせ」テンプレ** として設計するのが現実的。
- **CEO への確認事項 (T3-C DEC 起票時)**: 「α ユーザー実在数は 0 名で良いか / 1 名以上いる場合は別途名簿提示を依頼する」。

---

## 2. A. 緊急 hotfix 体制 / RUNBOOK 章立て案

### 2.1 推奨ファイル配置

- **新規ファイル**: `app/RUNBOOK.md`（`DEPLOYMENT.md` と同階層）
- **理由**: `DEPLOYMENT.md` は「初回構築手順」、`RUNBOOK.md` は「運用中の異常時対応」。役割を分離する慣習に従う（Google SRE / GitHub runbook pattern）。
- **ファイルサイズ目安**: 200〜300 行（過剰な分量は緊急時に読まれない）。

### 2.2 章立て（dev 実装時のテンプレ）

```markdown
# HANEI RUNBOOK

## 0. このファイルの使い方
  - β 期間中の incident 発生時に最初に開く
  - 5 分以内に切り分け → 30 分以内に hotfix or rollback の判断基準

## 1. 連絡先 / on-call 体制
  - **オーナー単独運用前提（個人開発）**
  - 通知チャネル: Sentry → email（オーナー個人アドレス）+ Slack（任意 / Phase 3）
  - 二次連絡先なし（β 期間中は許容 / DEC-013 個人開発前提整合）

## 2. Severity 区分（暫定）
  - **SEV-1**: signup / login が完全に動かない（β ユーザー新規受入不可）→ 30 分以内 rollback or hotfix
  - **SEV-2**: study flow（問題回答 / submitAnswer）で error event spike → 2 時間以内
  - **SEV-3**: 個別機能（ハネキン shop / streak freeze grant cron 等）の障害 → 当日中
  - **SEV-4**: UI 軽微な乱れ / 文言誤り → 翌営業日

## 3. Critical Path 一覧（β 期間中の最優先監視対象）
  - **必須 critical**: signup（invite redeem 含む）/ login / verify-email / study (submitAnswer) / parent dashboard 主要 4 card
  - **準 critical**: streak freeze grant cron / weekly digest cron / shop 購入 / accessory 装着
  - **β 範囲外（payment 系）**: **DEC-006 / DEC-012 により Phase 1 / 2 完全無料 = payment フロー実装ゼロ = critical path 対象外**（Phase 3 で再評価）

## 4. Incident Response フロー（5 ステップ）
  ### 4.1 検知
    - Sentry email / Vercel Deployment Alert / 手動報告（β ユーザー feedback）の 3 経路
  ### 4.2 切り分け（5 分以内）
    - Sentry Issue を開く → スタックトレース + breadcrumb 確認 → 影響範囲 (1 user / 全体) を判定
    - Vercel Deployments で直前 push 時刻を確認（regression か否か）
  ### 4.3 判断（rollback or hotfix）
    - 直前 push 起因 + SEV-1/2 → **即 rollback**（§5 へ）
    - それ以外 → **hotfix**（§6 へ）
  ### 4.4 実行（rollback / hotfix）
    - §5 / §6 参照
  ### 4.5 事後
    - Sentry Issue を Resolved にマーク
    - decisions.md に「§hotfix-YYYY-MM-DD」追補（再発防止策 + 影響範囲 + 対応時間）
    - β ユーザーへの通知判断（SEV-1 のみ通知、SEV-2 以下は次回 weekly digest で要約）

## 5. Vercel Rollback 手順
  ### 5.1 Vercel UI 経由（推奨 / 1 分）
    1. https://vercel.com/{org}/{project}/deployments を開く
    2. 直前の Production deployment（緑 status）を選択
    3. 「⋯」→ 「Promote to Production」をクリック
    4. 確認モーダルで Confirm
  ### 5.2 Vercel CLI 経由（UI 不調時 fallback）
    ```
    npx vercel ls --prod
    npx vercel promote {deployment-url} --scope={team}
    ```
  ### 5.3 注意事項
    - DB migration を含む rollback は **drizzle が down migration を自動生成しない** ため、構造変更 (DROP COLUMN 等) を含む場合は別途手動 SQL が必要
    - β 期間中は migration 0017 (W12-T3-A invite codes) が最新 = 今後 0018+ で構造的破壊を伴う変更時は本 RUNBOOK §5.3 を更新

## 6. Hotfix 手順
  ### 6.1 ローカル修正 → push
    1. `git checkout main && git pull`
    2. 修正実装
    3. `npm run typecheck && npm run lint && npm run test && npm run e2e:critical-only`
    4. `git commit -m "hotfix: ..."` → `git push`
  ### 6.2 Vercel 自動 deploy
    - main push で Production 自動 deploy（DEPLOYMENT.md §8 既存 GitHub 連携）
    - 完了まで 2〜4 分
  ### 6.3 確認
    - Sentry に同じ Issue が再発生しないことを 30 分監視
    - β ユーザー側の症状が解消したことを feedback 経路で確認

## 7. β 期間中の specific incident playbook
  ### 7.1 invite_codes redeem 競合（DEC-069 known race / Minor 1）
    - 症状: 同一 invite code を複数ユーザーが同時 redeem → 1 名は signup 完了、残りは 孤児 user/family/consents
    - 暫定対応: Turso shell で 孤児 user を DELETE（手順は decisions.md DEC-069 §F 参照）
    - 恒久対応: Phase 3 candidate
  ### 7.2 Sentry quota 超過（Developer plan 5k errors/month）
    - 症状: Sentry が新規 event 受付停止
    - 暫定: `tracesSampleRate` を 0 に下げる ENV 変更で深刻度 high のみ送信
    - 恒久: Sentry Team plan ($26/月) 検討（Phase 2 後半）
  ### 7.3 OpenAI API 障害
    - 症状: AI コーチ応答が all timeout
    - 対応: gpt-4.1-mini fallback が AI SDK で自動切替（DEC-003 で構造担保 / 既実装）
    - 確認のみ: Sentry で「AI fallback triggered」breadcrumb 増加監視

## 8. 連絡テンプレ（β ユーザー向け / SEV-1 時のみ送信）
  - 件名 / 本文の 2 種を §C-2 に記載（α→β 移行とは別 / incident 専用）
```

### 2.3 RUNBOOK 設計上の判断ポイント

1. **個人開発単独運用を前提にした簡素化**: 多数の SRE runbook テンプレ (PagerDuty / Atlassian) は「on-call rotation」「escalation」前提だが、HANEI は **オーナー 1 名 = エスカレーション先なし**。代わりに「30 分以内 rollback / 2 時間以内 hotfix / 当日中 / 翌営業日」の severity-based SLA に簡素化。
2. **β 範囲外の payment を明示除外**: DEC-006 / DEC-012 で Phase 1 / 2 は完全無料 = payment フロー実装ゼロ = critical path から構造的除外。Phase 3 で再評価される旨を §3 に明記。
3. **既知 known issue の playbook を §7 に集約**: DEC-069 review 部門指摘 Minor 1 (race-loss 孤児) / Sentry quota / OpenAI 障害の 3 件を pre-defined 化することで、緊急時に「未知の障害」を「既知の対応」に切り替え可能。

---

## 3. B. Sentry alert 強化 / 設定項目案

### 3.1 現状の Sentry 構成（コード側 + Sentry プロジェクト側の分離確認）

#### 3.1.1 コード側（既実装）

| 項目 | 設定値 | ファイル |
|---|---|---|
| DSN | `NEXT_PUBLIC_SENTRY_DSN` env | `sentry.{client,server,edge}.config.ts` 全 3 種 |
| `tracesSampleRate` | `0.1` | client / server / edge 全て固定 hardcode |
| `replaysSessionSampleRate` | `0` | client only |
| `replaysOnErrorSampleRate` | `1.0` | client only |
| `sendDefaultPii` | `false` | client / server / edge 全て |
| `beforeSend` PII strip | email / IP / cookie / authorization 削除 | 全 3 種 |
| `withSentryConfig` source map upload | `SENTRY_AUTH_TOKEN` 設定時のみ | `next.config.ts` |
| `tunnelRoute` | `/monitoring` | `next.config.ts` |
| `instrumentation.ts` | server / edge runtime 振り分け済 | OK |

#### 3.1.2 Sentry プロジェクト側 UI 設定（**未着手** = T3-C で運営者が手動設定する範囲）

| 項目 | 現状 | 推奨設定 |
|---|---|---|
| Alert Rule (error spike) | デフォルトのみ | §3.2 推奨ルール 1 |
| Alert Rule (new issue) | デフォルトのみ | §3.2 推奨ルール 2 |
| Alert Rule (regression) | デフォルトのみ | §3.2 推奨ルール 3 |
| User Feedback notification | デフォルト email のみ | §3.2 推奨ルール 4 |
| Alert 通知先 | Sentry default email | オーナー個人 email |
| Slack integration | 未設定 | Phase 3 候補 |

### 3.2 推奨 Sentry alert ルール（運営者が UI で設定）

#### Rule 1: Error Event Spike（短時間集中検知）
- **Trigger**: `event.count` > **5 件** in **5 分間** (per project / production env)
- **Filter**: `environment:production`
- **Action**: email to オーナー個人アドレス
- **狙い**: 個別 user の偶発エラー (1 件) は無視 / 同一 issue が 5 件超で「広範囲影響」と判定 / β 期間 30〜50 家庭規模では 5 件 = 全ユーザー 10〜17% 該当 = SEV-1 級

#### Rule 2: New Issue Detected（新規 fingerprint）
- **Trigger**: `issue.first_seen` = now (新 fingerprint)
- **Filter**: `environment:production` + `level:error or fatal`
- **Action**: email
- **狙い**: 既知 issue は spike rule で十分 / 新規 fingerprint = 「直前 push or β 利用拡大で表面化した未知の経路」を即検知

#### Rule 3: Regression Detected（resolved → unresolved）
- **Trigger**: `issue.regression`
- **Filter**: `environment:production`
- **Action**: email
- **狙い**: 一度 resolve したものが再発 = hotfix 不完全 / 別経路から同症状 = SEV-2 級として早期気づき

#### Rule 4: User Feedback Received（DEC-070 連動）
- **Trigger**: `feedback.created`
- **Filter**: `environment:production`
- **Action**: email
- **狙い**: T3-B で feedback button 経由ユーザーが「ご意見」送信した瞬間にオーナーへ通知 → 24h 以内返信運用が可能（β 30〜50 家庭規模なら手動運用十分）

#### Rule 5（任意 / 後回し可）: Performance Degradation
- **Trigger**: `transaction.duration.p95` > 3000ms in 10 分
- **Filter**: `environment:production`
- **Action**: email
- **狙い**: K-5（DEC-008 子ども向け固有 6 項目）応答時間 P95 を構造監視
- **判断**: `tracesSampleRate: 0.1` の制約上 sample 数が少ないため alert 精度が低い → β 期間は手動 dashboard 確認に留める案も有

### 3.3 ENV flag 検討

#### 3.3.1 推奨追加 flag

```bash
# .env.local.example に追加（dev 実装時）
SENTRY_TRACES_SAMPLE_RATE=0.1   # 既存 hardcode を ENV 化（Sentry quota 超過時に 0 へ緊急降下可能）
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0   # client replay 緊急 OFF 用
SENTRY_ENABLED=true   # 全停止用 kill switch（極端な障害時 / Sentry quota 完全枯渇時）
```

#### 3.3.2 コード側変更点（dev が次 atomic で実装）

```typescript
// sentry.client.config.ts (例 / dev 実装時の設計案)
const tracesSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
const replaysOnErrorSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? "1.0");
const enabled = Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false";

Sentry.init({
  dsn,
  enabled,
  tracesSampleRate,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate,
  // ...
});
```

- **client config の env**: `NEXT_PUBLIC_*` prefix が必須（browser bundle に注入される必要があるため）。
- **server / edge config**: `SENTRY_TRACES_SAMPLE_RATE`（NEXT_PUBLIC 不要）で OK。
- **DEC-006 影響なし**: env 経由の sample rate 切替はコード変更ゼロ運用 / mutation budget 影響なし。

### 3.4 source map upload の現状確認

- `next.config.ts` の `withSentryConfig` で `SENTRY_AUTH_TOKEN` env 設定時のみ自動 upload。
- Vercel Production env に `SENTRY_AUTH_TOKEN` を設定すれば build 時に自動 upload。
- **現状の確認事項 (CEO に依頼 / Sentry UI 操作範囲)**: Vercel dashboard で `SENTRY_AUTH_TOKEN` が Production env に設定されているか確認 / 未設定なら設定する。
- 本 atomic ではコード変更ゼロでカバー可能（既存 `next.config.ts` で十分）。

### 3.5 コード側 / Sentry UI 側の責任分離まとめ

| 項目 | コード側（dev） | Sentry UI 側（CEO/オーナー手動） |
|---|---|---|
| DSN 設定 | env で受け取り | Sentry プロジェクト作成時に発行済 |
| sample rate | env 化（本 atomic で実装） | デフォルトのまま（env でリモート制御） |
| Alert Rule 1〜4 | **対象外** | **UI で 4 件作成（§3.2）** |
| 通知先 email | 対象外 | オーナー個人 email（Sentry プロフィール） |
| Source map upload | `next.config.ts` 既存 | Vercel Production env に SENTRY_AUTH_TOKEN 設定確認 |
| User Feedback | T3-B で SDK 経由送信 | Issue ページで閲覧 / 返信は外部 email で |

---

## 4. C. α→β 移行アナウンス / 文面草案

### 4.1 現状確認

- 公開 LP (`src/app/page.tsx`): footer に「現在クローズドβ準備中。ご利用は無料です。」と既存記載。
- α 実在ユーザー名簿: decisions.md 全文 grep で 0 件 → **§1.3 の通り「α 実ユーザー 0 名前提」で設計**。
- β 招待は CLI (`scripts/generate-beta-invite.ts`) で発行 → メール / DM 等で個別配布する運営想定（DEC-069）。

### 4.2 必要な文面 3 種

#### C-1. β 招待メール本文テンプレ（**主要 / これが本命**）

```text
件名: HANEI クローズドβへのご招待 — 半年で英検3級を、AIコーチと。

{お名前} さま

このたびは HANEI（ハンエイ）に関心をお寄せいただき、ありがとうございます。
小学生のための英語学習アプリ HANEI のクローズドβ版へ、ご招待いたします。

― HANEI とは
半年で英検3級合格を目指す、小学生向け学習アプリです。
お子さまのレベルに合わせて、毎日の学習プランを AI コーチが用意します。
保護者ダッシュボードで、お子さまの取り組みを確認できます。

― 招待コード
あなた専用の招待コード: {INVITE_CODE_8_CHARS}
（※このコードは1家庭 1 回のみ有効です。家族や知人と共有はできません）

― ご利用開始の手順
1. https://hanei.app/signup をブラウザで開く
2. 招待コード欄に上記コードを入力
3. 保護者の方のメールアドレス・パスワードを設定
4. お子さまのプロフィール（ニックネーム / 学年 / 受験予定日）を登録
5. その日からすぐ学習を始められます

― ご利用は無料です
β期間中は完全無料でご利用いただけます。将来的に有料プランの導入を検討する場合も、
β期間中の機能はそのまま無料で継続予定です（公開β移行時に詳細をご連絡します）。

― ご意見・困りごと
アプリ内の「ご意見を送る」ボタン、もしくは下記アドレスまでお気軽にお寄せください。
頂いたお声は今後の改善に活かしてまいります。

― お問い合わせ
{オーナー個人 email}

どうぞよろしくお願いいたします。

HANEI 開発チーム
```

#### 設計判断（C-1 文面）

1. **DEC-024 罰則ゼロ厳守**: 「合格できる」「絶対に」等の断定回避 / 「目指す」「ご一緒に」の中立トーン。
2. **DEC-005 訴求コピー強度準拠**: 「半年で英検3級**を目指す**」を起点。「合格保証」「合格できる」は β 実績待ち。
3. **DEC-006 / DEC-012 整合**: 「β期間中は完全無料」「将来的に有料化検討時もβ機能は無料継続予定」と明記。
4. **invite code redeem 動線整合**: §「ご利用開始の手順」step 2 で T3-A 実装済の入力欄を明示誘導。
5. **feedback 動線整合**: T3-B で実装中の「ご意見を送る」ボタンを明記 → 全ユーザーに認知させる。

#### C-2. SEV-1 incident 時の β ユーザー宛て連絡テンプレ（RUNBOOK §8 連動）

```text
件名: 【HANEI】サービス障害のお知らせとお詫び

{お名前} さま

平素より HANEI をご利用いただきありがとうございます。

本日 {YYYY-MM-DD HH:MM JST} 頃から {影響範囲} で
ご不便をおかけする状況が発生しておりました。

現在は復旧しております / 復旧作業中です。

― 影響範囲: {例: ログイン / 学習画面の表示}
― 復旧時刻: {YYYY-MM-DD HH:MM JST 復旧 / 現在対応中}
― お子さまの学習データ: 失われておりません

ご迷惑をおかけし申し訳ございません。

HANEI 開発チーム
```

#### 設計判断（C-2 文面）

1. **SEV-1 のみ送信**: 全 incident で送ると通知疲れ → 学習意欲低下 = DEC-024 哲学反する。
2. **「お子さまの学習データは失われていません」を明記**: 保護者の最大不安要素を先回り。
3. **DEC-024 罰則ゼロ**: 「申し訳ございません」は許容（罰語ではなくマナー文言）/ 「ユーザーの責任」を示唆する文言ゼロ。

#### C-3. LP 文言更新案（公開 β 開始時 / `src/app/page.tsx`）

**Before（現状 footer）**:
```jsx
<p className="mt-2">現在クローズドβ準備中。ご利用は無料です。</p>
```

**After（T3-C 完遂時）**:
```jsx
<p className="mt-2">クローズドβ公開中。ご利用は無料です（招待制）。</p>
```

#### 設計判断（C-3 文言）

1. **「準備中」→「公開中」への切替**: T3-A 実装完了で実態は既に公開可能 = 文言更新で実態整合。
2. **「招待制」明記の有無**:
   - **付ける派**: signup ページで invite code を求められて初めて気づくのは UX 不親切 / トップページで明示すべき。
   - **付けない派**: invite なし signup を試みるユーザーが「自分には関係ない」と離脱 → 招待希望者の流入機会喪失。
   - **推奨**: 「招待制」を明記し、追加で「招待をご希望の方は {form-link or twitter DM}」のリンクを併記（§4.3 検討）。
3. **DEC-024 整合**: 「準備中」「お楽しみに」より「公開中」「ご利用は無料」の方が前向き / 罰語ゼロ。

### 4.3 LP 招待希望フォームについて（補助検討 / 本 atomic スコープ外候補）

- 「招待をご希望の方は {form}」をどこに繋げるか:
  - **案 1 (推奨 / 本 atomic 含む)**: オーナー個人 email へのリンク `mailto:` 既存 contact 経由 / 新規 route ゼロ / DEC-006 不変
  - **案 2 (持ち越し)**: 専用 form route 新規追加 → DEC-006 mutation +1 / route +1 → 制約抵触 → Phase 3 候補
- **判断**: 案 1 を C-3 LP 更新と同 atomic で実装可能（mailto: 文字列追加のみ）。

---

## 5. D. atomic 分解見立て

### 5.1 結論: **T3-C は 1 atomic で完遂可能（0.5 人日）**

### 5.2 工数見積内訳

| 作業 | 工数 | 備考 |
|---|---|---|
| `app/RUNBOOK.md` 新規作成（§2.2 章立て準拠） | 1.5h | 200〜300 行 / dev が骨子準拠で執筆 |
| `sentry.{client,server,edge}.config.ts` の env 化 | 0.5h | 3 ファイル / hardcode → process.env で sample rate / enabled flag 化 |
| `.env.local.example` 追加（SENTRY_* 3 件） | 0.1h | 既存 §Sentry セクションに追記 |
| 既存 unit test の env mock 追加 / 既存 test に sentry env を入れて regression 0 確認 | 0.5h | sentry.config.ts の test は元々無いので unit test 新規ゼロでも可 |
| C-1 招待メールテンプレ作成（`projects/PRJ-016/beta-invite-email-template.md` 新規） | 0.5h | reports 外置きで運営者が直接コピペできる場所に配置 |
| C-2 SEV-1 incident テンプレ（RUNBOOK §8 内に inline） | 0.2h | 別ファイル不要 |
| C-3 LP `src/app/page.tsx` footer 文言更新 + mailto 追加 | 0.3h | typecheck / E2E regression 確認 |
| Sentry プロジェクト UI 設定 checklist（運営者向け / `app/RUNBOOK.md` 末尾 §Appendix or `docs/sentry-setup.md` 別） | 0.2h | UI スクショ無し / テキスト手順のみ |
| typecheck / lint / build / E2E regression 確認 | 0.3h | 25 routes 不変 / 既存 E2E 12 PASS（admin-kpi 4 + admin-kpi-experiment 2 + shop 6）regression 0 |
| review 提出用報告書 `reports/dev-w12-t3-c-hotfix-sentry-announce-done.md` 執筆 | 0.4h | dev report テンプレ準拠 |
| **合計** | **約 4.0h（0.5 人日）** | |

### 5.3 1 atomic で完遂する根拠

1. **コード変更が極小**:
   - `sentry.*.config.ts` × 3 = 既存ファイル微修正のみ（数行 diff / 各 5〜10 行）
   - `.env.local.example` = 3 行追加
   - `src/app/page.tsx` = 1〜2 行修正
   - **新規 server action / new route / new migration ゼロ** = DEC-006 GET 10 / mutation 5 不変条件構造的遵守 / build 25 routes 不変
2. **Markdown ドキュメントが大半**:
   - `RUNBOOK.md`（200〜300 行）+ `beta-invite-email-template.md`（80〜100 行）= **テキスト主体 = 0.5 人日に十分収まる**
3. **Sentry UI 設定は CEO/オーナー手動（コード対象外）**: dev atomic 内では「checklist の文書化」までで完了 / 実際の UI 設定は次 CEO セッション内で 10 分作業
4. **テスト負荷ゼロ**:
   - sentry config の env 化は既存 init 動作を変えない（default 値が既存 hardcode と同値）→ regression risk 構造的ゼロ
   - LP 文言更新は既存 LP E2E が無いため regression 0 自明（手動 smoke 1 回で十分）

### 5.4 分解する場合の代替案（**非推奨**）

仮に分解する場合は以下の 2 atomic だが、**それぞれが 0.25 人日以下となり atomic 単位として小さすぎる**ため非推奨:

- **T3-C-1**: RUNBOOK + Sentry config env 化 (0.3 人日)
- **T3-C-2**: α→β アナウンス文面 + LP 更新 (0.2 人日)

CEO 推奨 = **1 atomic 統合**。

---

## 6. 推奨優先度・依存関係

### 6.1 W12 残 atomic との関係

| atomic | 状態 | T3-C との依存 |
|---|---|---|
| T3-A invite flow | 完遂（DEC-069） | T3-C C-1 メールテンプレで invite code 配布動線を前提 / **必須前置** |
| T3-B feedback 動線 | 着手中（DEC-070） | T3-C B-3.2 Rule 4 (User Feedback Received alert) が T3-B 完遂前提 / **論理的前置** だが alert 設定は実 feedback 受信前に済ませても害なし |
| T3-C 本 atomic | 未着手（本骨子） | - |
| T4 ストレステスト + Sentry alert 設定 | 未着手（DEC-069 §後続候補） | 本骨子 §3.2 で「設定項目 checklist」まで提示 / 実際の Sentry プロジェクト UI 設定は T4 で実施する案も成立 |

### 6.2 T3-C 内部の作業順序（dev 実装時）

1. **Step 1**: `sentry.*.config.ts` の env 化（3 ファイル / 最も risk 低 / 既存挙動完全互換）
2. **Step 2**: `.env.local.example` 追加（1 ファイル）
3. **Step 3**: `RUNBOOK.md` 新規執筆（§2.2 骨子準拠 / 1.5h）
4. **Step 4**: `beta-invite-email-template.md` 新規（C-1 文面）
5. **Step 5**: LP `src/app/page.tsx` 文言更新 + mailto
6. **Step 6**: typecheck / lint / build / E2E regression
7. **Step 7**: dev 報告書作成 → review 提出

### 6.3 T3-C と T4（ストレステスト）の関係

- T4 は「DB pool 限界」「同時接続 100」等の **負荷検証** / Sentry alert 設定も「実 alert を発火させるテスト」として T4 内で実施可能
- 本骨子 §3.2 推奨ルール 4 件は T3-C で **設計** / T4 で **本番 UI に登録 + 実発火 smoke** の 2 段階分担も成立
- **CEO 判断ポイント**: T3-C 内で UI 設定を CEO が同セッションで実行するか / T4 まで持ち越すか

---

## 7. CEO への補助情報（T3-C DEC 起票時の注記事項）

### 7.1 必須注記（DEC 本文に明記すべき）

1. **α ユーザー実在数の確認結果**: §1.3 の通り「decisions.md grep で 0 件 / 設計時想定のみ」→ DEC 本文で「α 実ユーザー 0 名前提で β アナウンスを設計」と明記すべき。1 名以上いる場合は CEO がオーナーに別途確認。
2. **Sentry プロジェクト UI 設定は本 atomic コード対象外**: §3.5 責任分離表を DEC 本文に転記。「コード側 = dev / Sentry UI = CEO/オーナー手動」を構造分離。
3. **payment 系を critical path から構造除外**: DEC-006 / DEC-012 整合 / RUNBOOK §3 で明示。Phase 3 で再評価。
4. **DEC-024 罰則ゼロ厳守**: 招待メール文面 / SEV-1 incident テンプレ / LP 更新の 3 文書全てで罰語ゼロ確認 → unit test 不要だが review 部門で grep 検証推奨。
5. **DEC-006 mutation 5 / GET 10 不変条件構造的遵守**: 新規 server action 0 / 新規 route 0 / 新規 migration 0 / build 25 routes 不変。
6. **DEC-013 Vercel Pro 単一プラン整合**: rollback 手順は Pro 前提（Hobby 分岐削除済 = DEC-013 で簡素化済）。

### 7.2 受入基準（DEC 起票時のテンプレ案）

- typecheck pass / lint pass
- vitest baseline 54 files / 835 PASS（regression 0 / sentry config の env 化で test 影響あれば追加 unit）
- next build 25 routes 不変
- E2E regression 0（既存 12 PASS 維持 / 新規 E2E ゼロ）
- `app/RUNBOOK.md` 新規 200〜300 行
- `projects/PRJ-016/beta-invite-email-template.md` 新規 80〜100 行
- `sentry.*.config.ts` × 3 env 化済
- `.env.local.example` に SENTRY_TRACES_SAMPLE_RATE / SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE / SENTRY_ENABLED 追加
- LP footer 文言更新「クローズドβ公開中」+ mailto: 招待希望リンク
- review 部門 APPROVE
- DEC-024 / DEC-003 / DEC-006 / DEC-013 / DEC-055 / DEC-066 / DEC-067 / DEC-068 / DEC-069 / DEC-070 厳守

### 7.3 後続 atomic への submarine

- **T4 ストレステスト**: 本 §3.2 alert ルール 4 件を T4 で実発火検証（人為的に error event 6 件投げて 5 分以内に email 受信確認 / regression alert を resolve → reopen で確認）
- **Phase 3 移行時**: payment フロー実装と同時に RUNBOOK §3 critical path に payment 追加 / Stripe webhook の Sentry breadcrumb 設計が必要

### 7.4 次 CEO セッションでオーナーに確認すべき軽承認

| 項目 | デフォルト推奨 | オーナー判断必要なケース |
|---|---|---|
| α 実ユーザー 0 名で良いか | Yes（0 名前提で進行） | 1 名以上いる場合は別途名簿提示 |
| 招待メール文面の差出人 | 「HANEI 開発チーム」（個人開発でも組織体裁推奨） | 「オーナー個人名 + HANEI」を希望する場合 |
| LP に「招待をご希望の方は」mailto: を入れるか | Yes（推奨 = 招待希望者流入経路確保） | 「現時点では招待希望窓口を開かない」方針なら No |
| Sentry alert 通知先 email | オーナー個人 email | 別 email アドレスを使い分ける場合 |

### 7.5 並列実行可否

- **本 T3-C atomic は dev 単独で完遂可能**（research / secretary 並行起動の必要性は低い）
- T3-B feedback 動線（実装中）と T3-C は **論理的依存はあるが実装上の競合なし**（T3-B が `Sentry.captureFeedback()` を追加 / T3-C が config env 化 + RUNBOOK 新規 = ファイル衝突ゼロ）→ 厳密な順序制約なし

---

## 8. まとめ（要点 7 行）

1. T3-C は **1 atomic / 0.5 人日 / コード変更極小（sentry config env 化 + LP 1 行 + Markdown 2 ファイル新規）** で完遂可能。
2. RUNBOOK は `app/RUNBOOK.md` に 200〜300 行 / 個人開発単独運用 + severity-based SLA + payment 構造除外。
3. Sentry alert は **コード側 env 化（dev）+ Sentry プロジェクト UI 4 ルール設定（CEO 手動）** に責任分離。
4. α→β アナウンスは **α 実ユーザー 0 名前提**で「β 招待メールテンプレ + LP 文言更新 + SEV-1 incident テンプレ」の 3 種を作成。
5. DEC-006 mutation 5 / GET 10 / 25 routes 完全不変 / DEC-024 罰則ゼロ厳守 / DEC-013 Vercel Pro 単一前提。
6. T4 ストレステストとは「設計（T3-C）→ 実発火検証（T4）」で役割分離可能。
7. CEO 軽承認 4 項目（§7.4）+ DEC 本文に必須注記 6 項目（§7.1）を確認後、dev 着手 GO。

---

**End of W12-T3-C 設計骨子調査レポート**
