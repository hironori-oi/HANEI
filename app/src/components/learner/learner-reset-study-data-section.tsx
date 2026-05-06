"use client";

/**
 * Learner Reset Study Data Section (DEC-090 項目 4 / mutation +1 = 10/10 最終枠)
 *
 * 親が学習者の学習履歴を「やり直し」状態に戻すためのセクション.
 *
 * 設計原則 (DEC-024 罰則ゼロ哲学):
 *   - 「消す」「失う」「リセット」喪失語ゼロ. UI 表示は「やり直し」中立で統一.
 *   - 赤色未使用. WarningIcon (Heroicons) + Amber Gold tone.
 *   - 段階確認 2 段階モーダル: (1) 説明 → (2) 確認文字列入力.
 *
 * a11y:
 *   - role=dialog (Radix が自動付与) / aria-labelledby / aria-describedby
 *   - Esc で閉じる (Radix 標準).
 *   - 初回フォーカス: 確認 input field.
 *
 * mutation 経路:
 *   - 第 2 段階で「やり直し」入力 → resetLearnerStudyData(learnerId) (top-level Server Action #10)
 *   - 完了後: redirect("/home") + Toast「あたらしい旅にでよう！」 (中立)
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExclamationTriangleIcon,
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetLearnerStudyData } from "@/lib/actions/reset-learner-study-data";

interface Props {
  learnerId: string;
  learnerNickname: string;
}

type Stage = "idle" | "explain" | "confirm" | "running" | "done" | "error";

/** 段階 2 で完全一致を要求する確認文字列 (中立 = 「やり直し」). */
const CONFIRM_PHRASE = "やり直し";

export function LearnerResetStudyDataSection({
  learnerId,
  learnerNickname,
}: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [confirmText, setConfirmText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 段階 2 表示時に input にフォーカス (a11y / WCAG)
  useEffect(() => {
    if (stage === "confirm" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [stage]);

  const closeAll = () => {
    setStage("idle");
    setConfirmText("");
    setErrorMessage(null);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      closeAll();
    }
  };

  const handleStartFlow = () => {
    setErrorMessage(null);
    setConfirmText("");
    setStage("explain");
  };

  const handleAdvanceToConfirm = () => {
    setStage("confirm");
  };

  const handleSubmit = () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      setErrorMessage("確認の文字列が一致しません。「やり直し」と入力してください。");
      return;
    }
    setErrorMessage(null);
    setStage("running");
    startTransition(async () => {
      const result = await resetLearnerStudyData(learnerId);
      if (result.ok) {
        setStage("done");
        // 完了表示を一瞬見せてから /home に遷移 + 「あたらしい旅にでよう！」感
        setTimeout(() => {
          router.replace("/home?fresh=1");
          router.refresh();
        }, 1200);
      } else {
        setStage("error");
        setErrorMessage(result.error);
      }
    });
  };

  return (
    <Card
      data-testid="learner-reset-section"
      className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10"
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon
            className="mt-1 h-6 w-6 text-amber-600"
            aria-hidden="true"
          />
          <div className="flex-1">
            <CardTitle className="text-lg">学習のやり直し</CardTitle>
            <CardDescription>
              {learnerNickname}さんの 学習履歴を はじめから にして、
              ことだまトリも ひな に もどします。
              <br />
              ニックネームや 受験日、学習目標は そのまま のこります。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          onClick={handleStartFlow}
          data-testid="learner-reset-trigger"
          className="min-h-tap-cta gap-2"
        >
          <ArrowPathRoundedSquareIcon
            className="h-4 w-4"
            aria-hidden="true"
          />
          学習を やり直しする
        </Button>
      </CardContent>

      {/* 段階 1: 説明モーダル */}
      <Dialog
        open={stage === "explain"}
        onOpenChange={onOpenChange}
      >
        <DialogContent
          data-testid="learner-reset-explain-dialog"
          aria-describedby="learner-reset-explain-desc"
        >
          <DialogHeader>
            <DialogTitle>やり直してみる？</DialogTitle>
            <DialogDescription id="learner-reset-explain-desc">
              {learnerNickname}さんの 学習履歴を はじめから に します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              つぎの ものは はじめから に なります:
            </p>
            <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
              <li>かいとうの きろく / れんぞくにっすう / XP / バッジ</li>
              <li>ハネキン / ショップで かったもの</li>
              <li>ことだまトリの しんかだんかい (ひな に もどります)</li>
              <li>クエスト・もぎテストの きろく</li>
            </ul>
            <p className="pt-2">
              つぎの ものは そのまま のこります:
            </p>
            <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
              <li>ニックネーム / 受験日 / 学習目標</li>
              <li>通知・リマインドの 設定</li>
              <li>親からの メッセージ</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeAll}
              data-testid="learner-reset-cancel"
            >
              やめる
            </Button>
            <Button
              type="button"
              onClick={handleAdvanceToConfirm}
              data-testid="learner-reset-advance"
            >
              つぎへ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 段階 2: 確認文字列入力モーダル */}
      <Dialog
        open={stage === "confirm" || stage === "running" || stage === "error"}
        onOpenChange={(open) => {
          if (!open && stage !== "running") closeAll();
        }}
      >
        <DialogContent
          data-testid="learner-reset-confirm-dialog"
          aria-describedby="learner-reset-confirm-desc"
        >
          <DialogHeader>
            <DialogTitle>さいしゅう確認</DialogTitle>
            <DialogDescription id="learner-reset-confirm-desc">
              「<strong>{CONFIRM_PHRASE}</strong>」と 入力 して
              「やり直し スタート」を おしてください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="learner-reset-confirm-input">
              確認の もじを 入力
            </Label>
            <Input
              id="learner-reset-confirm-input"
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={stage === "running"}
              data-testid="learner-reset-confirm-input"
              autoComplete="off"
              aria-invalid={errorMessage ? "true" : "false"}
              aria-describedby={
                errorMessage ? "learner-reset-confirm-error" : undefined
              }
            />
            {errorMessage ? (
              <p
                id="learner-reset-confirm-error"
                role="alert"
                data-testid="learner-reset-confirm-error"
                className="text-sm text-amber-700 dark:text-amber-400"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeAll}
              disabled={stage === "running"}
              data-testid="learner-reset-back"
            >
              やめる
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                stage === "running" || confirmText.trim() !== CONFIRM_PHRASE
              }
              data-testid="learner-reset-submit"
            >
              {stage === "running" ? "やり直し中..." : "やり直し スタート"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完了モーダル */}
      <Dialog open={stage === "done"} onOpenChange={() => undefined}>
        <DialogContent
          data-testid="learner-reset-done-dialog"
          aria-describedby="learner-reset-done-desc"
        >
          <DialogHeader>
            <DialogTitle>あたらしい旅にでよう！</DialogTitle>
            <DialogDescription id="learner-reset-done-desc">
              {learnerNickname}さんの 学習を はじめから に しました。
              ホームに もどります。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <CheckCircleIcon
              className="h-12 w-12 text-amber-500"
              aria-hidden="true"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
