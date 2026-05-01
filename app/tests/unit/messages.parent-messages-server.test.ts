/**
 * Unit tests: src/lib/messages/parent-messages-server.ts (W11-T2 / DEC-062)
 *
 * findOldestUnreadMessage は純関数 (DB I/O なし). 配列だけで完結.
 *
 *   - 全既読 → null
 *   - 単一未読 → その 1 件
 *   - 複数未読 (新着 desc) → 最古 1 件 (= 配列末尾の未読)
 *   - 空配列 → null
 *   - 全未読 → 末尾 (最古) 1 件
 *
 * getMessageSenderName は DB に依存するため本ファイルでは findOldestUnreadMessage に集中.
 */

import { describe, expect, it } from "vitest";
import { findOldestUnreadMessage } from "@/lib/messages/parent-messages-server";
import type { ParentMessage } from "@/lib/db/schema";

function mkMsg(
  id: string,
  readAt: Date | null,
  createdAtSeconds: number,
): ParentMessage {
  return {
    id,
    familyId: "fam_1",
    fromUserId: "u_parent",
    toLearnerId: "lrn_1",
    templateCode: null,
    body: `body-${id}`,
    readAt,
    createdAt: new Date(createdAtSeconds * 1000),
  } as ParentMessage;
}

describe("findOldestUnreadMessage", () => {
  it("空配列 → null", () => {
    expect(findOldestUnreadMessage([])).toBeNull();
  });

  it("全既読 → null", () => {
    const now = Math.floor(Date.now() / 1000);
    const msgs = [
      mkMsg("a", new Date(), now),
      mkMsg("b", new Date(), now - 60),
      mkMsg("c", new Date(), now - 120),
    ];
    expect(findOldestUnreadMessage(msgs)).toBeNull();
  });

  it("単一未読 → その 1 件", () => {
    const now = Math.floor(Date.now() / 1000);
    const msgs = [
      mkMsg("a", new Date(), now),
      mkMsg("b", null, now - 60),
      mkMsg("c", new Date(), now - 120),
    ];
    const r = findOldestUnreadMessage(msgs);
    expect(r).not.toBeNull();
    expect(r?.id).toBe("b");
  });

  it("複数未読 (desc 配列の末尾が最古未読) → 最古 1 件を返す", () => {
    // 新着 desc = a (最新) > b > c (最古)
    const now = Math.floor(Date.now() / 1000);
    const msgs = [
      mkMsg("a", null, now),
      mkMsg("b", null, now - 60),
      mkMsg("c", null, now - 120),
    ];
    const r = findOldestUnreadMessage(msgs);
    expect(r?.id).toBe("c");
  });

  it("既読 + 未読が混在 → 配列末尾側 (最古) の未読を pick", () => {
    const now = Math.floor(Date.now() / 1000);
    const msgs = [
      mkMsg("a", null, now), // 最新 未読
      mkMsg("b", new Date(), now - 60), // 既読
      mkMsg("c", null, now - 120), // 最古 未読
    ];
    const r = findOldestUnreadMessage(msgs);
    expect(r?.id).toBe("c");
  });

  it("単独 1 件未読 → その 1 件", () => {
    const r = findOldestUnreadMessage([
      mkMsg("only", null, 1_000_000),
    ]);
    expect(r?.id).toBe("only");
  });

  it("単独 1 件既読 → null", () => {
    const r = findOldestUnreadMessage([
      mkMsg("only", new Date(), 1_000_000),
    ]);
    expect(r).toBeNull();
  });
});
