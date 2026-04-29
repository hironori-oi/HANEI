/**
 * HANEI - Accessory Card (W9-B / /settings/accessories グリッド要素)
 *
 * 単一アクセサリの「SVG + 名前 + 解禁条件 / 装着状態」を表示する Component。
 *  - locked  → グレースケール + LockClosed + 解禁条件
 *  - unlocked → カラー + 装着切替ボタン (form action)
 *  - equipped → 装着中バッジ + ボタンが「はずす」
 *
 * "use client" は不要 (form action は Server Action / button submit で動く)。
 * Server Component として Server Action を直接 form の action に bind する。
 */

import {
  CheckBadgeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import {
  ACCESSORY_BY_CODE,
  describeUnlockCondition,
  type AccessoryCode,
} from "@/lib/accessories/catalog";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACCESSORY_COMPONENT_BY_CODE,
  type AccessoryComponent,
  HatSchoolCap,
} from "./index";

interface Props {
  code: AccessoryCode;
  /** 解禁済か (false なら locked 表示) */
  unlocked: boolean;
  /** 装着中か (true で「はずす」ボタン) */
  equipped: boolean;
  /** form action (toggleEquipped を呼ぶ Server Action) */
  toggleAction: (formData: FormData) => Promise<void>;
  className?: string;
}

export function AccessoryCard({
  code,
  unlocked,
  equipped,
  toggleAction,
  className,
}: Props) {
  const meta = ACCESSORY_BY_CODE[code];
  const Svg: AccessoryComponent =
    ACCESSORY_COMPONENT_BY_CODE[code] ?? HatSchoolCap;

  return (
    <Card
      data-testid={`accessory-card-${code}`}
      data-unlocked={unlocked ? "true" : "false"}
      data-equipped={equipped ? "true" : "false"}
      className={cn(
        "flex flex-col items-center gap-2 p-4",
        unlocked
          ? equipped
            ? "ring-2 ring-primary bg-primary/5"
            : "bg-card"
          : "bg-card/60",
        className,
      )}
    >
      {/* SVG (locked → grayscale) */}
      <div className={cn("relative", !unlocked && "grayscale opacity-50")}>
        <Svg size={80} decorative={false} />
        {!unlocked && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-border bg-background shadow"
          >
            <LockClosedIcon className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
        {equipped && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"
          >
            <CheckBadgeIcon className="h-5 w-5" />
          </span>
        )}
      </div>

      {/* 名前 + 説明 */}
      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <p className="text-base font-bold leading-tight text-foreground">
          {meta.name}
        </p>
        <p className="line-clamp-2 min-h-[2em] text-[11px] leading-snug text-muted-foreground">
          {meta.description}
        </p>
      </div>

      {/* 状態 + 切替ボタン */}
      {unlocked ? (
        <form action={toggleAction} className="w-full">
          <input type="hidden" name="code" value={code} />
          <Button
            type="submit"
            size="sm"
            variant={equipped ? "outline" : "default"}
            className="w-full"
            data-testid={`accessory-toggle-${code}`}
          >
            {equipped ? "はずす" : "つける"}
          </Button>
        </form>
      ) : (
        <p
          className="w-full text-center text-[11px] tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {describeUnlockCondition(meta)}
        </p>
      )}
    </Card>
  );
}
