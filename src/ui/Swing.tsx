/**
 * A player's attack, one question at a time.
 *
 * Written for somebody who has never played. The three things a first-timer
 * does not know are which weapon they can use, what to roll, and what to add
 * — so the app names all three and asks for one thing per screen. "Roll a d20
 * and add 5" is a sentence anyone can follow; "make an attack roll" is not.
 *
 * It asks for the roll rather than making it. The dice on the table are the
 * point, and a beginner who watches the app roll for them learns nothing
 * about what they are doing.
 *
 * Nothing is applied here. The claim goes to the DM, who says whether it
 * lands — which is both how a table works and the only thing that keeps a
 * creature's armour class from being learned by trial.
 */

import { useState } from "react";
import { formatModifier } from "../domain/abilities.js";
import type { ResolvedAttack } from "../domain/attack.js";
import type { Combatant } from "../domain/combat.js";
import { describeReasons, describeStance, type Stance, type StanceReason } from "../domain/stance.js";

export type Step = "weapon" | "target" | "hit" | "damage" | "sent";

export function Swing({
  attacks, targets, stanceAt, onSend, onCancel,
}: {
  attacks: readonly ResolvedAttack[];
  targets: readonly Combatant[];
  /** How the dice fall against this target, and why. */
  stanceAt: (
    target: Combatant,
    attack: ResolvedAttack,
  ) => { stance: Stance; reasons: readonly StanceReason[] };
  onSend: (a: { attack: ResolvedAttack; target: Combatant; toHit: number; damage: number }) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>(attacks.length === 1 ? "target" : "weapon");
  const [attack, setAttack] = useState<ResolvedAttack | null>(attacks[0] ?? null);
  const [target, setTarget] = useState<Combatant | null>(null);
  const [toHit, setToHit] = useState("");
  const [damage, setDamage] = useState("");

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : null;
  };

  if (attacks.length === 0) {
    return (
      <div className="swing-step">
        <p className="faint" style={{ margin: 0 }}>
          Nothing to attack with. Equip a weapon under Gear.
        </p>
        <button onClick={onCancel}>Back</button>
      </div>
    );
  }

  return (
    <div className="swing-step">
      {step === "weapon" && (
        <>
          <span className="label">What are you attacking with?</span>
          {attacks.map((a) => (
            <button
              className="tgt-row"
              key={a.name}
              onClick={() => {
                setAttack(a);
                setStep("target");
              }}
            >
              {a.name}
              <span className="faint"> · {formatModifier(a.toHit)} to hit · {a.damageFormula}</span>
            </button>
          ))}
          <button onClick={onCancel}>Cancel</button>
        </>
      )}

      {step === "target" && attack && (
        <>
          <span className="label">Who are you swinging at?</span>
          {targets.map((c) => (
            <button
              className="tgt-row"
              key={c.id}
              onClick={() => {
                setTarget(c);
                setStep("hit");
              }}
            >
              {c.name}
            </button>
          ))}
          {targets.length === 0 && (
            <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
              Nothing you can see.
            </p>
          )}
          <button onClick={() => (attacks.length > 1 ? setStep("weapon") : onCancel())}>
            Back
          </button>
        </>
      )}

      {step === "hit" && attack && target && (
        <>
          <span className="label">Did it hit {target.name}?</span>
          {/* The whole instruction in one sentence, including the arithmetic
              and — the part a beginner cannot work out — how many dice. */}
          {(() => {
            const { stance, reasons } = stanceAt(target, attack);
            const why = describeReasons(stance, reasons);
            return (
              <>
                <p className="swing-ask">
                  {describeStance(stance)} and add <b>{formatModifier(attack.toHit)}</b>.
                </p>
                {why && <p className={`stance ${stance}`}>{why}</p>}
              </>
            );
          })()}
          <div className="row">
            <input
              type="number"
              aria-label="Attack roll total"
              placeholder="total"
              value={toHit}
              autoFocus
              onChange={(e) => setToHit(e.target.value)}
            />
            <button disabled={num(toHit) === null} onClick={() => setStep("damage")}>
              Next
            </button>
          </div>
          <p className="faint" style={{ fontSize: ".8rem", margin: 0 }}>
            Add the {formatModifier(attack.toHit)} yourself and type the total —
            the number you would say out loud.
          </p>
          <button onClick={() => setStep("target")}>Back</button>
        </>
      )}

      {step === "damage" && attack && target && (
        <>
          <span className="label">How much damage?</span>
          <p className="swing-ask">
            Roll <b>{attack.damageFormula}</b>
            {attack.damageType ? ` ${attack.damageType}` : ""}.
          </p>
          <div className="row">
            <input
              type="number"
              aria-label="Damage roll total"
              placeholder="total"
              value={damage}
              autoFocus
              onChange={(e) => setDamage(e.target.value)}
            />
            <button
              disabled={num(damage) === null}
              onClick={() => {
                const hit = num(toHit);
                const dmg = num(damage);
                if (hit === null || dmg === null) return;
                onSend({ attack, target, toHit: hit, damage: dmg });
                setStep("sent");
              }}
            >
              Send to the DM
            </button>
          </div>
          <p className="faint" style={{ fontSize: ".8rem", margin: 0 }}>
            Roll it even if you think you missed — the DM decides, and it saves
            asking you again.
          </p>
          <button onClick={() => setStep("hit")}>Back</button>
        </>
      )}

      {step === "sent" && (
        <>
          <span className="label">Sent</span>
          <p className="faint" style={{ margin: "4px 0 8px", fontSize: ".86rem" }}>
            The DM has your roll. Nothing changes until they say it lands.
          </p>
          <button onClick={onCancel}>Done</button>
        </>
      )}
    </div>
  );
}
