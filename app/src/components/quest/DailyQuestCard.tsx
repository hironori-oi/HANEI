"use client";

/**
 * DailyQuestCard - 1 件分のクエスト表示 (W10-T3 / DEC-024 罰則ゼロ)
 *
 * Client Component:
 *   - 進捗バー (progress / target)
 *   - 達成済 + 未受領: 「うけとる」ボタン (claimQuestReward 呼び出し)
 *   - 未達成: 進捗テキスト + 励まし文言 (罰則ゼロ哲学)
 *   - 受領済: 「うけとりずみ」状態 (チェックマーク)
 *
 * 並行制御:
 *   - 「うけとる」ボタンは pending 中 disabled (連打耐性)
 *   - skipped=true (=他 tab で先取り or 既に claimed) でも素直に「うけとりずみ」に倒す
 *
 * 子ども向け文言:
 *   - 平仮名/カタカナ寄せ
 *   - 報酬 + ハネキン明示
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckBadgeIcon, GiftIcon } from "@heroicons/react/24/outline";
import type { DailyQuestView } from "@/lib/actions/quests";
import type { ClaimQuestRewardResult } from "@/lib/actions/quests";

interface DailyQuestCardProps {
  quest: DailyQuestView;
  /** Server Action wrapper (page から closure-bound learnerId で渡される) */
  onClaim: (questId: string) => Promise<ClaimQuestRewardResult>;
}

export function DailyQuestCard({ quest, onClaim }: DailyQuestCardProps) {
  const [pending, setPending] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);
  const [bonusMessage, setBonusMessage] = React.useState<string | null>(null);

  const pct =
    quest.target > 0
      ? Math.min(100, Math.floor((quest.progress / quest.target) * 100))
      : 0;

  async function handleClick() {
    if (pending) return;
    if (!quest.isClaimable && quest.status !== "in_progress") return;
    setPending(true);
    try {
      const r = await onClaim(quest.id);
      if (r.ok) {
        if (r.skipped) {
          setResultMessage("もう うけとりずみだよ。");
        } else {
          setResultMessage(`ありがとう！ ハネキンを ${r.reward} こ もらいました。`);
          if (r.allDoneBonusGranted && r.bonusAmount) {
            setBonusMessage(
              `さらに 3 つぜんぶ クリアの ボーナス ハネキンを ${r.bonusAmount} こ もらいました！`,
            );
          }
        }
      } else if (r.reason === "not_completed") {
        setResultMessage("もうすこし がんばろう。あと しっかり とりくむと もらえるよ。");
      } else {
        setResultMessage("もう いちど ためしてみてね。");
      }
    } catch {
      setResultMessage("もう いちど ためしてみてね。");
    } finally {
      setPending(false);
    }
  }

  const claimed = quest.status === "claimed";

  return (
    <Card
      data-testid={`quest-card-${quest.questType}`}
      data-quest-id={quest.id}
      data-status={quest.status}
      data-completed={quest.isCompleted ? "1" : "0"}
      className="flex flex-col"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{quest.title}</CardTitle>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF5DC] px-2.5 py-1 text-xs font-bold text-[#B97F18] dark:bg-[#3A2A0A] dark:text-[#F2A93A]"
            aria-label={`ほうしゅう ${quest.rewardCoins} ハネキン`}
          >
            <GiftIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">+{quest.rewardCoins}</span>
            <span>ハネキン</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <Progress
            value={pct}
            aria-label={`進捗 ${quest.progress} / ${quest.target}`}
            data-testid={`quest-progress-${quest.questType}`}
          />
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">
              {quest.progress}
            </span>
            <span> / </span>
            <span className="tabular-nums">{quest.target}</span>
            <span> ・ {pct}%</span>
          </p>
        </div>

        {claimed ? (
          <div
            className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            role="status"
            data-testid={`quest-claimed-${quest.questType}`}
          >
            <CheckBadgeIcon
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>うけとりずみ。よく がんばりました。</span>
          </div>
        ) : quest.isClaimable ? (
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={handleClick}
            className="min-h-tap-cta w-full"
            aria-label={`ハネキン ${quest.rewardCoins} 個を うけとる`}
            data-testid={`quest-claim-button-${quest.questType}`}
          >
            <GiftIcon className="h-5 w-5" aria-hidden="true" />
            <span>{pending ? "うけとり中..." : "うけとる"}</span>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground" role="status">
            きょうのもんだいを とくと、メーターが ふえるよ。
          </p>
        )}

        {resultMessage ? (
          <p
            className="text-xs text-emerald-700 dark:text-emerald-400"
            role="status"
            aria-live="polite"
            data-testid={`quest-result-${quest.questType}`}
          >
            {resultMessage}
          </p>
        ) : null}
        {bonusMessage ? (
          <p
            className="text-xs font-bold text-[#B97F18] dark:text-[#F2A93A]"
            role="status"
            aria-live="polite"
            data-testid={`quest-all-done-bonus-${quest.questType}`}
          >
            {bonusMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
