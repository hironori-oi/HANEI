/**
 * /study/[levelCode]/[skillCode] - 学習画面 (Server Component + Client interaction)
 * 例: /study/eiken-5/vocab
 *
 * - 4 択語彙問題を 1 問取得 (SRS due 優先)
 * - クライアント側で正誤判定 → 解説 → SRS 更新は Server Action
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requireAuth, getFamilyIdForUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { eq, and } from "drizzle-orm";
import { learnerProfiles } from "@/lib/db/schema";
import { getNextProblem } from "@/lib/study/repository";
import {
  composeStudySession,
  isSessionDurationMinutes,
  type SessionDurationMinutes,
} from "@/lib/study/session-composer";
import { StudyClient } from "./StudyClient";

// /study/eiken-5 → "5", /study/eiken-4 → "4", /study/eiken-3 → "3"
function parseLevelCode(code: string): "5" | "4" | "3" | null {
  const m = /^eiken-([543])$/.exec(code);
  return (m?.[1] as "5" | "4" | "3" | null) ?? null;
}

// URL skillCode → DB skills.id の base code
// 注意: 実 DB の skills.id / problems.skill_id は `seed-problems-runner.ts` の
// `mapSkillId(seed, level)` により level 付き形式 (例: "vocabulary-5") で書かれる
// (DEC-038 follow-up #2 で発見した production canonical schema)。
// よって本ページの DB クエリでは `${SKILL_BASE[skillCode]}-${level}` を使うこと。
const SKILL_BASE: Record<string, string> = {
  vocab: "vocabulary",
  grammar: "grammar",
  listening: "listening",
  reading: "reading",
  writing: "writing",
};

const SKILL_LABEL: Record<string, string> = {
  vocabulary: "語彙",
  grammar: "文法",
  listening: "リスニング",
  reading: "読解",
  writing: "ライティング",
};

export const metadata = {
  title: "学習",
};

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ levelCode: string; skillCode: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { levelCode, skillCode } = await params;
  const level = parseLevelCode(levelCode);
  const skillBase = SKILL_BASE[skillCode];
  if (!level || !skillBase) notFound();
  // DB canonical: "<base>-<level>" (例: "vocabulary-5")
  const skill = `${skillBase}-${level}`;

  // W10-T4: セッションパラメータ (?dur=5|7|10 & session=<uuid>) を解釈
  // 既存ルートとの後方互換のため optional / 不正値は無視
  const sp = (await searchParams) ?? {};
  const durRaw = Array.isArray(sp.dur) ? sp.dur[0] : sp.dur;
  const sessionRaw = Array.isArray(sp.session) ? sp.session[0] : sp.session;
  const durParsed = durRaw ? Number.parseInt(durRaw, 10) : null;
  const sessionDurationMinutes: SessionDurationMinutes | null =
    durParsed !== null && isSessionDurationMinutes(durParsed) ? durParsed : null;

  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p>家族情報が未登録です。 /onboarding/learner からプロフィールを作成してください。</p>
      </main>
    );
  }

  // 家族内の最初の learner を取得 (Phase 1 = 1家族 1学習者前提 / 複数子は Phase 2)
  // eslint-disable-next-line no-restricted-syntax -- 認可済 (familyId スコープ)
  const learners = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.familyId, familyId))
    .limit(1);
  const learner = learners[0];
  if (!learner) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p>学習者プロフィールが未登録です。</p>
        <Link className="text-primary underline" href="/onboarding/learner">
          こちらから作成してください
        </Link>
      </main>
    );
  }

  const problem = await getNextProblem(learner.id, level, skill);

  if (!problem) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-4 text-2xl font-bold">{SKILL_LABEL[skillBase]} (英検{level}級)</h1>
        <div className="rounded-md border bg-muted/40 p-6 text-center">
          <p className="mb-4">この級・スキルでは、まだ問題が用意されていません。</p>
          <p className="text-sm text-muted-foreground">
            問題は LLM-as-Judge パイプラインで毎日 02:00 JST に追加されます。
          </p>
        </div>
        <Link
          href="/home"
          className="mt-6 inline-flex items-center gap-2 text-sm text-primary underline"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          ホームに戻る
        </Link>
      </main>
    );
  }

  // questionJson は string | jsonable. Drizzle (mode:json) で deserialize 済
  // writing_essay の場合は choices が無く modelAnswer が入る (seed-problems-runner / buildWritingQuestionJson)
  const questionJson = problem.questionJson as {
    prompt: string;
    choices?: Array<{ label: string; text: string }>;
    modelAnswer?: string;
  };
  const isWritingEssay = problem.type === "writing_essay";

  // メタ情報を avoid bug for null/undefined
  void and; // import 保持

  // W10-T4 fix (M-A1): session-mode 時は key を session-stable にして StudyClient を持続させる
  // - session-mode (sessionId 付き) では `session:<id>` で固定 → router.refresh() で次問取得しても
  //   StudyClient が unmount されず、sessionAnswers / sessionStartTime / overtimeOffered などの
  //   useState が保持される (planSize 到達 / overtime 提案が正しく発火するための前提)
  // - session-mode 外 (Phase 1 直リンク) は従来通り problem.id 切替で feedback リセット
  const sessionRawId =
    typeof sessionRaw === "string" && sessionRaw.length > 0 ? sessionRaw : undefined;
  const studyClientKey = sessionRawId
    ? `session:${sessionRawId}`
    : `problem:${problem.id}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          ホームに戻る
        </Link>
        <span className="text-sm text-muted-foreground">
          英検{level}級 / {SKILL_LABEL[skillBase]}
        </span>
      </header>

      <StudyClient
        key={studyClientKey}
        learnerId={learner.id}
        problemId={problem.id}
        problemType={isWritingEssay ? "writing_essay" : "mcq"}
        prompt={questionJson.prompt}
        choices={questionJson.choices ?? []}
        audioUrl={problem.audioUrl ?? null}
        skill={skill}
        sessionDurationMinutes={sessionDurationMinutes ?? undefined}
        sessionPlanSize={
          sessionDurationMinutes
            ? composeStudySession({
                learnerId: learner.id,
                durationMinutes: sessionDurationMinutes,
              }).planSize
            : undefined
        }
        sessionId={sessionRawId}
      />
    </main>
  );
}
