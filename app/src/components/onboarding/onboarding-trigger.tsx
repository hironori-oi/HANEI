"use client";

/**
 * HANEI - DEC-088 Plan B (項目 4): Onboarding ストーリー Trigger (client wrapper)
 *
 * /home (server component) 配下に配置し、初回 mount 時に localStorage の
 * `hanei.onboarding.shown` flag を確認して、未表示なら 3 ページストーリーモーダルを描画する。
 *
 * 設計:
 *  - SSR 安全: server render 時は何も出さない (getServerSnapshot で常に "shown" 扱い → null)
 *  - hydration 後の useSyncExternalStore subscription で client 側 flag を反映
 *  - close 時に markOnboardingShown が呼ばれ、次回以降は出ない (DEC-088 §4 仕様)
 *  - flag は DB ではなく localStorage 完結 (mutation +0 維持 / DEC-006)
 *
 * 実装メモ:
 *  - useEffect 内 setState は react-hooks/set-state-in-effect lint で禁止されているため、
 *    useSyncExternalStore を用いて localStorage を「外部 store」として購読する.
 */

import * as React from "react";
import {
  isOnboardingShown,
  markOnboardingShown,
  ONBOARDING_STORAGE_KEY,
} from "@/lib/onboarding/storage";
import { OnboardingStoryModal } from "./onboarding-story-modal";

interface Props {
  /** 学習者ニックネーム (Page 1 の挨拶で利用) */
  learnerNickname?: string;
}

/**
 * localStorage の `hanei.onboarding.shown` を購読する subscribe 関数.
 *
 * window の `storage` event は同一タブの localStorage 変更を拾わないため
 * （仕様上 cross-tab のみ）、ローカルの mark 後の再描画は modal close 時の
 * setShownLocally(true) で別途明示的に切り替える。
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getClientSnapshot(): boolean {
  return isOnboardingShown();
}

function getServerSnapshot(): boolean {
  // SSR では「表示済」扱い → null を return → モーダル描画しない
  return true;
}

export function OnboardingTrigger({ learnerNickname }: Props) {
  const externallyShown = React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  // 同一タブ内で close 後に再 render を起こすためのローカルフラグ
  const [closedLocally, setClosedLocally] = React.useState(false);

  // E2E (Playwright) 環境では onboarding ストーリーを抑止する.
  // signup / onboarding / study などの 23 spec が全て /home を経由するため、
  // 各 spec で localStorage を仕込まずとも、build env に NEXT_PUBLIC_E2E_DISABLE_ONBOARDING=true
  // が立っていれば常に描画スキップする (production には影響しない / regression 0).
  if (process.env.NEXT_PUBLIC_E2E_DISABLE_ONBOARDING === "true") return null;

  // 表示済 (storage に flag あり) または 既に閉じた → 描画しない
  if (externallyShown || closedLocally) return null;

  return (
    <OnboardingStoryModal
      learnerNickname={learnerNickname}
      onClose={() => {
        // markOnboardingShown は OnboardingStoryModal 内 close ハンドラでも呼ばれるが、
        // ここでも明示的に呼ぶことで仕様の一貫性を担保する.
        markOnboardingShown();
        setClosedLocally(true);
      }}
    />
  );
}

// re-export for tests
export { ONBOARDING_STORAGE_KEY };
