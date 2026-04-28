"use client";

/**
 * 学習画面 / クライアント interaction (Amber Gold + Mint カード仕様)
 * - 4 択選択 → 即時正誤フィードバック
 * - 解説表示 → SRS 更新 (Server Action: submitAnswer)
 * - 連続正解で XP 加算 + ことだまトリ mood 変化 (W5 G-5)
 * - listening 問題は TTS audio 再生 UI を表示 (W5 G-2)
 * - writing_essay は textarea + 文字数カウンタ + AI フィードバック表示 (W7 B-10 / DEC-039)
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  PauseIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { submitAnswer } from "@/lib/actions/study";
import { KotodamaTori, pickMood } from "@/components/study/kotodama-tori";
import { MAX_REPLAY, canReplay, shouldShowAudioUi } from "@/lib/study/audio-gate";
import {
  WRITING_INPUT_MAX_LENGTH,
  validateWritingInput,
} from "@/lib/study/writing-input";

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
}) {
  const {
    learnerId,
    problemId,
    problemType = "mcq",
    prompt,
    choices,
    audioUrl,
    skill,
  } = props;
  const isWriting = problemType === "writing_essay";
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [startTime] = useState<number>(() => Date.now());
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
    startTransition(async () => {
      try {
        const result = await submitAnswer({
          learnerId,
          problemId,
          choice: value,
          timeSpentMs: Date.now() - startTime,
        });
        setFeedback(result);
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
    if (feedback?.nextProblemId) {
      // 同じ URL へ refresh で次問取得 (server で due/未学習を再評価)
      router.refresh();
      setSelected(null);
      setFeedback(null);
      setEssayDraft("");
    } else {
      router.push("/home");
    }
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
      {/* G-5: ことだまトリ コンパニオン */}
      <KotodamaTori mood={mood} streak={streak} lastResult={lastResult} />

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
