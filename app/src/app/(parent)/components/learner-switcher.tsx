"use client";

/**
 * Learner Switcher (W4 / T-3)
 *
 * 複数子家族で学習者を切替えるためのヘッダー UI。
 *
 * 仕様:
 *  - shadcn Tabs で表示 (W3 で導入済 / 学習者数 1 名なら静的表示のみ)
 *  - 選択値は URL クエリ ?learner=<id> で保持 (ブックマーク可能)
 *  - 切替時 SR ライブリージョン (aria-live="polite") で「学習者を{name}さんに切替えました」と通知
 *
 * 三層認可:
 *  - learner ID 自体は SSR 側で family_members 経由で取得済 (本コンポーネントは表示のみ)
 *  - URL クエリから読んだ未知 learner ID は SSR の requireLearnerOwner で必ず弾かれる
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface LearnerOption {
  id: string;
  nickname: string;
}

interface LearnerSwitcherProps {
  learners: ReadonlyArray<LearnerOption>;
  /** 現在 SSR 側で確定済みの学習者 ID (?learner= 不一致時はこの値が SSR で fallback されている) */
  activeLearnerId: string;
}

export function LearnerSwitcher({
  learners,
  activeLearnerId,
}: LearnerSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  // SR 用の announcement のみ local state。tab の active 値は activeLearnerId (SSR 確定値)
  // を直接使う (Tabs は controlled, 値変更時は URL 更新 → SSR 再描画で activeLearnerId が
  // 更新される)
  const [announcement, setAnnouncement] = useState<string>("");

  if (learners.length <= 1) {
    return null;
  }

  function handleChange(nextId: string): void {
    if (nextId === activeLearnerId) return;
    const next = learners.find((l) => l.id === nextId);
    if (!next) return;

    setAnnouncement(`学習者を${next.nickname}さんに切替えました`);

    const usp = new URLSearchParams(params?.toString() ?? "");
    usp.set("learner", nextId);
    startTransition(() => {
      router.push(`${pathname}?${usp.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="sr-only" aria-live="polite" role="status">
        {announcement}
      </span>
      <Tabs value={activeLearnerId} onValueChange={handleChange}>
        <TabsList aria-label="学習者を切替">
          {learners.map((l) => (
            <TabsTrigger key={l.id} value={l.id}>
              {l.nickname}さん
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
