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
import {
  endStudySession,
  recordStudyHeartbeat,
} from "@/lib/actions/study-sessions";
import { KotodamaTori, pickMood } from "@/components/study/kotodama-tori";
import { AnswerFeedbackEffects } from "@/components/study/answer-feedback-effects";
import type { KotodamaStage } from "@/lib/study/kotodama-tori-stage";
import { playSoundEffect, setSoundEffectsEnabled } from "@/lib/audio/sound-effects";
import { LessonCompleteModal } from "@/components/study/lesson-complete-modal";
import { SessionCompleteModal } from "@/components/study/SessionCompleteModal";
import { OverlearningModal } from "@/components/study/OverlearningModal";
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
import {
  HEARTBEAT_MAX_DELTA_SECONDS,
  hasReachedOverlearningHardLimit,
  hasReachedOverlearningNudge,
  todayMinutesFromSeconds,
} from "@/lib/study/study-time";

interface Choice {
  label: string;
  text: string;
}

/**
 * W11 follow-up (DEC-064): フィードバック描画中に「直前に答えた問題」を frozen 状態で
 * 保持するための snapshot 型。
 *
 * Next.js 16 Server Action は応答に refreshed RSC payload を同梱するため、submitAnswer 完了直後に
 * page.tsx が再評価され、props (problemId / prompt / choices / audioUrl) が次問に切替わる。
 * フィードバック描画中も「直前に答えた問題」を表示し続けるため、submitChoiceValue で本 snapshot を
 * setFeedback(...) と同時に capture し、handleNext で setFeedback(null) と一緒に null にする。
 */
type AnsweredView = {
  problemId: string;
  prompt: string;
  choices: Choice[];
  problemType: "mcq" | "writing_essay";
  audioUrl: string | null;
  skill: string | undefined;
};

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
  /**
   * W10-T5: 過学習防止 - 当日累計学習秒数 (server-rendered baseline).
   * - getTodayLearningSeconds(learnerId) の結果を server から下ろす
   * - 30 分 / 60 分 閾値判定 / heartbeat の起点として使う
   */
  serverTodayCumulativeSeconds?: number;
  /**
   * W10-T5: 過学習防止 - study_sessions DB row id.
   * - startOrResumeStudySession の結果を server から下ろす
   * - 設定されていない時は heartbeat / hard_limit 終了 server action を呼ばない (Phase 1 互換)
   */
  studySessionDbId?: string;
  /**
   * DEC-088 Plan B 項目 1: 学習者の現在進化段階.
   * AnswerFeedbackEffects に渡して 5 種 SVG から進化段階別キャラを描画する.
   * 未指定時は "hina" (後方互換).
   */
  kotodamaStage?: KotodamaStage;
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
    serverTodayCumulativeSeconds = 0,
    studySessionDbId,
    kotodamaStage = "hina",
  } = props;
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [startTime] = useState<number>(() => Date.now());

  // W11 follow-up (DEC-064): フィードバック描画中の prompt/choices/audio スナップショット。
  // - Next.js 16 Server Action 応答に同梱される refreshed RSC payload で page.tsx が再評価され、
  //   props (problemId / prompt / choices / audioUrl) が「次問」に切替わってしまう。
  // - その間も「直前に答えた問題」の prompt/choices/feedback を描画し続けるため、
  //   submitChoiceValue で setFeedback(...) と同時に answeredView を capture する。
  // - handleNext の「次の問題へ」押下で setFeedback(null) と一緒に setAnsweredView(null) して、
  //   次サイクルから props (新問) を描画ソースとして採用する。
  const [answeredView, setAnsweredView] = useState<AnsweredView | null>(null);
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

  // ---------------------------------------------------------------------------
  // W10-T5: 過学習防止 (cumulative tracking + 30/60 分 閾値)
  // ---------------------------------------------------------------------------
  // baselineSeconds = server から下ろした「当日累計秒数」
  // localElapsedSec = この StudyClient mount 後、heartbeat 反映前のローカル経過秒
  // total = baselineSeconds + localElapsedSec で 30/60 分閾値を判定する.
  //
  // React 19 pure-render 整合:
  //   - hard_limit は w10t5TodaySeconds から純粋に派生 (state なし)
  //   - nudge は「1 度だけ表示」のため state にするが、setState は setInterval callback 内で行う
  //   - lastHeartbeatRef は lazy init (effect setup 時に Date.now() を入れる)
  const trackingActive = Boolean(studySessionDbId);
  const [w10t5BaselineSeconds, setW10T5BaselineSeconds] = useState<number>(
    serverTodayCumulativeSeconds,
  );
  const [w10t5LocalElapsedSec, setW10T5LocalElapsedSec] = useState<number>(0);
  const [showOverlearningNudge, setShowOverlearningNudge] = useState(false);
  const w10t5LastHeartbeatRef = useRef<number>(0);
  const w10t5HardLimitEndedRef = useRef<boolean>(false);
  const w10t5NudgeShownRef = useRef<boolean>(false);
  // baseline + localElapsed の最新値を setInterval callback から読むための ref-mirror
  const w10t5BaselineRef = useRef<number>(serverTodayCumulativeSeconds);
  useEffect(() => {
    w10t5BaselineRef.current = w10t5BaselineSeconds;
  }, [w10t5BaselineSeconds]);

  const w10t5TodaySeconds = w10t5BaselineSeconds + w10t5LocalElapsedSec;
  const w10t5TodayMinutes = todayMinutesFromSeconds(w10t5TodaySeconds);
  // 派生値 (state なし / render 純粋)
  const showOverlearningHardLimit =
    trackingActive && hasReachedOverlearningHardLimit(w10t5TodaySeconds);

  // 1 秒 tick: localElapsed をインクリメント + nudge 閾値を setInterval callback 内で検知
  // (setState は callback 内なら set-state-in-effect 抵触なし)
  useEffect(() => {
    if (!trackingActive) return;
    if (showOverlearningHardLimit) return;
    // lazy init (render 中の Date.now() を回避)
    if (w10t5LastHeartbeatRef.current === 0) {
      w10t5LastHeartbeatRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      setW10T5LocalElapsedSec((s) => {
        const newLocal = s + 1;
        // nudge 閾値: ref から最新 baseline を読み出し
        if (!w10t5NudgeShownRef.current) {
          const total = w10t5BaselineRef.current + newLocal;
          if (hasReachedOverlearningNudge(total)) {
            w10t5NudgeShownRef.current = true;
            setShowOverlearningNudge(true);
          }
        }
        return newLocal;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [trackingActive, showOverlearningHardLimit]);

  // ~10 秒ごとに heartbeat を送信し server の cumulative_seconds を進める
  useEffect(() => {
    if (!trackingActive || !studySessionDbId) return;
    if (showOverlearningHardLimit) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsedSinceHeartbeat = Math.floor(
        (now - w10t5LastHeartbeatRef.current) / 1000,
      );
      if (elapsedSinceHeartbeat <= 0) return;
      // clamp on client side too (server 側でも clamp 済 / 多重防御)
      const delta = Math.min(elapsedSinceHeartbeat, HEARTBEAT_MAX_DELTA_SECONDS);
      w10t5LastHeartbeatRef.current = now;
      void recordStudyHeartbeat({
        learnerId,
        sessionDbId: studySessionDbId,
        additionalSeconds: delta,
      })
        .then((result) => {
          // server 値で baseline を置き換え、local をリセット (.then = callback / OK)
          setW10T5BaselineSeconds(result.todayCumulativeSeconds);
          setW10T5LocalElapsedSec(0);
        })
        .catch(() => {
          // silent fail-safe (network 一時的な失敗は次の heartbeat で再送される)
        });
    }, 10_000);
    return () => window.clearInterval(id);
  }, [trackingActive, studySessionDbId, showOverlearningHardLimit, learnerId]);

  // hard_limit 検知時の副作用: endStudySession を 1 度だけ呼ぶ (setState なし / OK)
  useEffect(() => {
    if (!showOverlearningHardLimit) return;
    if (!trackingActive || !studySessionDbId) return;
    if (w10t5HardLimitEndedRef.current) return;
    w10t5HardLimitEndedRef.current = true;
    const finalDelta = Math.min(
      Math.max(
        0,
        Math.floor((Date.now() - w10t5LastHeartbeatRef.current) / 1000),
      ),
      HEARTBEAT_MAX_DELTA_SECONDS,
    );
    // hard_limit reached: streak は守られる (本 action は streak に介入しない / DEC-024)
    void endStudySession({
      learnerId,
      sessionDbId: studySessionDbId,
      endReason: "hard_limit",
      finalAdditionalSeconds: finalDelta,
    }).catch(() => {
      // silent fail-safe (UI は既に hard_limit modal を表示中)
    });
  }, [
    showOverlearningHardLimit,
    trackingActive,
    studySessionDbId,
    learnerId,
  ]);

  const handleOverlearningContinue = () => {
    setShowOverlearningNudge(false);
  };
  const handleOverlearningRest = () => {
    setShowOverlearningNudge(false);
    router.push("/home");
  };

  // W8-T3 / W8-T4 + DEC-088 Plan B 項目 2: preferences をモジュール singleton に同期
  // - audio-feedback (oscillator) と sound-effects (Howler.js) の両方に同じ enabled を反映
  useEffect(() => {
    setAudioEnabled(soundEnabled);
    setConfettiEnabled(confettiEnabled);
    setSoundEffectsEnabled(soundEnabled);
  }, [soundEnabled, confettiEnabled]);
  // W7 B-10: writing_essay 用 textarea state
  const [essayDraft, setEssayDraft] = useState<string>("");
  const essayValidation = validateWritingInput(essayDraft);

  // G-2: audio 再生制御
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  // W10-T4 fix (M-A1): session-mode では page.tsx の key を session-stable にしたため
  // StudyClient は問題遷移で unmount されない。よって「問題が変わったときにリセットすべき
  // UI state」(選択 / フィードバック / エラー / essay 入力 / 音声再生回数) は明示的に
  // problemId 変化を観測してリセットする。
  //
  // W11 follow-up (DEC-064): 非セッション直リンク経路でも learner-stable key に変更したため
  // 同じく unmount しない。問題遷移経路は両モードで本 pattern に集約される。
  //
  // React 公式 "Resetting state when a prop changes" pattern (render 中に prev を比較し
  // 検知時に同期 setState する) を採用 — useEffect 内 setState は cascading render を
  // 招くため (react-hooks/set-state-in-effect) 避ける。
  //
  // 重要: フィードバック描画中 (feedback !== null) は reset しない。Server Action 応答に同梱される
  // refreshed RSC payload で props.problemId は次問に切替わるが、ユーザが「次の問題へ」を押すまで
  // 直前の問題 (answeredView snapshot + feedback) を表示し続けるため。「次の問題へ」押下後の
  // handleNext で setFeedback(null) + setAnsweredView(null) になった次サイクルで本ブロックの
  // reset 経路に入る。
  // - combo はセッション内継続が仕様 (W8-T2) のためここでは触らない
  // - sessionAnswers / sessionEarnedCoins / sessionStartTime / overtimeOffered も
  //   セッションスコープなので problem 単位ではリセットしない
  const [prevProblemId, setPrevProblemId] = useState(problemId);
  if (prevProblemId !== problemId) {
    setPrevProblemId(problemId);
    if (!feedback) {
      // フィードバック描画中は前問の解答結果を保持。reset せずに prop の変化を吸収する。
      setSelected(null);
      setError(null);
      setEssayDraft("");
      setPlayCount(0);
      setIsPlaying(false);
    }
  }

  // DEC-090 項目 1: 計測 t4 (次問 problemId が DOM 反映 / next-paint 近似)
  // - render 中に console.log すると React Strict Mode の double-render で誤計測になるため
  //   useEffect (problemId 変化検知) で 1 回だけ計測する
  // - t3 が記録されている時のみ出力 (handleNext 経路かつ dev 限定)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof process === "undefined" ||
      process.env.NODE_ENV === "production"
    ) {
      return;
    }
    if (latencyRef.current.t3 <= 0) return;
    const { t3 } = latencyRef.current;
    const t4 = performance.now();
    console.info(
      "[DEC-090 latency] next_problem_after_click=%dms",
      Math.round(t4 - t3),
    );
    latencyRef.current.t3 = 0;
  }, [problemId]);

  // W11 follow-up (DEC-064): 描画ソース。フィードバック描画中は answeredView (frozen) を、
  // それ以外は props を採用。これにより Server Action auto-revalidation 後に props が次問に
  // 切替わっても、ユーザが「次の問題へ」を押すまで「直前に答えた問題」の prompt/choices/audio を
  // 描画し続ける。feedback.correctAnswer / feedback.explanation は元から「frozen」(answer 時点の
  // 値) なのでそのまま使う。
  const displayedView: AnsweredView = answeredView ?? {
    problemId,
    prompt,
    choices,
    problemType,
    audioUrl: audioUrl ?? null,
    skill,
  };
  const isWriting = displayedView.problemType === "writing_essay";
  const showAudioUi = shouldShowAudioUi(displayedView.audioUrl, displayedView.skill);

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

  // DEC-090 項目 1 (β-blocker): latency 計測 ref / dev console output 用
  // - t0: ユーザーが選択肢を押した瞬間
  // - t1: submitAnswer Server Action が resolve した瞬間
  // - t2: feedback render commit 直後 (RAF callback / paint 完了近似)
  // - t3: 「つぎの問題へ」を押した瞬間
  // - t4: 次問の問題文が DOM に反映された瞬間 (problemId 変化検知)
  // ref は event handler 内でのみ書き込み (render 中ではない).
  // React 19 purity rule (react-hooks/immutability) は本 ref が useEffect 内でも参照されることを
  // 「effect-tracked」と判定するが、書き込みは startTransition / onClick 等の event 経路に限られるため
  // 個別に inline-disable する.
  const latencyRef = useRef<{ t0: number; t1: number; t2: number; t3: number }>({
    t0: 0,
    t1: 0,
    t2: 0,
    t3: 0,
  });
  const submitChoiceValue = (value: string) => {
    if (feedback || isPending) return;
    setError(null);
    // DEC-090 項目 1: 計測 t0 (選択肢タップ / event handler 経路)
    // submitChoiceValue は render 中ではなく onClick から呼ばれる event handler だが、
    // React 19 静的解析は本関数を「コンポーネント内で定義された関数」として扱い purity rule を発動する.
    // 本書込みは event handler 経路でのみ起こるため inline-disable する.
    // eslint-disable-next-line react-hooks/immutability, react-hooks/purity
    latencyRef.current.t0 = performance.now();
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
        // DEC-090 項目 1: 計測 t1 (submitAnswer resolve / async event handler 経路)
        latencyRef.current.t1 = performance.now();
        // W11 follow-up (DEC-064): フィードバック描画中に props (problemId/prompt/choices/audio)
        // が次問に切替わっても、ユーザが「次の問題へ」を押すまで本問題の描画を維持するため、
        // submitAnswer 完了時の props を snapshot に capture する。
        setAnsweredView({
          problemId,
          prompt,
          choices,
          problemType,
          audioUrl: audioUrl ?? null,
          skill,
        });
        setFeedback(result);
        // DEC-090 項目 1 (β-blocker / 最大効果): 次問 RSC payload を prefetch
        // - フィードバック描画中 (ユーザーが解説を読んでいる時間) に同 URL の RSC を warm
        // - これにより handleNext の router.refresh() がキャッシュヒットし、
        //   次問遷移が ~300-700ms (cold) → ~30-80ms (warm) に短縮
        // - 既に答えた問題はサーバー側 SRS dueAt 更新済 → getNextProblem で別問題が返る
        // - prefetch 失敗は silent (UX を壊さない)
        // - typedRoutes (next.config.ts) は静的 Route 型を期待するが、ここは window.location 由来の
        //   動的な現在 URL なので型チェックを限定回避 (runtime は文字列で OK)
        if (typeof window !== "undefined") {
          try {
            const path = window.location.pathname + window.location.search;
            (router as { prefetch: (href: string) => void }).prefetch(path);
          } catch {
            // silent: prefetch 失敗は次問取得時の cold 経路に fall-back
          }
        }
        // DEC-090 項目 1: 計測 t2 (feedback commit / paint 近似)
        // requestAnimationFrame で paint 直後を狙う (microtask より精度高い)
        if (typeof window !== "undefined" && typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => {
            latencyRef.current.t2 = performance.now();
            // dev / preview のみコンソール出力 (production は noop)
            if (
              typeof process !== "undefined" &&
              process.env.NODE_ENV !== "production"
            ) {
              const { t0, t1, t2 } = latencyRef.current;
              console.info(
                "[DEC-090 latency] action=%dms paint=%dms total_to_feedback=%dms",
                Math.round(t1 - t0),
                Math.round(t2 - t1),
                Math.round(t2 - t0),
              );
            }
          });
        }

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

        // W8-T3 / W8-T4 + DEC-088 Plan B 項目 2: 音響フィードバック + Confetti
        // - tier upgrade 瞬間: combo 音 + 軽い confetti (W8-T2 と連動)
        // - 通常正解: correct 音
        // - 不正解: incorrect 音
        // - Howler エンジン (sound-effects.ts) も並列で再生 (mp3 短尺 / 新エンジン)
        // すべて silent fail-safe (preferences / autoplay policy で skip 可)
        if (result.correct) {
          if (tierUpgraded) {
            void playFeedback("combo");
            void playSoundEffect("combo");
            void triggerConfetti("light");
          } else {
            void playFeedback("correct");
            void playSoundEffect("correct");
          }
          // W8-T4: 5 問以上連続正解後の終了でレッスン完了 modal を表示
          // W10-T4: ただしセッションモードでは SessionCompleteModal を優先
          if (newCombo >= 5 && !result.nextProblemId && !sessionActive) {
            setShowLessonComplete(true);
          }
        } else {
          void playFeedback("incorrect");
          void playSoundEffect("wrong");
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
      // DEC-090 項目 1: 計測 t3 (「つぎの問題へ」押下 / onClick event handler 経路)
      // eslint-disable-next-line react-hooks/immutability
      latencyRef.current.t3 = performance.now();
      // 同じ URL へ refresh で次問取得 (server で due/未学習を再評価)
      // - 直前の prefetch (submitChoiceValue 内で warm 済) で大半は cache hit
      // - cache hit 時は ~30-80ms / cold 時は ~300-700ms
      router.refresh();
      setSelected(null);
      setFeedback(null);
      // W11 follow-up (DEC-064): answeredView snapshot もここで明示 clear。
      // 次サイクルでは props.problemId が次問に変化済みなので、prevProblemId branch の
      // reset 経路 (feedback === null) に入って残りの state も clear される。
      setAnsweredView(null);
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

      {/* W8-T4: レッスン完了 modal (5 問以上連続正解後の終了時)
          DEC-088 Plan B 項目 5: totalXp / totalXpBeforeLesson を AnimatedFillBar に橋渡し */}
      <LessonCompleteModal
        open={showLessonComplete}
        streak={streak}
        earnedXp={feedback?.xpDelta}
        totalXp={feedback?.totalXp}
        totalXpBeforeLesson={
          feedback && typeof feedback.xpDelta === "number"
            ? Math.max(0, feedback.totalXp - feedback.xpDelta)
            : undefined
        }
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

      {/* W10-T5: 過学習防止 modal (nudge: 30 分到達 / hard_limit: 60 分到達) */}
      {/* hard_limit が立っている時は nudge を非表示にする (= hard_limit を優先) */}
      <OverlearningModal
        open={showOverlearningHardLimit}
        variant="hard_limit"
        todayMinutes={w10t5TodayMinutes}
        onRest={handleOverlearningRest}
      />
      {!showOverlearningHardLimit && (
        <OverlearningModal
          open={showOverlearningNudge}
          variant="nudge"
          todayMinutes={w10t5TodayMinutes}
          onRest={handleOverlearningRest}
          onContinueStudy={handleOverlearningContinue}
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
              src={displayedView.audioUrl ?? undefined}
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
            {displayedView.prompt}
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

      {/* DEC-087 §5/§6: 正解 / 不正解 演出キャラ (画面右下に spring bounce で出現)
          - 正解: 連続 3+ で多色 confetti / 罰則ゼロ
          - 不正解: 首かしげ (赤色未使用 / 罰語なし) */}
      {feedback ? (
        <AnswerFeedbackEffects
          key={`${feedback.correct ? "correct" : "wrong"}-${combo}`}
          variant={feedback.correct ? "correct" : "wrong"}
          comboCount={feedback.correct ? combo : 0}
          stage={kotodamaStage}
        />
      ) : null}

      {/* 選択肢 (Mint カード) — writing_essay では非表示
          DEC-087 §5/§6: 正解選択肢に Mint Green グロー / 不正解選択肢に短い横シェイク (赤色未使用)
       */}
      <div
        className={
          isWriting ? "hidden" : "grid gap-3 sm:grid-cols-2"
        }
      >
        {displayedView.choices.map((choice) => {
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
              data-state={
                isCorrectChoice
                  ? "correct"
                  : showWrong
                    ? "wrong"
                    : isSelected
                      ? "selected"
                      : "idle"
              }
              className={[
                "min-h-tap-cta rounded-lg border-2 px-5 py-4 text-left text-base transition-all motion-safe:duration-200",
                "hover:border-accent hover:bg-accent/10",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "disabled:cursor-not-allowed",
                // DEC-087 §5: 正解時 Mint Green グロー + 微 scale
                isCorrectChoice
                  ? "border-[color:var(--accent-correct)] bg-[color:var(--accent-correct)]/10 hanei-correct-glow motion-safe:scale-[1.02]"
                  : showWrong
                    // DEC-087 §6: 不正解時は赤色を使わず Amber Gold soft + 短い横シェイク
                    ? "hanei-soft-warm motion-safe:animate-hanei-wrong-shake"
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
                  className="ml-2 inline h-5 w-5 text-[color:var(--accent-correct)]"
                  aria-hidden="true"
                />
              )}
              {showWrong && (
                <XCircleIcon
                  className="ml-2 inline h-5 w-5 text-primary"
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
                  <h2 className="font-display text-xl font-bold text-success">
                    せいかい
                  </h2>
                </>
              ) : (
                <>
                  {/* DEC-087 §6: 罰則ゼロ哲学 / 赤色未使用 / Amber Gold 系 warning のみ
                      文言は「おしい」維持 (E2E `(せいかい|おしい)` selector 保護) */}
                  <XCircleIcon
                    className="h-7 w-7 text-warning"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-xl font-bold text-warning">
                    おしい
                  </h2>
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
