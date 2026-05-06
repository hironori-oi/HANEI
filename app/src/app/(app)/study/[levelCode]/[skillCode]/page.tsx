/**
 * /study/[levelCode]/[skillCode] - 学習画面 (Server Component + Client interaction)
 * 例: /study/eiken-5/vocab
 *
 * - 4 択語彙問題を 1 問取得 (SRS due 優先)
 * - クライアント側で正誤判定 → 解説 → SRS 更新は Server Action
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  HomeIcon,
  MapIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
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
import {
  getTodayLearningSeconds,
  startOrResumeStudySession,
} from "@/lib/actions/study-sessions";
import {
  hasReachedOverlearningHardLimit,
  todayMinutesFromSeconds,
} from "@/lib/study/study-time";
import { getKotodamaStageInput } from "@/lib/study/kotodama-stage-resolver";
import { getKotodamaStage } from "@/lib/study/kotodama-tori-stage";
import { Button } from "@/components/ui/button";
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

  // W10-T5: 過学習防止 - 当日累計学習秒数 (server-rendered baseline)
  // 60 分到達済みの場合は問題取得せず hard_limit gate ページを返す (DB 負荷削減 + 入口で止める)
  const serverTodayCumulativeSeconds = await getTodayLearningSeconds(learner.id);

  // DEC-088 Plan B 項目 1: 学習者の現在進化段階を server で計算し AnswerFeedbackEffects に渡す
  // (毎回 SVG 5 種から進化段階に応じたものを描画する / 表情も切替)
  const kotodamaStageInput = await getKotodamaStageInput(db, learner.id);
  const learnerKotodamaStage = getKotodamaStage(kotodamaStageInput);

  if (hasReachedOverlearningHardLimit(serverTodayCumulativeSeconds)) {
    const todayMinutes = todayMinutesFromSeconds(serverTodayCumulativeSeconds);
    return (
      <main
        className="mx-auto max-w-2xl px-6 py-10"
        data-testid="overlearning-hard-limit-gate"
        data-today-minutes={todayMinutes}
      >
        <div className="rounded-2xl border border-primary/30 bg-card p-8 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <SparklesIcon
              className="h-7 w-7 text-primary"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold text-primary">
              きょうは じゅうぶん
            </h1>
          </div>
          <p className="mb-6 text-base leading-relaxed">
            きょうは {todayMinutes} ふん がんばったね。あした また あおうね。
          </p>
          <Button asChild size="lg" className="min-h-tap-cta w-full">
            <Link href="/home">
              <HomeIcon className="mr-1 h-5 w-5" aria-hidden="true" />
              ホームへ もどる
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  // W10-T5: session-mode の時のみ study_sessions 行を server で確保 (sessionDbId を確定させる)
  // - Phase 1 直リンク (sessionId なし) では cumulative tracking は無効化 (legacy 互換)
  let studySessionDbId: string | undefined = undefined;
  if (sessionRaw && typeof sessionRaw === "string") {
    try {
      const startResult = await startOrResumeStudySession({
        learnerId: learner.id,
        clientSessionId: sessionRaw,
        durationMinutes: sessionDurationMinutes,
      });
      studySessionDbId = startResult.sessionDbId;
    } catch {
      // silent fail-safe (study_sessions 不在環境を想定 / legacy 互換)
      studySessionDbId = undefined;
    }
  }

  const problem = await getNextProblem(learner.id, level, skill);

  if (!problem) {
    // DEC-093: β 試用フィードバック対応 第 3 波 / 項目 C
    // 開発者向けエラー画面を撤去し、子供向け中立コピー (罰則ゼロ厳守 / DEC-024) で救済する.
    // 真因 (LLM-as-Judge seed 未到達 / grammar-3, listening-3 等) は別 atomic で修復.
    return (
      <main
        className="mx-auto max-w-2xl px-6 py-10"
        data-testid="study-preparing-gate"
        data-level={level}
        data-skill={skillBase}
      >
        <div className="rounded-3xl border-[3px] border-secondary/40 bg-card p-8 shadow-md">
          <div className="mb-3 flex items-center gap-2">
            <SparklesIcon className="h-7 w-7 text-secondary" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold text-secondary">
              {SKILL_LABEL[skillBase]} (英検{level}級)
            </h1>
          </div>
          <p className="mb-2 text-base leading-relaxed">
            ここの ぼうけんは いま じゅんびちゅう だよ。
          </p>
          <p className="mb-6 text-base leading-relaxed">
            もうすぐ あえるから まっててね。
            <br />
            ほかの エリアで あそぼう!
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild size="lg" className="min-h-tap-cta w-full">
              <Link href="/adventure-map">
                <MapIcon className="mr-1 h-5 w-5" aria-hidden="true" />
                ぼうけんマップへ もどる
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-tap-cta w-full"
            >
              <Link href="/home">
                <HomeIcon className="mr-1 h-5 w-5" aria-hidden="true" />
                ホームへ もどる
              </Link>
            </Button>
          </div>
        </div>
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
  //
  // W11 follow-up (DEC-064): 非セッション直リンク経路でも learner-stable に変更。
  // - Next.js 16 Server Action の応答に refreshed RSC payload が同梱され、submitAnswer 完了直後に
  //   page.tsx が再評価される。submitAnswer は SRS dueAt を未来に更新するので getNextProblem(...) は
  //   次問 ID を返す。従来の `problem:<id>` key だと StudyClient が unmount → setFeedback(...) が
  //   破棄され「クリック後フィードバック描画なし」regression を引き起こした。
  // - learner-stable key にすると、StudyClient は同一インスタンスで problemId prop の変化を観測する。
  //   StudyClient 側の prevProblemId pattern + answeredView snapshot で「次の問題へ」を押すまで
  //   直前に答えた問題の prompt/choices/feedback を保持し続ける。
  const sessionRawId =
    typeof sessionRaw === "string" && sessionRaw.length > 0 ? sessionRaw : undefined;
  const studyClientKey = sessionRawId
    ? `session:${sessionRawId}`
    : `learner:${learner.id}`;

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
        skill={skillBase}
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
        serverTodayCumulativeSeconds={serverTodayCumulativeSeconds}
        studySessionDbId={studySessionDbId}
        kotodamaStage={learnerKotodamaStage}
      />
    </main>
  );
}
