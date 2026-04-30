"use client";

/**
 * 学習画面 / クライアント interaction (Amber Gold + Mint カード仕様)
 * - 4 択選択 → 即時正誤フィードバック
 * - 解説表示 → SRS 更新 (Server Action: submitAnswer)
 * - 連続正解で XP 加算 + ことだまトリ mood 変化 (W5 G-5)
 * - listening 問題は TTS audio 再生 UI を表示 (W5 G-2)
 * - writing_essay は textarea + 文字数カウンタ + AI フィードバック表示 (W7 B-10 / DEC-039)
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  PauseIcon,
  ArrowPathIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { submitAnswer } from "@/lib/actions/study";
import { KotodamaTori, pickMood } from "@/components/study/kotodama-tori";
import { LessonCompleteModal } from "@/components/study/lesson-complete-modal";
import { SessionCompleteModal } from "@/components/study/SessionCompleteModal";
import { ComboCounter } from "@/components/study/combo-counter";
import { isComboTierUpgrade, nextComboCount } from "@/lib/study/combo";
import { MAX_REPLAY, canReplay, shouldShowAudioUi } from "@/lib/study/audio-gate";
import {
  WRITING_INPUT_MAX_LENGTH,
  validateWritingInput,
} from "@/lib/study/writing-input";
import {
  initAudioContext,
  playFeedback,
  setAudioEnabled,
} from "@/lib/study/audio-feedback";
import { setConfettiEnabled, triggerConfetti } from "@/lib/study/confetti";
import {
  hasReachedOvertime,
  isSessionDurationMinutes,
  summarizeSession,
  type SessionDurationMinutes,
} from "@/lib/study/session-composer";

interface Choice {
  label: string;
  text: string;
}

interface FeedbackResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  xpDelta: number;
  totalXp: number;
  nextProblemId: string | null;
  streak: number;
  /** W8-T2: combo XP 倍率 (server で計算済) */
  comboMultiplier: number;
  /** W8-T2: combo tier 0/1/2/3 */
  comboTier: 0 | 1 | 2 | 3;
}

export function StudyClient(props: {
  learnerId: string;
  problemId: string;
  /** 問題種別 (W7 B-10): "writing_essay" は textarea 入力 / それ以外は 4 択ラジオ */
  problemType?: "mcq" | "writing_essay";
  prompt: string;
  choices: Choice[];
  audioUrl?: string | null;
  skill?: string;
  /** 学習者 preferences (W8-T3 / W8-T4) — 効果音 / 紙吹雪 ON-OFF */
  soundEnabled?: boolean;
  confettiEnabled?: boolean;
  /** W10-T4: セッション情報 (Phase 1 既存ルート互換のため optional) */
  sessionDurationMinutes?: SessionDurationMinutes;
  /** W10-T4: planSize (composeStudySession で計算 / Server から下ろす) */
  sessionPlanSize?: number;
  /** W10-T4: セッション ID (URL から伝搬 / 同一セッション識別用) */
  sessionId?: string;
}) {
  const {
    learnerId,
    problemId,
    problemType = "mcq",
    prompt,
    choices,
    audioUrl,
    skill,
    soundEnabled = true,
    confettiEnabled = true,
    sessionDurationMinutes,
    sessionPlanSize,
    sessionId,
  } = props;
  const isWriting = problemType === "writing_essay";
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [startTime] = useState<number>(() => Date.now());
  // W8-T4: レッスン完了 modal 表示 state
  const [showLessonComplete, setShowLessonComplete] = useState(false);
  // W8-T2: 連続正解 combo state (1 セッション内のみ有効、不正解 / セッション終了でリセット)
  const [combo, setCombo] = useState<number>(0);
  const [comboJustUpgraded, setComboJustUpgraded] = useState<boolean>(false);

  // W10-T4: セッション集計 state (problemType 横断 / 同一 sessionId 内で持続)
  const sessionActive =
    isSessionDurationMinutes(sessionDurationMinutes) &&
    typeof sessionPlanSize === "number" &&
    sessionPlanSize > 0;
  const [sessionAnswers, setSessionAnswers] = useState<
    Array<{ correct: boolean }>
  >([]);
  const [sessionEarnedCoins, setSessionEarnedCoins] = useState<number>(0);
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState<
    "natural" | "abort" | "overtime"
  >("natural");
  const [sessionStartTime] = useState<number>(() => Date.now());
  const [overtimeOffered, setOvertimeOffered] = useState(false);

  // W10-T4: overtime 監視 (sessionActive な時のみ / 1 回のみ提案)
  useEffect(() => {
    if (!sessionActive || overtimeOffered || showSessionComplete) return;
    if (!isSessionDurationMinutes(sessionDurationMinutes)) return;
    const interval = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (hasReachedOvertime(sessionDurationMinutes, elapsedSec)) {
        setOvertimeOffered(true);
        setSessionEndReason("overtime");
        setShowSessionComplete(true);
        window.clearInterval(interval);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [
    sessionActive,
    overtimeOffered,
    showSessionComplete,
    sessionDurationMinutes,
    sessionStartTime,
  ]);

  // W8-T3 / W8-T4: preferences をモジュール singleton に同期
  useEffect(() => {
    setAudioEnabled(soundEnabled);
    setConfettiEnabled(confettiEnabled);
  }, [soundEnabled, confettiEnabled]);
  // W7 B-10: writing_essay 用 textarea state
  const [essayDraft, setEssayDraft] = useState<string>("");
  const essayValidation = validateWritingInput(essayDraft);

  // G-2: audio 再生制御
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const showAudioUi = shouldShowAudioUi(audioUrl, skill);

  const handlePlayToggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      return;
    }
    if (!canReplay(playCount)) return;
    el.currentTime = 0;
    void el.play();
  };

  const handleReplay = () => {
    const el = audioRef.current;
    if (!el || !canReplay(playCount)) return;
    el.currentTime = 0;
    void el.play();
  };

  const submitChoiceValue = (value: string) => {
    if (feedback || isPending) return;
    setError(null);
    // W8-T3: 最初のユーザー操作後に AudioContext を初期化 (autoplay policy)
    initAudioContext();
    startTransition(async () => {
      try {
        const result = await submitAnswer({
          learnerId,
          problemId,
          choice: value,
          timeSpentMs: Date.now() - startTime,
          clientCombo: combo,
        });
        setFeedback(result);

        // W8-T2: combo state 更新 (セッション内 / 不正解で 0 リセット)
        const previousCombo = combo;
        const newCombo = nextComboCount(previousCombo, result.correct);
        setCombo(newCombo);
        const tierUpgraded = isComboTierUpgrade(previousCombo, newCombo);
        // tier 上昇瞬間のみ pulse animation を 1 回起動
        if (tierUpgraded) {
          setComboJustUpgraded(true);
          // 600ms 後に flag を戻す (1 回の animation 用)
          window.setTimeout(() => setComboJustUpgraded(false), 700);
        } else {
          setComboJustUpgraded(false);
        }

        // W8-T3 / W8-T4: 音響フィードバック + Confetti
        // - tier upgrade 瞬間: combo 音 + 軽い confetti (W8-T2 と連動)
        // - 通常正解: correct 音
        // - 不正解: incorrect 音
        // すべて silent fail-safe (preferences / autoplay policy で skip 可)
        if (result.correct) {
          if (tierUpgraded) {
            void playFeedback("combo");
            void triggerConfetti("light");
          } else {
            void playFeedback("correct");
          }
          // W8-T4: 5 問以上連続正解後の終了でレッスン完了 modal を表示
          // W10-T4: ただしセッションモードでは SessionCompleteModal を優先
          if (newCombo >= 5 && !result.nextProblemId && !sessionActive) {
            setShowLessonComplete(true);
          }
        } else {
          void playFeedback("incorrect");
        }

        // W10-T4: セッション集計 (problemType 横断 / Phase 1 では LESSON_CORRECT XP=2 ≒ ハネキン換算)
        // ハネキン獲得は server (DEC-055 LESSON_CORRECT=2) で別途行われる前提のため
        // ここでは XP delta を一時的な可視化値として持つ (server-of-truth は coin_transactions)
        if (sessionActive) {
          setSessionAnswers((prev) => [...prev, { correct: result.correct }]);
          if (result.correct) {
            setSessionEarnedCoins((prev) => prev + 2);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "解答の送信に失敗しました");
        setSelected(null);
      }
    });
  };

  const handleSelect = (label: string) => {
    if (feedback || isPending) return;
    setSelected(label);
    submitChoiceValue(label);
  };

  const handleSubmitEssay = () => {
    if (feedback || isPending) return;
    if (!essayValidation.isValid) {
      setError(essayValidation.errorMessage ?? "もう少しだけ書いてみよう。");
      return;
    }
    setSelected(essayDraft);
    submitChoiceValue(essayDraft);
  };

  const handleNext = () => {
    // W10-T4: セッションモードで planSize に到達したら SessionCompleteModal を優先
    if (
      sessionActive &&
      typeof sessionPlanSize === "number" &&
      sessionAnswers.length >= sessionPlanSize
    ) {
      setSessionEndReason("natural");
      setShowSessionComplete(true);
      return;
    }
    if (feedback?.nextProblemId) {
      // 同じ URL へ refresh で次問取得 (server で due/未学習を再評価)
      router.refresh();
      setSelected(null);
      setFeedback(null);
      setEssayDraft("");
      // W8-T2: combo はセッション中継続 (router.refresh() でも useState は維持される)
      // ただし「不正解」では既に 0 リセット済み。意図的な離脱は別フローでハンドル。
    } else {
      // セッション終了 -> combo を 0 リセット
      setCombo(0);
      setComboJustUpgraded(false);
      router.push("/home");
    }
  };

  // W10-T4: 「ここまでにする」ボタン
  const handleAbortSession = () => {
    setSessionEndReason("abort");
    setShowSessionComplete(true);
  };

  // G-5: ことだまトリ mood 計算
  const lastResult: "correct" | "wrong" | null = feedback
    ? feedback.correct
      ? "correct"
      : "wrong"
    : null;
  const streak = feedback?.streak ?? 0;
  const mood = pickMood(lastResult, streak);

  return (
    <div className="space-y-6">
      {/* W8-T2: combo カウンター (右上 fixed / tier 1 以上で表示) */}
      <ComboCounter comboCount={combo} justUpgraded={comboJustUpgraded} />

      {/* G-5: ことだまトリ コンパニオン */}
      <KotodamaTori mood={mood} streak={streak} lastResult={lastResult} />

      {/* W8-T4: レッスン完了 modal (5 問以上連続正解後の終了時) */}
      <LessonCompleteModal
        open={showLessonComplete}
        streak={streak}
        earnedXp={feedback?.xpDelta}
        onContinue={() => {
          setShowLessonComplete(false);
          router.push("/home");
        }}
        onClose={() => setShowLessonComplete(false)}
      />

      {/* W10-T4: セッション完了 modal (planSize 到達 / 「ここまで」/ overtime 提案) */}
      {sessionActive &&
        isSessionDurationMinutes(sessionDurationMinutes) &&
        showSessionComplete && (
          <SessionCompleteModal
            open={showSessionComplete}
            durationMinutes={sessionDurationMinutes}
            reason={sessionEndReason}
            summary={summarizeSession(sessionAnswers, sessionEarnedCoins)}
            onContinue={() => {
              setShowSessionComplete(false);
              router.push("/home");
            }}
            onContinueStudy={() => {
              // overtime で「もうすこし やる」が押された場合: モーダルを閉じてセッション続行
              setShowSessionComplete(false);
            }}
            onClose={() => setShowSessionComplete(false)}
          />
        )}

      {/* W10-T4: セッションモード時のみ「ここまでにする」ボタン (任意中断 / 罰則ゼロ) */}
      {sessionActive && !showSessionComplete && (
        <div
          className="flex items-center justify-between gap-2"
          data-session-id={sessionId ?? undefined}
        >
          <p
            className="text-xs tabular-nums text-muted-foreground"
            data-testid="session-progress-line"
            data-answered={sessionAnswers.length}
            data-plan-size={sessionPlanSize}
          >
            セッション {sessionAnswers.length} / {sessionPlanSize} もん
            ({sessionDurationMinutes} ふん)
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleAbortSession}
            data-testid="session-abort-cta"
            aria-label="セッションを ここまでにする"
          >
            <StopCircleIcon className="h-4 w-4" aria-hidden="true" />
            <span className="ml-1 text-xs">ここまでに する</span>
          </Button>
        </div>
      )}

      {/* G-2: listening 問題の TTS audio 再生 UI */}
      {showAudioUi && (
        <Card
          data-testid="audio-player"
          className="border-accent/30 bg-accent/5"
        >
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-semibold">
              <ruby>
                音
                <rt>おと</rt>
              </ruby>
              を{" "}
              <ruby>
                聞
                <rt>き</rt>
              </ruby>
              く
            </span>
            <Button
              type="button"
              size="default"
              variant="outline"
              onClick={handlePlayToggle}
              disabled={!isPlaying && !canReplay(playCount)}
              aria-label={isPlaying ? "一時停止" : "音声を再生"}
              aria-pressed={isPlaying}
              data-testid="audio-play-toggle"
              className="min-h-tap-cta"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5" aria-hidden="true" />
              ) : (
                <SpeakerWaveIcon className="h-5 w-5" aria-hidden="true" />
              )}
              <span>{isPlaying ? "とめる" : "さいせい"}</span>
            </Button>
            <Button
              type="button"
              size="default"
              variant="ghost"
              onClick={handleReplay}
              disabled={!canReplay(playCount)}
              aria-label="もう一度聞く"
              data-testid="audio-replay"
              className="min-h-tap-cta"
            >
              <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
              <span>もう一度きく</span>
            </Button>
            <span
              className="ml-auto text-xs tabular-nums text-muted-foreground"
              aria-live="polite"
              data-testid="audio-play-count"
            >
              {playCount} / {MAX_REPLAY} かい
            </span>
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              preload="metadata"
              onPlay={() => {
                setIsPlaying(true);
                setPlayCount((c) => c + 1);
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              data-testid="audio-element"
            >
              <track kind="captions" />
            </audio>
          </CardContent>
        </Card>
      )}

      {/* 問題カード (Amber Gold tone) */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-6 sm:p-8">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            {isWriting
              ? "つぎのお題に英語で答えてみよう"
              : "つぎの英文の ( ) に入る言葉をえらびましょう"}
          </p>
          <p
            className="text-xl font-medium leading-relaxed sm:text-2xl"
            data-testid="study-prompt"
          >
            {prompt}
          </p>
        </CardContent>
      </Card>

      {/* writing_essay 入力 (W7 B-10) - お手本回答は送信前に出さない (カンニング防止) */}
      {isWriting && (
        <Card className="border-accent/30 bg-card">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <label
              htmlFor="essay-textarea"
              className="block text-sm font-semibold"
            >
              あなたの こたえ
            </label>
            <textarea
              id="essay-textarea"
              data-testid="essay-textarea"
              value={essayDraft}
              onChange={(e) => setEssayDraft(e.target.value)}
              onFocus={(e) => {
                // モバイル想定: フォーカス時に textarea を可視領域に寄せる
                if (typeof e.currentTarget.scrollIntoView === "function") {
                  e.currentTarget.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              }}
              disabled={feedback !== null || isPending}
              maxLength={WRITING_INPUT_MAX_LENGTH}
              rows={6}
              placeholder="自由に英語で書いてみよう。お手本があるけど、あなたの言葉が一番大切だよ。"
              aria-label="英作文の解答を入力"
              aria-describedby="essay-counter essay-hint"
              className="block w-full resize-y rounded-md border-2 border-input bg-background px-3 py-3 text-base leading-relaxed ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <p
                id="essay-hint"
                className="text-xs text-muted-foreground"
              >
                10文字いじょうから「決定」できるよ。
              </p>
              <span
                id="essay-counter"
                data-testid="essay-counter"
                aria-live="polite"
                className="text-xs tabular-nums text-muted-foreground"
              >
                {essayValidation.length} / {WRITING_INPUT_MAX_LENGTH}
              </span>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={handleSubmitEssay}
              disabled={
                feedback !== null || isPending || !essayValidation.isValid
              }
              data-testid="essay-submit"
              className="min-h-tap-cta w-full"
            >
              決定
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 選択肢 (Mint カード) — writing_essay では非表示 */}
      <div
        className={
          isWriting ? "hidden" : "grid gap-3 sm:grid-cols-2"
        }
      >
        {choices.map((choice) => {
          const isSelected = selected === choice.label;
          const isCorrectChoice =
            feedback && choice.label === feedback.correctAnswer;
          const showWrong = feedback && isSelected && !feedback.correct;
          return (
            <button
              key={choice.label}
              type="button"
              onClick={() => handleSelect(choice.label)}
              disabled={feedback !== null || isPending}
              data-testid={`choice-${choice.label}`}
              className={[
                "min-h-tap-cta rounded-lg border-2 px-5 py-4 text-left text-base transition-all",
                "hover:border-accent hover:bg-accent/10",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "disabled:cursor-not-allowed",
                isCorrectChoice
                  ? "border-success bg-success/10"
                  : showWrong
                    ? "border-destructive bg-destructive/10"
                    : isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card",
              ].join(" ")}
            >
              <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {choice.label}
              </span>
              <span>{choice.text}</span>
              {isCorrectChoice && (
                <CheckCircleIcon
                  className="ml-2 inline h-5 w-5 text-success"
                  aria-hidden="true"
                />
              )}
              {showWrong && (
                <XCircleIcon
                  className="ml-2 inline h-5 w-5 text-destructive"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* フィードバック + 解説 */}
      {feedback && (
        <Card
          data-testid="study-feedback"
          className={
            feedback.correct
              ? "border-success/40 bg-success/5"
              : "border-warning/40 bg-warning/5"
          }
        >
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              {feedback.correct ? (
                <>
                  <CheckCircleIcon
                    className="h-7 w-7 motion-safe:animate-bounce text-success"
                    aria-hidden="true"
                  />
                  <h2 className="text-xl font-bold text-success">せいかい</h2>
                </>
              ) : (
                <>
                  <XCircleIcon
                    className="h-7 w-7 text-warning"
                    aria-hidden="true"
                  />
                  <h2 className="text-xl font-bold text-warning">おしい</h2>
                </>
              )}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                +{feedback.xpDelta} XP
              </span>
            </div>
            {!feedback.correct && !isWriting && (
              <p className="text-sm">
                正解は{" "}
                <span className="font-bold text-success">{feedback.correctAnswer}</span>{" "}
                でした。
              </p>
            )}
            <div>
              <h3 className="mb-1 text-sm font-semibold">
                {isWriting ? "せんせいから" : "かいせつ"}
              </h3>
              <p
                className="text-sm leading-relaxed text-foreground"
                data-testid="study-explanation"
              >
                {feedback.explanation}
              </p>
            </div>
            {isWriting && (
              <div data-testid="essay-model-answer">
                <h3 className="mb-1 text-sm font-semibold">おてほん</h3>
                <p className="text-sm leading-relaxed text-foreground">
                  {feedback.correctAnswer}
                </p>
              </div>
            )}
            <Button
              onClick={handleNext}
              size="lg"
              className="min-h-tap-cta w-full"
              data-testid="study-next"
            >
              つぎの問題へ
              <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      )}

      {isPending && !feedback && (
        <p className="text-center text-sm text-muted-foreground">採点中...</p>
      )}
    </div>
  );
}
