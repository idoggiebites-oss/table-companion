/**
 * Rest previews.
 *
 * A rest is preview, commit, receipt — the DM sees exactly what will change
 * before committing it, and the player sees what did. Both come from this one
 * function, computed against the same rules the projector applies, so the
 * preview can never disagree with the outcome.
 */

import type { CharacterId, EffectiveBuild } from "./build.js";
import type { CampaignState, CharacterState } from "./project.js";
import { restoredAmount, restoredBy } from "./resources.js";

export type RestKind = "short" | "long";

export interface ResourceChange {
  readonly id: string;
  readonly name: string;
  readonly max: number;
  /** Spent counts, so 3 → 0 reads as "three uses came back". */
  readonly spentBefore: number;
  readonly spentAfter: number;
}

export interface RestPreview {
  readonly who: CharacterId;
  readonly name: string;
  readonly kind: RestKind;
  readonly hp: { readonly from: number; readonly to: number };
  readonly tempHpLost: number;
  readonly exhaustion: { readonly from: number; readonly to: number } | null;
  readonly deathSavesCleared: boolean;
  readonly resources: readonly ResourceChange[];
  /** True when the rest would change nothing at all. */
  readonly noop: boolean;
}

function previewFor(
  build: EffectiveBuild,
  s: CharacterState,
  kind: RestKind,
): RestPreview {
  const resources: ResourceChange[] = [];

  for (const r of build.resources) {
    if (!restoredBy(kind, r.recharge)) continue;
    const spentBefore = s.spent[r.id] ?? 0;
    if (spentBefore === 0) continue;
    const spentAfter = Math.max(0, spentBefore - restoredAmount(r.max, r.recharge));
    if (spentAfter === spentBefore) continue;
    resources.push({ id: r.id, name: r.name, max: r.max, spentBefore, spentAfter });
  }

  const hpTo = kind === "long" ? build.maxHp : s.currentHp;
  const tempHpLost = kind === "long" ? s.tempHp : 0;
  const exhaustion =
    kind === "long" && s.exhaustion > 0
      ? { from: s.exhaustion, to: s.exhaustion - 1 }
      : null;
  const deathSavesCleared =
    kind === "long" && (s.deathSaves.successes > 0 || s.deathSaves.failures > 0);

  return {
    who: build.id,
    name: build.name,
    kind,
    hp: { from: s.currentHp, to: hpTo },
    tempHpLost,
    exhaustion,
    deathSavesCleared,
    resources,
    noop:
      hpTo === s.currentHp &&
      tempHpLost === 0 &&
      exhaustion === null &&
      !deathSavesCleared &&
      resources.length === 0,
  };
}

/** What a rest would do to each named character, in roster order. */
export function previewRest(
  state: CampaignState,
  kind: RestKind,
  who: readonly CharacterId[],
): readonly RestPreview[] {
  const out: RestPreview[] = [];
  for (const id of who) {
    const build = state.builds[id];
    const s = state.characters[id];
    if (!build || !s) continue;
    out.push(previewFor(build, s, kind));
  }
  return out;
}

/**
 * Hit dice are the rule people get wrong: a long rest returns HALF your total,
 * rounded down, minimum one — not all of them. Exposed on its own because the
 * rest screen calls it out explicitly.
 */
export function hitDiceRegainedOnLongRest(totalLevel: number): number {
  return Math.max(1, Math.floor(totalLevel / 2));
}
