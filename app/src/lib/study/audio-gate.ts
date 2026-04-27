/**
 * HANEI - listening 音声 UI 表示判定 (W5 / G-2)
 *
 * audioUrl が truthy かつ skill が "listening" の場合のみ true。
 * vocab / grammar / reading / writing 問題には audio を出さない。
 */
export function shouldShowAudioUi(
  audioUrl: string | null | undefined,
  skill: string | null | undefined,
): boolean {
  if (skill !== "listening") return false;
  if (typeof audioUrl !== "string") return false;
  if (audioUrl.length === 0) return false;
  return true;
}

/**
 * 再生回数の上限到達判定。
 * 子どもが何度でも聞けると終わらない可能性があるため、Phase 1 は 3 回上限。
 */
export const MAX_REPLAY = 3;

export function canReplay(playCount: number): boolean {
  return playCount < MAX_REPLAY;
}
