# PRJ-016 HANEI - ER 図 v1 (W1)

- 作成日: 2026-04-26
- 作成者: 開発部門
- 対象: W1 スコープの最小10テーブル
- 完全形 (25テーブル): W2 以降で `dev-phase0.md §2` を実装に展開

## 凡例

- `||--o{` : 1対多
- `||--o|` : 1対0..1
- 太字テーブルは三層認可防衛のスコープ起点 (`families`)

## Mermaid

```mermaid
erDiagram
    users ||--o{ family_members : "joins"
    families ||--o{ family_members : "has"
    families ||--o{ learner_profiles : "has"
    families ||--o{ parent_consents : "logs"
    users ||--o{ parent_consents : "signs"

    learner_profiles ||--o{ answer_logs : "produces"
    learner_profiles ||--o{ srs_states : "owns"

    eiken_levels ||--o{ skills : "groups"
    eiken_levels ||--o{ problems : "contains"
    skills ||--o{ problems : "categorizes"

    problems ||--o{ answer_logs : "answered"
    problems ||--o{ srs_states : "scheduled"

    users {
      text id PK
      text email UK
      text role
      bool email_verified
    }

    families {
      text id PK
      text display_name
      text plan
    }

    family_members {
      text id PK
      text family_id FK
      text user_id FK
      text role "parent | learner"
    }

    parent_consents {
      text id PK
      text family_id FK
      text parent_user_id FK
      text learner_profile_id FK
      text consent_type
      text consent_version
      text signature
      int  consented_at
      text ip_address
      text user_agent
      int  revoked_at
    }

    learner_profiles {
      text id PK
      text family_id FK
      text user_id FK
      text nickname
      text avatar_id
      text current_level
      text target_eiken_level
      text exam_date
      int  daily_minutes_target
    }

    eiken_levels {
      text id PK "5 | 4 | 3"
      text display_name
      int  target_vocab_count
    }

    skills {
      text id PK
      text parent_skill_id
      text eiken_level_id FK
    }

    problems {
      text id PK
      text level_id FK
      text skill_id FK
      text type
      text question_json
      text correct_answer
      text explanation
      real generation_quality_score
      text qa_verdict
      text qa_status
      text audio_url
      text source
    }

    answer_logs {
      text id PK
      text learner_id FK
      text problem_id FK
      text user_answer
      bool is_correct
      int  time_spent_ms
      int  answered_at
    }

    srs_states {
      text id PK
      text learner_id FK
      text problem_id FK
      text fsrs_state
      real stability
      real difficulty
      int  due_at
      int  last_reviewed_at
      int  review_count
    }
```

## 三層認可スコープキー一覧

| テーブル | スコープキー | 備考 |
|---------|------------|------|
| families | (root) | テナント本体 |
| family_members | family_id | UNIQUE (user_id, family_id) |
| parent_consents | family_id | 13歳未満同意ログ |
| learner_profiles | family_id | 子どもプロフィール |
| answer_logs | learner_id -> family_id | learner_profile の family を辿る |
| srs_states | learner_id -> family_id | learner_profile の family を辿る |
| problems / eiken_levels / skills | (グローバルマスタ) | テナント横断 read-only |

## W2 で追加予定のテーブル (dev-phase0.md §2 から)

- `sessions` (Better Auth)
- `accounts` (Better Auth OAuth)
- `verifications` (Better Auth email)
- `daily_plans` (受験日逆算プラン)
- `streaks` / `xp_levels` / `achievements` / `badges` (ゲーミフィケーション)
- `ai_coach_conversations` / `ai_coach_messages` (チャット履歴)
- `mock_exam_results` (模試結果)
- `mastery_estimates` (BKT)
- `audit_logs` (操作監査)
- `generated_problems_queue` (LLM 生成待ちキュー)
- `problem_choices` / `problem_explanations` (problems 拡張)
- `characters` (アバター)

合計 25 テーブルが Phase 1 終了時のターゲット。
