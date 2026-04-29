/**
 * HANEI - Badge Icons Registry (W9-T3)
 *
 * BadgeCode → React component mapping.
 * UI grid / celebration modal / progress card 全てがここを参照する。
 */

import type { ComponentType } from "react";
import type { BadgeCode } from "@/lib/badges/badge-codes";
import type { BadgeSvgProps } from "./palette";

import { FirstFlightBadgeIcon } from "./first-flight";
import { StreakKeeperBadgeIcon } from "./streak-keeper";
import { VocabMasterBadgeIcon } from "./vocab-master";
import { GrammarMasterBadgeIcon } from "./grammar-master";
import { ReadingMasterBadgeIcon } from "./reading-master";
import { ListeningMasterBadgeIcon } from "./listening-master";
import { FirstMockExamBadgeIcon } from "./first-mock-exam";
import { SakuraKeeperBadgeIcon } from "./sakura-keeper";

export type BadgeIconComponent = ComponentType<BadgeSvgProps>;

export const BADGE_ICON_BY_CODE: Readonly<Record<BadgeCode, BadgeIconComponent>> = {
  first_flight: FirstFlightBadgeIcon,
  streak_keeper: StreakKeeperBadgeIcon,
  vocab_master: VocabMasterBadgeIcon,
  grammar_master: GrammarMasterBadgeIcon,
  reading_master: ReadingMasterBadgeIcon,
  listening_master: ListeningMasterBadgeIcon,
  first_mock_exam: FirstMockExamBadgeIcon,
  sakura_keeper: SakuraKeeperBadgeIcon,
};

/** code から icon component を解決 (未知 code は first_flight にフォールバック) */
export function getBadgeIconComponent(code: BadgeCode): BadgeIconComponent {
  return BADGE_ICON_BY_CODE[code] ?? FirstFlightBadgeIcon;
}

export {
  FirstFlightBadgeIcon,
  StreakKeeperBadgeIcon,
  VocabMasterBadgeIcon,
  GrammarMasterBadgeIcon,
  ReadingMasterBadgeIcon,
  ListeningMasterBadgeIcon,
  FirstMockExamBadgeIcon,
  SakuraKeeperBadgeIcon,
};
export type { BadgeSvgProps } from "./palette";
