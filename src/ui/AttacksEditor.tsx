/**
 * Attack entry.
 *
 * Asks for the ability and whether you are proficient rather than for the
 * final bonus, because the final bonus is derived — entering "+7" would
 * silently stay +7 after a level-up that should have made it +8.
 */

import type { Attack, AttackAbility } from "../domain/attack.js";
import { damageFormula } from "../domain/attack.js";
import type { DieSize } from "../domain/resources.js";

const DICE: DieSize[] = [4, 6, 8, 10, 12];
const ABILITY_LABEL: Record<AttackAbility, string> = {
  str: "Strength",
  dex: "Dexterity",
  finesse: "Finesse",
};

export const BLANK_ATTACK: Attack = {
  name: "",
  ability: "str",
  proficient: true,
  bonus: 0,
  damage: { count: 1, die: 6, addAbility: true },
  damageType: "slashing",
};

export function AttacksEditor({
  attacks, onChange,
}: {
  attacks: Attack[];
  onChange: (next: Attack[]) => void;
}) {
  const patch = (i: number, part: Partial<Attack>) =>
    onChange(attacks.map((a, n) => (n === i ? { ...a, ...part } : a)));

  return (
    <div className="field">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="label">Attacks</span>
        <button type="button" onClick={() => onChange([...attacks, { ...BLANK_ATTACK }])}>
          Add attack
        </button>
      </div>

      {attacks.length === 0 && (
        <p className="faint" style={{ fontSize: ".85rem", margin: 0 }}>
          None yet. The bonus is worked out from the ability and your proficiency.
        </p>
      )}

      {attacks.map((a, i) => (
        <div className="atk-edit" key={i}>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={a.name}
              placeholder="Longbow"
              aria-label={`Attack ${i + 1} name`}
              style={{ flex: "2 1 140px", width: "auto" }}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <select
              value={a.ability}
              aria-label={`Attack ${i + 1} ability`}
              style={{ flex: "1 1 110px", width: "auto" }}
              onChange={(e) => patch(i, { ability: e.target.value as AttackAbility })}
            >
              {(Object.keys(ABILITY_LABEL) as AttackAbility[]).map((k) => (
                <option key={k} value={k}>{ABILITY_LABEL[k]}</option>
              ))}
            </select>
            <button type="button" aria-label={`Remove attack ${i + 1}`}
              onClick={() => onChange(attacks.filter((_, n) => n !== i))}>
              ✕
            </button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input
              type="number" min={1} max={20} value={a.damage.count}
              aria-label={`Attack ${i + 1} dice count`}
              style={{ flex: "0 0 62px", width: "auto" }}
              onChange={(e) =>
                patch(i, { damage: { ...a.damage, count: Math.max(1, +e.target.value || 1) } })
              }
            />
            <select
              value={a.damage.die}
              aria-label={`Attack ${i + 1} die`}
              style={{ flex: "0 0 84px", width: "auto" }}
              onChange={(e) =>
                patch(i, { damage: { ...a.damage, die: +e.target.value as DieSize } })
              }
            >
              {DICE.map((d) => <option key={d} value={d}>d{d}</option>)}
            </select>
            <input
              value={a.damageType}
              placeholder="piercing"
              aria-label={`Attack ${i + 1} damage type`}
              style={{ flex: "1 1 100px", width: "auto" }}
              onChange={(e) => patch(i, { damageType: e.target.value })}
            />
            <input
              type="number" value={a.bonus}
              aria-label={`Attack ${i + 1} magic bonus`}
              style={{ flex: "0 0 66px", width: "auto" }}
              onChange={(e) => patch(i, { bonus: +e.target.value || 0 })}
            />
          </div>

          <div className="chips" style={{ marginTop: 8 }}>
            <button type="button" className={`chip${a.proficient ? " on" : ""}`}
              aria-pressed={a.proficient}
              onClick={() => patch(i, { proficient: !a.proficient })}>
              Proficient
            </button>
            <button type="button" className={`chip${a.damage.addAbility ? " on" : ""}`}
              aria-pressed={a.damage.addAbility}
              onClick={() => patch(i, { damage: { ...a.damage, addAbility: !a.damage.addAbility } })}>
              Ability mod to damage
            </button>
            <span className="atk-preview num">
              {damageFormula(a.damage.count, a.damage.die, a.bonus)}
              {a.damage.addAbility ? " + ability" : ""} {a.damageType}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
