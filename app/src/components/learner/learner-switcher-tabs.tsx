"use client";

/**
 * LearnerSwitcherTabs (W6 / F-3)
 *
 * 親 (parent) が複数の learner を持つ家族向けの学習者切替 Tabs。
 * shadcn/ui Tabs (Radix base) を使い、選択した learner.id を URL クエリ `?learner=<id>` に反映する。
 *
 * 設計:
 *  - 学習者 1 名のみの家族では本コンポーネントは render されない (親側で条件分岐)
 *  - 各 trigger は nickname を表示。avatarId は currently kotodama_tori 固定 (DEC-004)
 *    のため Heroicons の SparklesIcon を共通アイコンとして添える
 *  - 切替は router.replace で URL クエリ更新 → Server Component が新しい learner で再描画
 */

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/outline";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export interface LearnerSwitcherLearner {
  id: string;
  nickname: string;
  /** DEC-004: 現状はキャラクター "kotodama_tori" 固定 */
  avatarId: string;
}

export interface LearnerSwitcherTabsProps {
  learners: ReadonlyArray<LearnerSwitcherLearner>;
  activeLearnerId: string;
}

export function LearnerSwitcherTabs(props: LearnerSwitcherTabsProps) {
  const { learners, activeLearnerId } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (next: string) => {
      if (next === activeLearnerId) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("learner", next);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [activeLearnerId, pathname, router, searchParams],
  );

  return (
    <Tabs
      value={activeLearnerId}
      onValueChange={handleChange}
      aria-label="学習者の切り替え"
    >
      <TabsList className="h-auto flex-wrap gap-1 p-1">
        {learners.map((l) => (
          <TabsTrigger
            key={l.id}
            value={l.id}
            className="min-h-tap-cta gap-2 px-4"
          >
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
            <span>{l.nickname}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
