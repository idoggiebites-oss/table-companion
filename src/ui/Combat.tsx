/**
 * Initiative.
 *
 * Active state is carried by luminance, never a hue: the row that is up sits
 * on a raised ground with a white edge and everything else is dimmed. Red
 * already means damage here, so a coloured "current turn" marker could be
 * confused with a creature that is nearly dead two rows down.
 *
 * What a player sees is decided per creature by the DM's disclosure setting,
 * and vague health is a word rather than a meter — the game already supplies
 * the vocabulary, and a bar would imitate a precision the player is not
 * meant to have.
 */

import { ConditionStrip } from "./Conditions.js";
import { SceneSet } from "./SceneSet.js";
import { Num } from "./Num.js";
import { Field } from "./Field.js";
import { CreaturePips } from "./CreaturePips.js";
import { useWide } from "./useWide.js";
import { describeRoom, isOpenGround, type Room } from "../domain/terrain.js";
import type { KnownSpell } from "../domain/spells.js";
import { useEffect, useMemo, useState } from "react";
import { mergeStatblocks, type Statblock, type StatblockAction } from "../domain/statblock.js";
import { saveFromAction } from "../domain/savefrom.js";
import {
  lairAction, legendaryBudget, legendaryOptions,
  type LairAction, type LegendaryOption,
} from "../domain/legendary.js";
import { Lair, Legendary } from "./Legendary.js";
import { actionNumbers, StatblockView } from "./StatblockView.js";
import { combatantsFor, creaturesFrom, type StagedCreature } from "../domain/stage.js";
import { loadMonsters } from "../store/srd.js";
import {
  activeCombatant, awaitingRolls, controls, DISCLOSURE, hasReaction, mayEndTurn,
  baseName, rollGroups,
  turnsUntil, visibleTo,
  type Combat, type Combatant, type Disclosure, type Seat,
} from "../domain/combat.js";

type Surprise = "none" | "monsters" | "players";
/**
 * Named sides, not pronouns. "We are" read from the DM's screen is wrong on
 * its face — the DM is not in the party — and "they" means whichever side you
 * happened to be thinking of.
 */
const SURPRISE_LABEL: Record<Surprise, string> = {
  none: "Nobody",
  monsters: "The encounter",
  players: "The party",
};
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import {
  describeClaim, onSave, sortClaims, verdictFor,
} from "../domain/attackflow.js";
import { AreaDamage } from "./AreaDamage.js";
import { healthStep, VAGUE_LABEL } from "./HpBar.js";
import { PlayerTurn } from "./PlayerTurn.js";
import { Readiness } from "./Readiness.js";
import { useAttacks } from "./useAttacks.js";

const nextDisclosure = (d: Disclosure): Disclosure =>
  DISCLOSURE[(DISCLOSURE.indexOf(d) + 1) % DISCLOSURE.length]!;

/**
 * Setting a fight up.
 *
 * Who is IN it is a decision, not an assumption. Parties split — half the
 * table is in the warehouse and half is on the roof — and a combat that
 * silently drafts everybody makes the DM either explain it away or track two
 * initiative orders in their head.
 *
 * Surprise is chosen per SIDE rather than per creature, because that is how
 * an ambush actually works: one group walked into it.
 */
function StartCombat({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const characters = Object.values(state.builds);
  const encounters = Object.values(state.encounters);
  /**
   * Who is OUT, not who is in. The party arrives asynchronously — a DM opens
   * the app before anybody has joined — and a snapshot of "everyone" taken at
   * first render silently excludes every character that syncs in afterwards.
   * Tracking exclusions makes the default correct no matter when it is read.
   */
  const [sittingOut, setSittingOut] = useState<string[]>([]);
  const inFight = characters.filter((b) => !sittingOut.includes(b.id)).map((b) => b.id);
  const [surprise, setSurprise] = useState<Surprise>("none");
  const [creatures, setCreatures] = useState<readonly StagedCreature[]>([]);
  /**
   * Loaded whenever prep exists, not when a panel is opened. Dropping an
   * encounter in without the statblocks is how six goblins once arrived with
   * one hit point each.
   */
  const [book, setBook] = useState<Statblock[] | null>(null);
  useEffect(() => {
    if (encounters.length === 0 || book) return;
    loadMonsters().then(setBook, () => setBook([]));
  }, [encounters.length, book]);

  const toggle = (id: string) =>
    setSittingOut((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  function dropIn(encounterId: string) {
    const enc = state.encounters[encounterId];
    if (!enc) return;
    setCreatures((c) => [
      ...c,
      ...creaturesFrom(enc, mergeStatblocks(book ?? [], state.homebrew)),
    ]);
  }

  function stage() {
    const combatants = combatantsFor({
      characters: characters.filter((b) => !sittingOut.includes(b.id)),
      creatures,
      surprise,
    });
    if (combatants.length > 0) append({ type: "combatStaged", combatants });
  }

  return (
    <div className="card-body">
      <span className="label cr-sub">Who is in this fight</span>
      <div className="chips">
        {characters.map((b) => (
          <button
            key={b.id}
            className={`chip${inFight.includes(b.id) ? " on" : ""}`}
            aria-pressed={inFight.includes(b.id)}
            onClick={() => toggle(b.id)}
          >
            {b.name}
          </button>
        ))}
        {characters.length === 0 && (
          <span className="faint aside">Nobody yet.</span>
        )}
      </div>

      <span className="label cr-sub mt-3">Who is surprised</span>
      <div className="seg">
        {(["none", "monsters", "players"] as const).map((k) => (
          <button
            key={k}
            aria-pressed={surprise === k}
            className={surprise === k ? "on" : ""}
            onClick={() => setSurprise(k)}
          >
            {SURPRISE_LABEL[k]}
          </button>
        ))}
      </div>

      <span className="label cr-sub mt-3">
        Against {creatures.length > 0 ? `· ${creatures.length}` : ""}
      </span>
      {/*
        * Three boxes in a row and no way to tell them apart once they are
        * filled: a name, a number and another number, with the placeholders
        * gone the moment anything was typed. The header names them once, at
        * the top, rather than repeating a label on every row.
        */}
      {creatures.length > 0 && (
        <div className="init-row init-head-row">
          <span className="label">Name</span>
          <span className="label">HP</span>
          <span className="label">AC</span>
          <span />
        </div>
      )}
      {creatures.map((c, i) => (
        <div className="init-row" key={i}>
          <input
            aria-label={`Creature ${i + 1} name`}
            value={c.name}
            placeholder="Goblin"
            onChange={(e) =>
              setCreatures(creatures.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <Num
            min={1}
            aria-label={`Creature ${i + 1} hp`}
            value={c.maxHp}
            onChange={(n) =>
              setCreatures(creatures.map((x, at) => (at === i ? { ...x, maxHp: n } : x)))
            }
          />
          <input
            type="number"
            aria-label={`Creature ${i + 1} armour class`}
            placeholder="AC"
            value={c.ac ?? ""}
            style={{ width: 62 }}
            onChange={(e) =>
              setCreatures(
                creatures.map((x, n) => {
                  if (n !== i) return x;
                  const ac = Number(e.target.value);
                  const { ac: _drop, ...rest } = x;
                  return Number.isFinite(ac) && ac > 0 ? { ...rest, ac } : rest;
                }),
              )
            }
          />
          <button
            aria-label={`Remove creature ${i + 1}`}
            onClick={() => setCreatures(creatures.filter((_, n) => n !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="row mt-3">
        <button onClick={() => setCreatures([...creatures, { name: "", maxHp: 7 }])}>
          Add creature
        </button>
        {encounters.length > 0 && (
          <select
            aria-label="Drop in an encounter"
            value=""
            style={{ width: "auto" }}
            onChange={(e) => {
              if (e.target.value) dropIn(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">from prep…</option>
            {encounters.map((enc) => (
              <option key={enc.id} value={enc.id}>{enc.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={stage}
          disabled={inFight.length === 0 && creatures.length === 0}
        >
          Roll for initiative
        </button>
      </div>
    </div>
  );
}

/**
 * The moment between "roll for initiative" and the first turn.
 *
 * Everyone rolls on their own device, so the DM stops collecting numbers
 * verbally and the screen answers "who are we waiting on" without anyone
 * having to ask.
 */
/**
 * Where the fight is, for anyone who is not the DM.
 *
 * It sat inside the turn panel, which meant a player learned the room was
 * pitch dark at the moment it was already too late to say anything about it —
 * on their own turn, and never before. The room is a fact about the table,
 * not about whose go it is.
 */
function RoomLine({ scene }: { scene: Room }) {
  if (isOpenGround(scene)) return null;
  return (
    <div className="card-body" style={{ paddingBottom: 0 }}>
      <p className="room-is">
        <span className="label">The room</span>
        {describeRoom(scene)}
      </p>
    </div>
  );
}

/**
 * Something walks in on round three.
 *
 * Reinforcements are ordinary at a table and were impossible here: the only
 * way to add a creature was to cancel the fight and stage it again, throwing
 * away every hit point already spent. Three fields, because that is what the
 * order needs — a name, how much it can take, and where it goes.
 */
function Arrival({
  onAdd, onCancel,
}: {
  onAdd: (c: Combatant) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [hp, setHp] = useState(10);
  const [init, setInit] = useState("");

  const roll = Number(init);
  const ready = name.trim() !== "" && Number.isFinite(roll) && init.trim() !== "";

  return (
    <div className="card-body arrive">
      <span className="label">What arrives</span>
      {/* Named, because a placeholder is gone the moment you type: "Ghoul,
          10, d20" is legible and "Ghoul, 10, 16" is three numbers. */}
      <div className="row mt-2">
        <Field label="Name" htmlFor="arr-name">
          <input
            id="arr-name"
            value={name}
            aria-label="Arrival name"
            placeholder="Ghoul"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Hit points" htmlFor="arr-hp" width={84}>
          <Num min={1} value={hp}
            id="arr-hp"
            aria-label="Arrival hit points"
            onChange={setHp}
          />
        </Field>
        <Field label="Initiative" htmlFor="arr-init" width={84}>
          <input
            id="arr-init"
            type="number" value={init}
            aria-label="Arrival initiative"
            placeholder="d20"
            onChange={(e) => setInit(e.target.value)}
          />
        </Field>
      </div>
      <div className="row mt-2">
        <button
          disabled={!ready}
          onClick={() =>
            onAdd({
              id: `cr-${Date.now().toString(36)}`,
              name: name.trim(),
              initiative: roll,
              source: { kind: "creature", maxHp: hp },
              controller: { kind: "dm" },
              disclosure: "vague",
              surprised: false,
              speed: 30,
            })
          }
        >
          It joins the fight
        </button>
        <button onClick={onCancel}>Never mind</button>
      </div>
      <p className="faint note">
        It drops into the order at that initiative. Nobody's turn is skipped.
      </p>
    </div>
  );
}

function Rolling({
  combat, seat, append,
}: {
  combat: Combat;
  seat: Seat;
  append: (body: EventBody) => void;
}) {
  const waiting = awaitingRolls(combat);
  /** Groups the DM has pulled apart, by key. Device-local: it is a choice
      about how to roll, not a fact about the fight. */
  const [split, setSplit] = useState<readonly string[]>([]);
  /**
   * The DM may roll for ANYONE, not only their own creatures — the same rule
   * that lets them always advance a turn. Somebody is in the toilet, somebody
   * has no device, and a fight that cannot start because of it is worse than
   * a DM rolling on their behalf. Players only ever see their own.
   */
  const mine = combat.order.filter(
    (c) => c.initiative === null && (seat.kind === "dm" || controls(seat, c.controller)),
  );

  return (
    <div className="card-body">
      <div className="init-head">
        <span className="label">Roll for initiative</span>
        <span className="faint num">
          {combat.order.length - waiting.length} of {combat.order.length}
        </span>
      </div>

      {/*
        * One roll per group, which is how a table already does it.
        *
        * The app asked for a number each: one player and six goblins is seven
        * prompts, and the DM fills six of them with the same digits. The DMG
        * rolls once per group of identical monsters; this just stops making
        * that harder than doing it by hand.
        *
        * Splitting is one press, because sometimes the goblin on the roof is
        * genuinely not with the others.
        */}
      {/*
        * flatMap, and it matters.
        *
        * This returned EITHER an element or a nested array, and React reads a
        * nested array as an implicit fragment keyed by position. So the
        * moment one row was submitted and the shape of the list changed, the
        * children stopped lining up, every row remounted, and the numbers
        * typed into the others — held in each row's own state until Set —
        * were thrown away. A DM filling in six initiatives lost five of them
        * on the first press.
        *
        * One flat list of keyed elements reconciles by key, which is what
        * keeps a half-typed row alive while its neighbour is settled.
        */}
      {rollGroups(mine).flatMap((g) =>
        g.members.length > 1 && !split.includes(g.key)
          ? [
              <InitiativeRow
                key={g.key}
                combatant={g.members[0]!}
                label={`${g.name} ×${g.members.length}`}
                append={append}
                onSet={(value) => {
                  for (const m of g.members) {
                    append({ type: "initiativeRolled", combatantId: m.id, value });
                  }
                }}
                onSplit={() => setSplit([...split, g.key])}
              />,
            ]
          : g.members.map((c) => (
              <InitiativeRow key={c.id} combatant={c} append={append} />
            )),
      )}

      {mine.length === 0 && (
        <p className="faint note">
          {waiting.length === 0 ? "Everyone has rolled." : "Waiting on the others."}
        </p>
      )}

      <div className="init-waiting">
        {combat.order
          .filter((c) => visibleTo(seat, c))
          .map((c) => (
            <span className={`chip${c.initiative === null ? "" : " on"}`} key={c.id}>
              {c.name}
              {c.initiative !== null && <> <b className="num">{c.initiative}</b></>}
            </span>
          ))}
      </div>

      {seat.kind === "dm" && (
        <div className="row mt-3">
          <button
            onClick={() => append({ type: "combatBegan" })}
            disabled={combat.order.every((c) => c.initiative === null)}
          >
            {waiting.length === 0 ? "Begin" : `Begin without ${waiting.length}`}
          </button>
          <button onClick={() => append({ type: "combatEnded" })}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** One roll. The app names the modifier and a person rolls the die. */
function InitiativeRow({
  combatant, append, label, onSet, onSplit,
}: {
  combatant: Combatant;
  append: (body: EventBody) => void;
  /** "Goblin ×6" when this row speaks for a group. */
  label?: string | undefined;
  /** Given, the row sets the whole group rather than this one combatant. */
  onSet?: ((value: number) => void) | undefined;
  onSplit?: (() => void) | undefined;
}) {
  const [value, setValue] = useState("");
  const who = label ?? combatant.name;
  const send = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || value.trim() === "") return;
    if (onSet) onSet(n);
    else append({ type: "initiativeRolled", combatantId: combatant.id, value: n });
    setValue("");
  };
  return (
    <div className="init-row">
      <span className="n">{who}</span>
      <input
        type="number"
        aria-label={`${who} initiative`}
        value={value}
        placeholder="d20"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
      />
      <button aria-label={`Set ${who} initiative`} onClick={send}>Set</button>
      {onSplit && (
        // The group's name, not the first member's: "roll each Goblin 1
        // separately" is not a thing anybody means.
        <button className="init-split" aria-label={`Roll each ${baseName(combatant.name)} separately`}
          onClick={onSplit}>
          Split
        </button>
      )}
    </div>
  );
}

export function Combat({
  state, seat, append, onCast, takeReaction, onReactionOpened, buzz, log, revert, reverted,
}: {
  state: CampaignState;
  seat: Seat;
  /*
   * For stepping a turn back. Undo already does this and does it correctly —
   * it appends a marker rather than deleting, so nobody's history is quietly
   * rewritten — but it lives in the Log tab, and a DM who taps Next by
   * mistake mid-fight is on the one screen they cannot leave.
   *
   * So this is not a new mechanism. It is the existing one, put where the
   * mistake happens.
   */
  log?: readonly { readonly id: string; readonly type: string }[] | undefined;
  revert?: ((target: string) => void) | undefined;
  reverted?: ReadonlySet<string> | undefined;
  append: (body: EventBody) => void;
  /** Sends a player to their spells, where casting lives. */
  /** An aimed spell, on its way to the DM's queue like any other claim. */
  onCast?: (c: {
    spell: KnownSpell;
    atLevel: number;
    /** Everyone the spell caught — a blast is one roll and several saves. */
    targets: readonly Combatant[];
    toHit: number | null;
    damage: number;
    damageType: string;
  }) => void;
  /** Said yes to a reaction from another screen — open the swing on arrival. */
  takeReaction?: boolean;
  onReactionOpened?: () => void;
  /** The "tell me when it's my turn" control, owned by the app. */
  buzz?: React.ReactNode;
}) {
  const [hit, setHit] = useState(5);
  const [area, setArea] = useState(false);
  /** Filled in when the area tool was opened off a creature's own action. */
  const [areaFrom, setAreaFrom] = useState<
    | {
        name: string; dc: number; ability: string;
        amount: number; damageType: string; half: boolean;
      }
    | null
  >(null);
  /** Who a player has chosen to swing at, and what they rolled for damage. */
  const [target, setTarget] = useState<Combatant | null>(null);
  const [dealt, setDealt] = useState(0);
  /**
   * The DM's swing, in two flavours. On a creature's own turn the attacker is
   * whoever is up. Off-turn it is an opportunity attack, and WHICH creature
   * is reacting has to be asked — attributing it to whoever happens to be
   * active would credit the player whose turn provoked it.
   */
  const [offering, setOffering] = useState(false);
  /** Reinforcements: the form for something walking in mid-fight. */
  const [something, setSomething] = useState(false);
  /** Which row has its own number open, and what it says. */
  const [hurting, setHurting] = useState<string | null>(null);
  /** Which row is being renamed, and what to. */
  const [naming, setNaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState(5);
  const [offerTo, setOfferTo] = useState<readonly string[]>([]);
  const [offerWhy, setOfferWhy] = useState("");
  const [dmPicking, setDmPicking] = useState<null | "target" | "reactor">(null);
  /** The action the DM tapped off a statblock, carried into the swing. */
  const [using, setUsing] = useState<StatblockAction | null>(null);
  /*
   * Open where there is room for it.
   *
   * A propped tablet or a laptop has a column to spare and the statblock
   * should simply be there. A phone does not: open by default, it pushed
   * Next turn below the fold, which taxes every turn to make one of them
   * easier. Closed, the header still says whose statblock is waiting.
   */
  const wide = useWide();
  const [sbOpen, setSbOpen] = useState(wide);
  const [reactor, setReactor] = useState<Combatant | null>(null);
  /*
   * The active creature's full statblock, looked up rather than copied.
   *
   * Above the early return, because hooks are: this block first sat beside
   * the code that uses it, after `if (!combat)`, and every fight that ended
   * crashed the tab with "rendered more hooks than during the previous
   * render". The boundary caught it, which is why it was a report and not a
   * white screen — but the fix is placement, not catching.
   *
   * An id rather than a copy means a corrected monster corrects a running
   * fight, and the log stays small.
   */
  const activeSrc = (() => {
    const c = state.combat;
    if (!c || c.phase !== "active") return undefined;
    return (reactor ?? c.order[c.turn])?.source;
  })();
  const needId =
    seat.kind === "dm" && activeSrc?.kind === "creature" ? activeSrc.statblockId : undefined;
  /* The book is also needed for anybody ELSE'S legendary actions, which are
     taken between turns — so load it whenever a staged creature came from
     the catalogue at all. */
  const anyCreature =
    seat.kind === "dm" &&
    (state.combat?.order ?? []).some(
      (c) => c.source.kind === "creature" && Boolean(c.source.statblockId),
    );
  /*
   * Loaded on demand and only for the DM: a player never sees this, and the
   * service worker has the file from the moment the fight was staged.
   */
  const [book, setBook] = useState<Statblock[] | null>(null);
  useEffect(() => {
    if ((!needId && !anyCreature) || book) return;
    loadMonsters().then(setBook, () => setBook([]));
  }, [needId, anyCreature, book]);
  /*
   * Every creature in this fight that has legendary actions or a lair, by
   * combatant id. Not just the active one: a legendary action is taken
   * between OTHER creatures' turns, so the dragon's options have to be on
   * screen while the rogue is acting — that is the whole point of them.
   */
  const bigOnes = useMemo(() => {
    if (seat.kind !== "dm" || !state.combat) return [];
    const cat = mergeStatblocks(book ?? [], state.homebrew);
    const out: {
      id: string; name: string; budget: number;
      options: readonly LegendaryOption[]; lair: LairAction | null;
    }[] = [];
    for (const c of state.combat.order) {
      const src = c.source;
      if (src.kind !== "creature" || !src.statblockId) continue;
      const sb = cat.find((m) => m.id === src.statblockId);
      if (!sb) continue;
      const options = legendaryOptions(sb);
      const lair = lairAction(sb);
      if (options.length === 0 && !lair) continue;
      out.push({ id: c.id, name: c.name, budget: legendaryBudget(sb), options, lair });
    }
    return out;
  }, [seat.kind, state.combat, book, state.homebrew]);

  const activeBlock = useMemo(
    () =>
      needId
        ? (mergeStatblocks(book ?? [], state.homebrew).find((m) => m.id === needId) ?? null)
        : null,
    [needId, book, state.homebrew],
  );
  /** The last turn advance that still counts — what "back" would take back. */
  const lastAdvance = (() => {
    if (!log || !revert) return null;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]!;
      if (e.type === "turnAdvanced" && !reverted?.has(e.id)) return e.id;
    }
    return null;
  })();
  const combat = state.combat;

  // What the seated player is holding, so the walkthrough can name the weapon
  // rather than asking for "your attack bonus".
  const seated = seat.kind === "player" ? state.builds[seat.characterId] : undefined;
  const seatedState = seated ? state.characters[seated.id] : undefined;
  const { attacks: playerAttacks } = useAttacks(seated, seatedState, state.homebrewItems);

  if (!combat) {
    return (
      <section className="card">
        <div className="card-hd"><span className="label">Combat</span></div>
        {seat.kind === "dm" ? (
          <StartCombat state={state} append={append} />
        ) : seated && seatedState ? (
          <>
            <Readiness build={seated} state={seatedState} attacks={playerAttacks} />
            {buzz && <div className="card-body" style={{ paddingTop: 0 }}>{buzz}</div>}
          </>
        ) : (
          <div className="card-body"><p className="faint note">No fight yet.</p></div>
        )}
      </section>
    );
  }

  if (combat.phase === "rolling") {
    return (
      <section className="card">
        <div className="card-hd"><span className="label">Combat</span></div>
        {/* Rolling initiative is when a DM has the time to say what the room
            is like, and where opening a prepared place lands them. Hiding the
            control until Begin meant the one window for it was shut. */}
        {seat.kind === "dm" ? (
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <SceneSet scene={combat.scene} append={append} />
          </div>
        ) : (
          <RoomLine scene={combat.scene} />
        )}
        <Rolling combat={combat} seat={seat} append={append} />
      </section>
    );
  }

  const active = activeCombatant(combat);
  /*
   * The active creature's full statblock, looked up rather than copied. The
   * catalogue is already here — it is what staged the fight — so carrying an
   * id costs nothing and means a corrected monster corrects a running fight.
   *
   * Only for whoever is actually up, and only when it is a creature: a
   * player's turn belongs to the player, and their sheet is on their phone.
   */
  /** Who follows, so a player can see their own turn coming. */
  const upNext = combat.order.length > 1
    ? combat.order[(combat.turn + 1) % combat.order.length]
    : null;
  const canEnd = mayEndTurn(seat, combat);
  const mine = seat.kind === "player" ? turnsUntil(combat, seat.characterId) : null;
  const visible = combat.order.filter((c) => visibleTo(seat, c));
  /* How many advances reach the top of the next round — see the End round
     control. One of them is the turn showing, so the number it SKIPS is one
     fewer than the number of presses it stands in for. */
  const toSkip = combat.order.length - combat.turn;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">
          Round <span className="num">{combat.round}</span>
          <span className="faint">
            {" · "}turn <span className="num">{combat.turn + 1}</span> of{" "}
            <span className="num">{combat.order.length}</span>
          </span>
        </span>
        {mine !== null && (
          <span
            className={`label turns-away${mine === 0 ? " now" : ""}`}
          >
            {mine === 0 ? "Your turn" : `${mine} turn${mine === 1 ? "" : "s"} away`}
          </span>
        )}
        {/*
          * End the round from here.
          *
          * The honest reading of the control: it advances past everyone left
          * to the top of the next round, which means those creatures do not
          * act. A DM who has already resolved the rest of the round out loud
          * wants that; a DM who mis-taps does not, so it SAYS how many turns
          * it is about to skip rather than making that a thing you discover.
          *
          * Absent on the last turn of a round, where Next turn already does
          * this and a second control for it would be a door into a room you
          * are standing in.
          */}
        {seat.kind === "dm" && toSkip > 1 && (
          <button
            className="end-round"
            aria-label={`End round ${combat.round}, skipping ${toSkip - 1} turns`}
            onClick={() => {
              for (let i = 0; i < toSkip; i += 1) {
                append({
                  type: "turnAdvanced",
                  from: (combat.turn + i) % combat.order.length,
                });
              }
            }}
          >
            End round
            <small>skips {toSkip - 1}</small>
          </button>
        )}
      </div>

      {/*
        * Whose turn it is, in words.
        *
        * It was carried by a highlight on one row and nothing else — which
        * is legible when you are looking at the list and useless when you
        * have just looked up from the table. The next name is here too,
        * because "you are after the ghoul" is the question a player asks
        * more often than any other.
        */}
      <div className="up">
        <span className="up-now">
          <span className="k">Up now</span>
          <span className="n">{active?.name ?? "nobody"}</span>
        </span>
        {/*
          * Step the turn from where the turn is NAMED.
          *
          * Next turn stays the primary — it is the control a DM presses forty
          * times an evening and it remains the biggest thing on the screen.
          * This is the other half: going BACK was a button at the foot of the
          * card, a long way from the name that is wrong, and stepping forward
          * to check who is coming meant losing your place.
          *
          * Both are undo, not a rewind: the log keeps the advance and adds a
          * marker saying to skip it, which is the same thing "Back a turn"
          * has always done.
          */}
        {seat.kind === "dm" && (
          <span className="up-step">
            <button
              className="us"
              aria-label="Back a turn"
              disabled={!lastAdvance || !revert}
              onClick={() => lastAdvance && revert && revert(lastAdvance)}
            >
              {"\u2039"}
            </button>
            <button
              className="us"
              aria-label="Forward a turn"
              disabled={!canEnd}
              onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
            >
              {"\u203A"}
            </button>
          </span>
        )}
        {upNext && (
          <span className="up-next">
            <span className="k">Then</span>
            <span className="n">{upNext.name}</span>
          </span>
        )}
      </div>

      {seat.kind === "player" && <RoomLine scene={combat.scene} />}

      {seat.kind === "player" && state.characters[seat.characterId] && (
        <PlayerTurn
          combat={combat}
          seat={seat}
          character={state.characters[seat.characterId]!}
          append={append}
          attacks={playerAttacks}
          {...(seated ? { build: seated } : {})}
          {...(takeReaction ? { takeReaction } : {})}
          {...(onReactionOpened ? { onReactionOpened } : {})}
          {...(onCast ? { onCast } : {})}
          onSwing={(swing) => {
            // Claimed, not applied: the DM says whether it lands.
            append({
              type: "attackClaimed",
              claim: {
                id: `atk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                who: seated?.id ?? "",
                whoName: seated?.name ?? "",
                targetId: swing.target.id,
                targetName: swing.target.name,
                weapon: swing.attack.name,
                toHit: swing.toHit,
                damage: swing.damage,
                damageType: swing.attack.damageType,
                at: Date.now(),
              },
            });
          }}
        />
      )}

      {/* Rolling to hit happens on the sheet; this is where what landed goes.
          It stays until dismissed so a miss is a deliberate act rather than a
          panel that vanished. */}
      {target && (
        <div className="swing">
          <span className="label">
            Attacking {target.name}
            {/*
              * What was tapped, and what it takes to land it. The app names
              * the die and holds the modifier; the number comes from a person
              * throwing something. That is the whole of law one.
              */}
            {using && (
              <span className="faint"> · {using.name} {actionNumbers(using)}</span>
            )}
          </span>
          {/* What the attacker can do, with the numbers already read off its
              statblock — the DM's turn should not be slower than a player's. */}
          {(reactor ?? active)?.source.kind === "creature" &&
            ((reactor ?? active)?.source as { attacks?: readonly { name: string; toHit?: number; dice?: string; type?: string }[] })
              .attacks?.map((a) => (
                <button
                  className="swing-act"
                  key={a.name}
                  aria-label={`Use ${a.name}`}
                  onClick={() => setDealt(0)}
                >
                  {a.name}
                  <span className="faint">
                    {a.toHit !== undefined ? ` ${a.toHit >= 0 ? "+" : ""}${a.toHit} to hit` : ""}
                    {a.dice ? ` · ${a.dice}${a.type ? ` ${a.type}` : ""}` : ""}
                  </span>
                </button>
              ))}
          <Num min={0} value={dealt} aria-label="Damage dealt"
            style={{ width: 76 }}
            onChange={setDealt}
          />
          <button
            disabled={dealt <= 0}
            onClick={() => {
              // A hit does not care which side of the table it landed on, and
              // damage to a character is what owes a concentration save.
              append(
                target.source.kind === "character"
                  ? { type: "damageApplied", who: target.source.characterId, amount: dealt }
                  : { type: "creatureDamaged", combatantId: target.id, amount: dealt },
              );
              setTarget(null);
              setDealt(0);
              setUsing(null);
            }}
          >
            It hits
          </button>
          <button onClick={() => { setTarget(null); setUsing(null); }}>Missed</button>
        </div>
      )}

      {/* Claims wait here. A player rolled; nothing has happened yet. */}
      {seat.kind === "dm" && state.claims.length > 0 && (
        <div className="claims">
          {sortClaims(state.claims).map((c) => {
            const target = combat.order.find((x) => x.id === c.targetId);
            const ac = target?.source.kind === "creature" ? target.source.ac : undefined;
            const verdict = verdictFor(c.toHit, ac);
            return (
              <div className={`claim v-${verdict}`} key={c.id}>
                <span className="nm">
                  {c.whoName} → {c.targetName}
                  <span className="faint"> · {c.weapon}</span>
                </span>
                <span className="say">{describeClaim(c, ac)}</span>
                <span className="dmg num">{c.damage} {c.damageType}</span>
                <span className="acts">
                  <button
                    aria-label={`Apply ${c.damage} to ${c.targetName}`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: true })}
                  >
                    <span className="vg" aria-hidden="true">{"\u2694"}</span>
                    {c.save ? `Failed — ${c.damage}` : verdict === "misses" ? "Hits anyway" : "It hits"}
                  </button>
                  {/* The one place the app made the DM do arithmetic: a save
                      that halves it, announced after the dice are already on
                      the table. Half rounds down, and the button says the
                      number so nobody has to trust it. */}
                  {c.save?.half && (
                    <button
                      aria-label={`Apply ${onSave(c)} to ${c.targetName} on a save`}
                      onClick={() =>
                        append({
                          type: "attackResolved",
                          claimId: c.id,
                          applied: true,
                          amount: onSave(c),
                        })
                      }
                    >
                      Saved — {onSave(c)}
                    </button>
                  )}
                  <button
                    aria-label={`Reject ${c.whoName}'s attack`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: false })}
                  >
                    <span className="vg" aria-hidden="true">{"\u26E8"}</span>
                    {c.save ? "Saved — none" : "Missed"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* The one thing the app cannot see and will not guess. */}
      {seat.kind === "dm" && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <SceneSet scene={combat.scene} append={append} />
        </div>
      )}

      {seat.kind === "dm" && offering && (
        <div className="card-body offer">
          <span className="label">Whose reaction?</span>
          <div className="tgt">
            {combat.order
              .filter((c) => c.source.kind === "character")
              .map((c) => (
                <button
                  className={`offer-row${offerTo.includes(c.id) ? " on" : ""}`}
                  key={c.id}
                  aria-pressed={offerTo.includes(c.id)}
                  onClick={() =>
                    setOfferTo((ids) =>
                      ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                    )
                  }
                >
                  {c.name}
                </button>
              ))}
          </div>
          <input
            aria-label="Reason for the reaction"
            placeholder="the goblin is leaving your reach"
            value={offerWhy}
            onChange={(e) => setOfferWhy(e.target.value)}
          />
          <div className="row">
            <button
              disabled={offerTo.length === 0}
              onClick={() => {
                append({
                  type: "reactionOffered",
                  to: offerTo,
                  because: offerWhy.trim() || "something is happening",
                  from: active?.name ?? "someone",
                  // By id as well, so the swing that answers is aimed at
                  // whoever provoked it rather than at the whole board.
                  ...(active ? { fromId: active.id } : {}),
                });
                setOffering(false);
                setOfferTo([]);
                setOfferWhy("");
              }}
            >
              Ask them
            </button>
          </div>
        </div>
      )}

      {/* A shove, waiting on the only person who can settle it. */}
      {seat.kind === "dm" && combat.shove && (
        <div className="card-body shove-ask">
          <span className="label">
            {combat.shove.byName} shoves {combat.shove.targetName}
          </span>
          <p className="swing-ask">
            Athletics <b>{combat.shove.total}</b>. Roll theirs — Athletics or
            Acrobatics, their choice.
          </p>
          <div className="row">
            <button onClick={() => append({ type: "shoveResolved", prone: true })}>
              Down it goes
            </button>
            <button onClick={() => append({ type: "shoveResolved", prone: false })}>
              It holds
            </button>
          </div>
        </div>
      )}

      {/* What people are holding, so it is not one player's memory. */}
      {Object.keys(combat.readied).length > 0 && (
        <div className="card-body readied">
          {combat.order
            .filter((c) => combat.readied[c.id])
            .map((c) => (
              <div className="ready-row" key={c.id}>
                <span className="nm">{c.name} is waiting</span>
                <span className="faint">{combat.readied[c.id]}</span>
                {seat.kind === "dm" && (
                  <button
                    onClick={() =>
                      append({ type: "readiedActionCleared", combatantId: c.id })
                    }
                  >
                    It fired
                  </button>
                )}
              </div>
            ))}
        </div>
      )}


      {/*
        * What the big things in this fight can do between turns, and what
        * the place itself does. On screen during OTHER creatures' turns,
        * because that is exactly when a legendary action is available and
        * exactly when nothing else wants the DM's attention.
        */}
      {seat.kind === "dm" && bigOnes.length > 0 && (
        <div className="card-body">
          {bigOnes.map((m) => (
            <Legendary
              key={m.id}
              who={m.id}
              name={m.name}
              /* What the book said, or what the DM said when it did not. */
              budget={combat.legendaryBudget?.[m.id] ?? m.budget}
              spent={combat.legendarySpent[m.id]}
              options={m.options}
              isTheirTurn={active?.id === m.id}
              append={append}
            />
          ))}
          <Lair
            lair={
              combat.lair
                ? { ...combat.lair }
                : (bigOnes.find((m) => m.lair)?.lair ?? null)
            }
            round={combat.round}
            append={append}
          />
        </div>
      )}

      {/*
        * The creature whose turn it is, whole.
        *
        * Staging kept its hit points, its armour class and the actions that
        * deal damage — 17 of 57 entries across seven common monsters. The
        * rest was readable in the Book tab, which means leaving the fight on
        * the one screen you cannot leave. Multiattack is dropped from nearly
        * every statblock in the game, so the app was quietest about the line
        * that says how many times to swing.
        *
        * DM only, and for the same reason the Book tab is: a player who can
        * read the statblock knows the armour class, which is what the
        * disclosure ladder exists to withhold.
        */}
      {seat.kind === "dm" && activeBlock && (
        <div className="card-body sb-turn">
          <button
            className="sb-turn-hd"
            aria-expanded={sbOpen}
            aria-label={`${activeBlock.name} statblock`}
            onClick={() => setSbOpen(!sbOpen)}
          >
            <span className="label">{active?.name ?? activeBlock.name}</span>
            <span className="faint">{sbOpen ? "Hide" : "Show"}</span>
          </button>
          {sbOpen && (
            <StatblockView
              m={activeBlock}
              onAct={(a) => {
                /*
                 * A breath weapon is not an attack roll.
                 *
                 * "Each creature in that line must make a DC 18 Dexterity
                 * saving throw" has no to-hit in it at all, and this opened
                 * the swing walkthrough anyway — because tapping an action
                 * led there whatever the action was. Four thousand actions in
                 * the compendium ask for a save.
                 *
                 * So a save goes to the area tool, which already asks the
                 * right question: who was caught, and who made it.
                 */
                const save = saveFromAction(a);
                if (save) {
                  setAreaFrom({
                    name: a.name,
                    dc: save.dc,
                    ability: save.ability,
                    amount: save.average ?? 0,
                    damageType: save.damageType ?? "",
                    half: save.half,
                  });
                  setArea(true);
                  return;
                }
                /*
                 * Otherwise it is a swing, and tapping it does not roll it:
                 * it carries the numbers — which die, which modifier — and
                 * asks the table for the result.
                 */
                setUsing(a);
                setDealt(0);
                if (!target) setDmPicking("target");
              }}
            />
          )}
        </div>
      )}


      {/*
        * The screen follows the turn.
        *
        * It used to be the order, then the statblock, then whatever a
        * feature needed when it was built. Now it answers the questions a
        * turn actually raises, in that order: whose turn it is (the header
        * above), what is WAITING on you, what the one who is up can DO, and
        * only then the order — which is a reference you glance at rather
        * than the thing you are working in.
        *
        * Claims, a shove, readied actions and a big creature's legendary
        * actions are all the same kind of thing: somebody else is blocked
        * until you answer. They belong together and they belong first.
        */}
      <div className="track">
        {visible.map((c) => {
          const isActive = active?.id === c.id;
          const hp =
            c.source.kind === "creature"
              ? { current: combat.creatureHp[c.id] ?? 0, max: c.source.maxHp }
              : {
                  current: state.characters[c.source.characterId]?.currentHp ?? 0,
                  max: state.builds[c.source.characterId]?.maxHp ?? 1,
                };
          const showExact = seat.kind === "dm" || c.disclosure === "exact";
          /*
           * The conditions, built once and placed twice.
           *
           * On a DM's creature row it belongs INSIDE the control strip, so
           * its "+" sits with the other things a DM presses instead of
           * holding a forty-four pixel band of its own — which, with six
           * goblins on screen, was three hundred pixels of nothing but
           * plus signs. Everywhere else it is a band, because a player's
           * conditions are information rather than a control.
           */
          const dmCreature = seat.kind === "dm" && c.source.kind === "creature";
          const conds = (
            <ConditionStrip
              who={c.name}
              on={
                c.source.kind === "creature"
                  ? (combat.creatureConditions[c.id] ?? [])
                  : (state.characters[c.source.characterId]?.conditions ?? [])
              }
              editable={dmCreature}
              onAdd={(cond) =>
                append({ type: "creatureConditionAdded", combatantId: c.id, condition: cond })
              }
              onRemove={(cond) =>
                append({ type: "creatureConditionRemoved", combatantId: c.id, condition: cond })
              }
            />
          );
          return (
            <div className={`cbt${isActive ? " on" : ""}`} key={c.id}>
              {/*
                * Which of these is a person.
                *
                * Six rows deep, a DM scanning the order had nothing telling
                * them apart: a goblin and a player character are the same
                * shape of row with the same kind of number. The disclosure
                * chip only appears on creatures, which is a tell you have to
                * know to read. This says it directly, on the side the eye
                * starts.
                *
                * A glyph from the set the hotbar already uses — no icon
                * library and no webfont, which is the same reason this app
                * ships neither.
                */}
              <span className="i num">
                {c.source.kind === "character" && (
                  <span className="pc" aria-hidden="true">{"\u2726"}</span>
                )}
                {c.initiative}
              </span>
              <span className="who">
                {/*
                  * Six goblins arrive as Goblin 1 through 6, which is enough
                  * to tell them apart in a list and not at a table. The
                  * moment one does something memorable it stops being a
                  * number, and the DM was left saying "the second goblin,
                  * no, the other second one".
                  */}
                {seat.kind === "dm" && c.source.kind === "creature" ? (
                  <button
                    className="nm nm-edit"
                    aria-label={`Rename ${c.name}`}
                    onClick={() => { setNaming(c.id); setNewName(c.name); }}
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="nm">{c.name}</span>
                )}
              </span>
              <span className="hp num">
                {showExact
                  ? `${hp.current}/${hp.max}`
                  : c.disclosure === "vague"
                    ? VAGUE_LABEL[healthStep(hp.current, hp.max)]
                    : "—"}
              </span>
              {/*
                * One strip, on a line of its own.
                *
                * These were five separate children of a grid with five
                * columns — and the grid had been sized for the five that
                * existed when it was written. Every control added since
                * (the economy, the condition +, the hurt menu) fell onto an
                * implicit row of its own, so a creature stood four ragged
                * bands tall with the initiative number floating thirty-six
                * pixels below the name it belongs to.
                *
                * Grouping them means the row above is exactly what a
                * player's row is — initiative, name, health — and the two
                * line up down the list. A control added tomorrow joins this
                * strip instead of inventing a sixth band.
                */}
              {seat.kind === "dm" && c.source.kind === "creature" && (
                <div className="cbt-do">
                  <CreaturePips
                    id={c.id}
                    name={c.name}
                    spent={combat.spent[c.id]}
                    append={append}
                  />
                  <button
                    className="disc"
                    aria-label={`${c.name} is ${c.disclosure} — show more`}
                    onClick={() =>
                      append({
                        type: "disclosureSet",
                        combatantId: c.id,
                        level: nextDisclosure(c.disclosure),
                      })
                    }
                  >
                    {c.disclosure}
                  </button>
                  <button
                    className="hitbtn"
                    aria-label={`Hurt ${c.name} by ${hit}`}
                    onClick={() => append({ type: "creatureDamaged", combatantId: c.id, amount: hit })}
                  >
                    −{hit}
                  </button>
                  {/*
                    * And a number that is not the last one used. It was a
                    * single box at the foot of the card feeding every row,
                    * so "which row does this apply to" was answered by
                    * remembering rather than by looking.
                    */}
                  <button
                    className="hitbtn more"
                    aria-label={`Hurt or heal ${c.name}`}
                    aria-expanded={hurting === c.id}
                    onClick={() => setHurting(hurting === c.id ? null : c.id)}
                  >
                    {hurting === c.id ? "−" : "…"}
                  </button>
                  {conds}
                </div>
              )}
              {naming === c.id && (
                <div className="hurt-row cbt-band">
                  <input
                    aria-label={`New name for ${c.name}`}
                    value={newName}
                    autoFocus
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (newName.trim()) {
                        append({ type: "combatantRenamed", combatantId: c.id, name: newName.trim() });
                      }
                      setNaming(null);
                    }}
                  />
                  <button
                    aria-label={`Call it ${newName.trim() || c.name}`}
                    disabled={!newName.trim()}
                    onClick={() => {
                      append({ type: "combatantRenamed", combatantId: c.id, name: newName.trim() });
                      setNaming(null);
                    }}
                  >
                    Rename
                  </button>
                  <button onClick={() => setNaming(null)}>Cancel</button>
                </div>
              )}
              {hurting === c.id && seat.kind === "dm" && c.source.kind === "creature" && (
                <div className="hurt-row cbt-band">
                  <Num min={0} value={amount}
                    aria-label={`Amount for ${c.name}`}
                    style={{ width: 74 }}
                    onChange={setAmount}
                  />
                  <button
                    aria-label={`Damage ${c.name}`}
                    onClick={() => {
                      append({ type: "creatureDamaged", combatantId: c.id, amount });
                      setHit(amount);
                      setHurting(null);
                    }}
                  >
                    Hurt
                  </button>
                  <button
                    aria-label={`Heal ${c.name}`}
                    onClick={() => {
                      append({ type: "creatureDamaged", combatantId: c.id, amount: -amount });
                      setHurting(null);
                    }}
                  >
                    Heal
                  </button>
                  <span className="faint">of {hp.max}</span>
                </div>
              )}
              {/* What is wrong with them, where both sides can read it. This
                  is what turns "roll a d20" into "roll two and take the
                  higher" one screen over. */}
              {/* Wrapped, so this section names its own band rather than
                  reaching for a class the initiative screen already scopes. */}
              {!dmCreature && <div className="cbt-band">{conds}</div>}
            </div>
          );
        })}
      </div>


      {seat.kind === "dm" && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <button
            className="next-turn"
            disabled={!canEnd}
            aria-label="Next turn"
            onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
          >
            Next turn
            <small>{upNext ? `${upNext.name} is up` : "round ends"}</small>
          </button>
          {/*
            * Back a turn used to live here, at the foot of the card and a
            * long way from the name that is wrong. It moved up beside that
            * name — see .up-step — and this is deliberately not a second copy
            * of it: two controls answering to "Back a turn" is an ambiguity
            * for anyone driving by name, which is how the browser suites and
            * a screen reader both find things.
            */}
        </div>
      )}

      <div className="card-body">
        <div className="controls mt-0">
          {seat.kind === "dm" && (
            <>
              {/*
                * The DM's side of an attack. Creature rows carry a fast "−N"
                * for chip damage, but a monster swinging at a PLAYER had no
                * route at all from here — the only way was to leave the fight
                * for the party screen, which is the one thing you cannot do
                * mid-turn.
                */}
              <button
                onClick={() => {
                  if (dmPicking) {
                    setDmPicking(null);
                    setReactor(null);
                    return;
                  }
                  const own = active !== null && active.controller.kind === "dm";
                  setReactor(own ? active : null);
                  setDmPicking(own ? "target" : "reactor");
                }}
              >
                {dmPicking
                  ? "Cancel"
                  : active && active.controller.kind === "dm"
                    ? `Attack with ${active.name}`
                    : "Opportunity attack"}
              </button>
              {/*
                * Reactions, offered rather than detected. The app cannot see
                * reach or line of sight — the positions are on the table —
                * so it can never know the moment arrived. The DM does, and
                * this is them saying so to exactly the people it concerns,
                * instead of asking the room and hoping.
                */}
              <button
                onClick={() => setOffering((v) => !v)}
                disabled={combat.offer !== null}
              >
                {offering ? "Cancel" : "Offer a reaction"}
              </button>
            </>
          )}
          {seat.kind === "dm" && (
            <>

              <button onClick={() => setArea((v) => !v)}>Area damage</button>
              <button onClick={() => setSomething((v) => !v)}>
                {something ? "Cancel" : "Something arrives"}
              </button>
              {/*
                * Ending a fight is one press and cannot be misread as the one
                * beside it, so it keeps its distance from the control the DM
                * presses forty times an evening.
                */}
              <button className="end-it" onClick={() => append({ type: "combatEnded" })}>
                End combat
              </button>
            </>
          )}
        </div>

        {something && seat.kind === "dm" && (
          <Arrival
            onCancel={() => setSomething(false)}
            onAdd={(combatant) => {
              append({ type: "combatantJoined", combatant });
              setSomething(false);
            }}
          />
        )}
        {dmPicking === "reactor" && seat.kind === "dm" && (() => {
          const able = combat.order.filter(
            (c) =>
              c.controller.kind === "dm" &&
              c.id !== active?.id &&
              hasReaction(combat, c.id) &&
              (c.source.kind !== "creature" || (combat.creatureHp[c.id] ?? 1) > 0),
          );
          return (
            <div className="tgt">
              <span className="label">Which one reacts</span>
              {able.map((c) => (
                <button
                  className="tgt-row"
                  key={c.id}
                  onClick={() => {
                    setReactor(c);
                    setDmPicking("target");
                  }}
                >
                  {c.name}
                </button>
              ))}
              {able.length === 0 && (
                <p className="faint note">
                  Nothing of yours has a reaction left. They come back on their
                  own turns.
                </p>
              )}
            </div>
          );
        })()}

        {dmPicking === "target" && seat.kind === "dm" && (
          <div className="tgt">
            <span className="label">
              {reactor ? `${reactor.name} attacks` : "Attacks"}
            </span>
            {/* Everyone but the attacker: monsters turn on each other often
                enough — charmed, confused, or just badly aimed. */}
            {combat.order
              .filter((c) => c.id !== reactor?.id)
              .map((c) => (
                <button
                  className="tgt-row"
                  key={c.id}
                  onClick={() => {
                    // Off-turn, this IS an opportunity attack: one event
                    // spends the reaction and records who it was against, so
                    // undoing the attack gives the reaction back.
                    if (reactor && reactor.id !== active?.id) {
                      append({
                        type: "opportunityTaken",
                        attacker: reactor.id,
                        against: c.id,
                      });
                    }
                    setTarget(c);
                    setDealt(0);
                    setDmPicking(null);
                  }}
                >
                  {c.name}
                </button>
              ))}
          </div>
        )}
        {area && seat.kind === "dm" && (
          <AreaDamage
            combat={combat}
            onApply={append}
            {...(areaFrom ? { from: areaFrom } : {})}
            onClose={() => { setArea(false); setAreaFrom(null); }}
          />
        )}
        {seat.kind === "dm" && !canEnd && (
          <p className="faint note">
            {active ? `${active.name} is up.` : "Nobody is up."}
          </p>
        )}
      </div>
    </section>
  );
}
