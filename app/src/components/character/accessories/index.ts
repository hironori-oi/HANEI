/**
 * HANEI - Accessories Component Registry (W9-B)
 *
 * AccessoryCode → React component mapping。
 * /settings/accessories grid + character-with-accessories overlay 双方が参照する。
 */

import type { ComponentType } from "react";
import type { AccessoryCode } from "@/lib/accessories/catalog";

import { HatSchoolCap } from "./hat-school-cap";
import { HatSakuraCrown } from "./hat-sakura-crown";
import { HatEikenPass } from "./hat-eiken-pass";
import { HatGuardianCrown } from "./hat-guardian-crown";
import { ScarfRed } from "./scarf-red";
import { ScarfKasuri } from "./scarf-kasuri";
import { ScarfSakura } from "./scarf-sakura";
import { ScarfKinran } from "./scarf-kinran";
import { WingCharmBell } from "./wing-charm-bell";
import { WingCharmSakura } from "./wing-charm-sakura";
import { WingCharmTorii } from "./wing-charm-torii";
import { WingCharmMoonlight } from "./wing-charm-moonlight";

export interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export type AccessoryComponent = ComponentType<AccessorySvgProps>;

export const ACCESSORY_COMPONENT_BY_CODE: Readonly<
  Record<AccessoryCode, AccessoryComponent>
> = {
  hat_school_cap: HatSchoolCap,
  hat_sakura_crown: HatSakuraCrown,
  hat_eiken_pass: HatEikenPass,
  hat_guardian_crown: HatGuardianCrown,
  scarf_red: ScarfRed,
  scarf_kasuri: ScarfKasuri,
  scarf_sakura: ScarfSakura,
  scarf_kinran: ScarfKinran,
  wing_charm_bell: WingCharmBell,
  wing_charm_sakura: WingCharmSakura,
  wing_charm_torii: WingCharmTorii,
  wing_charm_moonlight: WingCharmMoonlight,
};

export {
  HatSchoolCap,
  HatSakuraCrown,
  HatEikenPass,
  HatGuardianCrown,
  ScarfRed,
  ScarfKasuri,
  ScarfSakura,
  ScarfKinran,
  WingCharmBell,
  WingCharmSakura,
  WingCharmTorii,
  WingCharmMoonlight,
};
