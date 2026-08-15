import { useEffect, useRef, useState } from "react";
import type { Character } from "../domain/build.js";
import type { Stack } from "../domain/items.js";
import type { KnownSpell } from "../domain/spells.js";
import { actorKey } from "../domain/permissions.js";
import { turnsUntil } from "../domain/combat.js";
import { levelsOwed } from "../domain/project.js";
import { useCampaign } from "../store/useCampaign.js";
import { useSeat } from "../store/useSeat.js";
import { Combat } from "./Combat.js";
import { CreateCharacter } from "./CreateCharacter.js";
import { Feed } from "./Feed.js";
import { NewCharacter } from "./NewCharacter.js";
import { Party } from "./Party.js";
import { EncounterBuilder } from "./EncounterBuilder.js";
import { Homebrew } from "./Homebrew.js";
import { LevelUp } from "./LevelUp.js";
import { Npcs } from "./Npcs.js";
import { Progression } from "./Progression.js";
import { Reference } from "./Reference.js";
import { RoomBar } from "./RoomBar.js";
import { Sheet } from "./Sheet.js";
import { AnswerCheck } from "./AnswerCheck.js";
import { AskCheck } from "./AskCheck.js";
import { Sources } from "./Sources.js";
import { Spells } from "./Spells.js";
import { Tabs, type TabDef } from "./Tabs.js";
import { Gear } from "./Gear.js";

/** Device-local, like the seat — never in the log. */
type TabId = "fight" | "party" | "prep" | "book" | "log" | "sheet" | "gear" | "spells";
import { Shop } from "./Shop.js";
import { UpdateBar } from "./UpdateBar.js";

export function App() {
  const { seat, mine: myCharacters, setSeat, claim } = useSeat();
  /** Null until you pick one, so the sensible default can change under you. */
  const [tab, setTab] = useState<TabId | null>(null);
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);

  // Events are signed by the seat, which is what makes one person editing
  // another's sheet acceptable rather than merely convenient.
  const campaign = useCampaign(actorKey(seat));
  const {
    ready, log, state, append, revert, reset, reverted,
    room, status, members, dmRole, dmKey, claimDm, joinRoom, leaveRoom,
  } = campaign;

  /**
   * Only the device that started the room may sit in the DM's seat. `null`
   * means the server has not answered yet and is treated as "yes", so a DM
   * reloading is never briefly tipped out of their own seat; the joiner's
   * side is seeded false at the moment they press Join, so there is no
   * matching window on the other side.
   */
  const mayBeDm = dmRole !== false;

  const builds = Object.values(state.builds);
  /** A player sees their own sheet; the DM sees the party instead. */
  const mine =
    seat.kind === "player" ? state.builds[seat.characterId] : undefined;
  const mineState = mine ? state.characters[mine.id] : undefined;
  /** A save owed NOW is the one thing allowed to take the screen. */
  const saveOwed = mineState ? mineState.concentrationChecks.length > 0 : false;

  /**
   * The DM's screen is a planning surface, not a character sheet. Making a
   * character was a REQUIREMENT before this: an empty campaign put session
   * zero in front of whoever opened it, so the person who starts the room —
   * always the DM — was asked to roll ability scores before they could build
   * an encounter. It stays available, because a DM running a companion NPC or
   * taking a missing player's character is a real thing, and the seat selector
   * already lets them sit anywhere.
   */
  const dmView = seat.kind === "dm" && mayBeDm;
  /**
   * What this device may sit in: its own characters, plus whoever it is
   * already sitting in — a DM who takes a character from their own dropdown
   * has not "claimed" it, and dropping it from the list would strand them.
   */
  const seatable = dmView
    ? builds
    : builds.filter(
        (b) =>
          myCharacters.includes(b.id) ||
          (seat.kind === "player" && seat.characterId === b.id),
      );

  /**
   * Someone who has joined a campaign that already has characters and holds
   * none of them. Keyed on the seat rather than on the list being empty, so
   * a device already sitting somewhere is never asked again.
   */
  const needsClaim =
    !dmView && seat.kind === "dm" && myCharacters.length === 0 && builds.length > 0;
  const needsCharacter = (builds.length === 0 && !dmView) || adding || building;

  /**
   * Split by responsibility, not by screen size. The DM's are the postures
   * they actually switch between: running the fight, looking after the
   * party, prepping, looking something up. The players' are theirs.
   */
  const owed = mine ? levelsOwed(state, mine.id) : 0;
  const shopOpen = state.openTrader !== null;
  const myTurn =
    state.combat !== null &&
    mine !== undefined &&
    turnsUntil(state.combat, mine.id) === 0;

  const dmTabs: TabDef<TabId>[] = [
    { id: "fight", label: "Fight", dot: state.combat?.phase === "rolling" },
    { id: "party", label: "Party" },
    { id: "prep", label: "Prep" },
    { id: "book", label: "Book" },
    { id: "log", label: "Log" },
  ];
  /** Only casters get a Spells tab — a fighter has nothing to put on it. */
  const casts =
    mine !== undefined &&
    (mine.spellSlots.some((n) => n > 0) || (mineState?.spells.length ?? 0) > 0);
  const playerTabs: TabDef<TabId>[] = [
    { id: "fight", label: "Fight", dot: myTurn },
    { id: "sheet", label: "Sheet", dot: owed > 0 || saveOwed },
    ...(casts ? [{ id: "spells" as const, label: "Spells" }] : []),
    { id: "gear", label: "Gear", dot: shopOpen },
    { id: "log", label: "Log" },
  ];
  const tabs = dmView ? dmTabs : playerTabs;
  /**
   * Where you land before choosing. Never "Fight" when there is no fight —
   * that is a dead screen with "No fight yet" on it. A player's home is their
   * sheet; a DM's is the party they are looking after.
   */
  const home: TabId = state.combat !== null ? "fight" : dmView ? "party" : "sheet";
  // A seat change can also leave you on a tab the other side does not have.
  const current = tab !== null && tabs.some((t) => t.id === tab) ? tab : home;

  // A fresh device defaults to the DM's seat, which is right when it is alone
  // and wrong the instant it joins someone else's room. Move it off rather
  // than merely hiding the option — otherwise a player who never touches the
  // selector spends the session looking at the DM's screen.
  /**
   * A fight starting moves everyone to it. This is the "combat focus mode"
   * the players' side was always meant to have — on the transition only, so
   * it happens once per fight rather than fighting you for the screen.
   */
  const inFight = state.combat !== null;
  const wasFighting = useRef(inFight);
  useEffect(() => {
    if (inFight && !wasFighting.current) setTab("fight");
    wasFighting.current = inFight;
  }, [inFight]);

  const wasOwed = useRef(saveOwed);
  useEffect(() => {
    if (saveOwed && !wasOwed.current) setTab("sheet");
    wasOwed.current = saveOwed;
  }, [saveOwed]);

  useEffect(() => {
    if (mayBeDm || seat.kind !== "dm") return;
    // Only into a character this device owns. Dropping them into the first
    // one in the party is what let a player read somebody else's sheet.
    const first = builds.find((b) => myCharacters.includes(b.id));
    if (first) setSeat({ kind: "player", characterId: first.id });
  }, [mayBeDm, seat.kind, builds, myCharacters, setSeat]);

  function create(
    c: Character,
    starting?: {
      items: readonly Stack[];
      coins: number;
      equip?: readonly string[];
      spells?: readonly KnownSpell[];
    },
  ) {
    append({ type: "characterAdded", character: c });
    // Worn and wielded straight away: a kit in a pack gives no attacks and no
    // armour class, and "go and equip something" is the hidden step this is
    // meant to remove.
    for (const itemId of starting?.equip ?? []) {
      const name = starting?.items.find((i) => i.itemId === itemId)?.name ?? itemId;
      append({ type: "itemEquipped", who: c.base.id, itemId, name });
    }
    for (const spell of starting?.spells ?? []) {
      append({ type: "spellLearned", who: c.base.id, spell });
    }
    // One event for the whole kit, so undoing it takes back everything the
    // character walked in with rather than half of it.
    if (starting && (starting.items.length > 0 || starting.coins > 0)) {
      append({
        type: "lootGranted",
        to: { kind: "character", who: c.base.id },
        items: starting.items,
        coins: starting.coins,
      });
    }
    setAdding(false);
    setBuilding(false);
    /*
     * A device that just made a character owns it and sits in it — unless it
     * is the DM of a room, who makes characters for other people and for
     * companions and should not be yanked out of their own screen.
     *
     * dmRole rather than dmView: a device with no room at all reads as the DM
     * by default, and that is exactly the person who wants their own sheet.
     */
    if (dmRole !== true) claim(c.base.id);
  }

  if (!ready) return <div className="app"><p className="faint">Loading…</p></div>;

  return (
    <div className="app">
      <UpdateBar />
      <RoomBar
        room={room}
        status={status}
        members={members}
        dmRole={dmRole}
        dmKey={dmKey}
        onJoin={joinRoom}
        onLeave={leaveRoom}
        onClaim={claimDm}
      />

      <div className="topbar">
        <h1>Table Companion</h1>
        <div className="row">
          {(builds.length > 0 || dmView) && !adding && (
            <button onClick={() => setAdding(true)}>Add character</button>
          )}
          {builds.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Discard everything on this device?")) reset();
              }}
            >
              Start over
            </button>
          )}
        </div>
      </div>

      {builds.length > 0 && (
        <div className="seatbar">
          {needsClaim ? (
            <span className="label">Joining the table</span>
          ) : (
            <>
              <span className="label">I am</span>
              <select
                aria-label="Seat"
                value={seat.kind === "dm" ? "dm" : `pc:${seat.characterId}`}
                onChange={(e) => {
                  const v = e.target.value;
                  setSeat(v === "dm" ? { kind: "dm" } : { kind: "player", characterId: v.slice(3) });
                }}
              >
                {mayBeDm && <option value="dm">the DM</option>}
                {/* Only this device's own characters. */}
                {seatable.map((b) => (
                  <option key={b.id} value={`pc:${b.id}`}>{b.name}</option>
                ))}
              </select>
            </>
          )}
          {adding && <button onClick={() => setAdding(false)}>Cancel</button>}
        </div>
      )}

      {!needsCharacter && !needsClaim && (
        <Tabs tabs={tabs} active={current} onPick={setTab} />
      )}

      {/* A roll the DM asked for is owed NOW, so it sits above whatever tab
          you happen to be on rather than waiting to be found. */}
      {mine &&
        state.checks
          .filter((c) => c.who.includes(mine.id))
          .map((c) => (
            <AnswerCheck key={c.id} check={c} build={mine} append={append} />
          ))}

      {/* Somebody has joined a campaign that already has characters. They are
          either one of the people on the list or a new arrival, and a
          dropdown of existing names strands the second kind. */}
      {needsClaim && !needsCharacter && (
        <>
          <section className="card">
            <div className="card-hd">
              <span className="label">Which one are you?</span>
            </div>
            <div className="join">
              {builds.map((b) => (
                <button className="join-row" key={b.id} onClick={() => claim(b.id)}>
                  <span className="nm">{b.name}</span>
                  <span className="faint">
                    {b.classes.map((c) => `${c.classId} ${c.level}`).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
            <div className="card-body">
              <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
                Pick your character and this device remembers it. Nobody else&rsquo;s
                sheet will be offered again.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card-hd">
              <span className="label">Or you are new</span>
              <button onClick={() => setBuilding(true)}>Build a character</button>
            </div>
            <div className="card-body">
              <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
                Turning up mid-campaign is normal. Build one at whatever level
                the party is, or bring one in below.
              </p>
            </div>
          </section>

          <NewCharacter onCreate={create} />
        </>
      )}

      {needsCharacter ? (
        building ? (
          <CreateCharacter onCreate={create} onCancel={() => setBuilding(false)} />
        ) : (
          <>
            <section className="card">
              <div className="card-hd">
                <span className="label">Session zero</span>
                <button onClick={() => setBuilding(true)}>Build a character</button>
              </div>
              <div className="card-body">
                <p className="faint" style={{ margin: 0, fontSize: ".88rem" }}>
                  Make one here, or bring one in below. Either way it ends up
                  the same character.
                </p>
              </div>
            </section>
            <NewCharacter onCreate={create} />
          </>
        )
      ) : (
        <>
          {/* The fight is always the first tab, on both sides. */}
          {current === "fight" && (
            <Combat
              state={state}
              seat={seat}
              append={append}
              onCast={() => setTab("spells")}
            />
          )}

          {dmView ? (
            <>
              {/* Session zero lives with the party, because that tab is who
                  is at this table — and it is where an empty campaign lands. */}
              {current === "party" && (
                <>
                  {builds.length === 0 && (
                    <>
                      <section className="card">
                        <div className="card-hd">
                          <span className="label">Session zero</span>
                          <button onClick={() => setBuilding(true)}>Build a character</button>
                        </div>
                        <div className="card-body">
                          <p className="faint" style={{ margin: 0, fontSize: ".88rem" }}>
                            Nobody yet. Make one here or bring one in — or leave
                            it and prep the session under Prep.
                          </p>
                        </div>
                      </section>
                      <NewCharacter onCreate={create} />
                    </>
                  )}
                  <Party state={state} seat={seat} append={append} />
                  <AskCheck state={state} append={append} />
                  <Progression state={state} append={append} />
                </>
              )}

              {current === "prep" && (
                <>
                  <EncounterBuilder state={state} append={append} />
                  <Npcs state={state} append={append} />
                  <Homebrew state={state} append={append} />
                </>
              )}

              {current === "book" && (
                <>
                  <Reference homebrew={state.homebrew} />
                  <Sources />
                </>
              )}
            </>
          ) : mine && mineState ? (
            <>
              {current === "sheet" && (
                <>
                  <LevelUp
                    build={mine}
                    owed={levelsOwed(state, mine.id)}
                    append={append}
                  />
                  <Sheet build={mine} state={mineState} campaign={state} append={append} />
                </>
              )}

              {current === "spells" && (
                <Spells
                  build={mine}
                  state={mineState}
                  append={append}
                  combat={state.combat}
                  onCast={(c) =>
                    append({
                      type: "attackClaimed",
                      claim: {
                        id: `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                        who: mine.id,
                        whoName: mine.name,
                        targetId: c.target.id,
                        targetName: c.target.name,
                        weapon: c.spell.name,
                        toHit: c.toHit,
                        damage: c.damage,
                        damageType: c.damageType,
                        at: Date.now(),
                      },
                    })
                  }
                />
              )}

              {current === "gear" && (
                <>
                  <Shop
                    state={state}
                    who={mine.id}
                    coins={mineState.coins}
                    append={append}
                  />
                  <Gear build={mine} state={mineState} append={append} />
                  {/* Content is device-local, so every device needs its own
                      way in — not just the DM's. */}
                  <Sources />
                </>
              )}
            </>
          ) : (
            current !== "log" && (
              <section className="card">
                <div className="card-body">
                  <p className="faint" style={{ margin: 0 }}>
                    That seat has no character on this device yet.
                  </p>
                </div>
              </section>
            )
          )}
        </>
      )}

      {current === "log" && !needsCharacter && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Action log</span>
            <span className="label faint">{log.length} events</span>
          </div>
          <div className="card-body">
            <Feed
              log={log}
              builds={state.builds}
              reverted={reverted}
              onRevert={revert}
              seat={seat}
            />
          </div>
        </section>
      )}
    </div>
  );
}
