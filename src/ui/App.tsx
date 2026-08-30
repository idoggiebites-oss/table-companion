import { useEffect, useRef, useState } from "react";
import type { Character, CharacterId } from "../domain/build.js";
import type { Stack } from "../domain/items.js";
import type { KnownSpell } from "../domain/spells.js";
import { actorKey } from "../domain/permissions.js";
import { combatantIdOf, turnsUntil, type Combatant } from "../domain/combat.js";
import { useWide } from "./useWide.js";
import { stanceFor } from "../domain/stance.js";
import { levelsOwed } from "../domain/project.js";
import { useCampaign } from "../store/useCampaign.js";
import { useSeat } from "../store/useSeat.js";
import { Combat } from "./Combat.js";
import { CreateCharacter } from "./CreateCharacter.js";
import { Feed } from "./Feed.js";
import { NewCharacter } from "./NewCharacter.js";
import { Party } from "./Party.js";
import { EncounterBuilder } from "./EncounterBuilder.js";
import { Scenes } from "./Scenes.js";
import { Homebrew } from "./Homebrew.js";
import { LevelUp } from "./LevelUp.js";
import { Npcs } from "./Npcs.js";
import { Progression } from "./Progression.js";
import { ReactionAsk } from "./ReactionAsk.js";
import { TurnBar } from "./TurnBar.js";
import { Reference } from "./Reference.js";
import { RoomBar, RoomMenu } from "./RoomBar.js";
import type { ConnectionStatus } from "../sync/client.js";
import { Sheet } from "./Sheet.js";
import { AnswerCheck } from "./AnswerCheck.js";
import { AskCheck } from "./AskCheck.js";
import { AskToRebuild, EditAsks } from "./EditAsk.js";
import { grantToSpend } from "../domain/editask.js";
import { Sources } from "./Sources.js";
import { SpellLookup } from "./SpellLookup.js";
import { Spells } from "./Spells.js";
import { Boundary } from "./Boundary.js";
import { Tabs, type TabDef } from "./Tabs.js";
import { Gear } from "./Gear.js";
import { Recap } from "./Recap.js";
import { Popover } from "./Popover.js";
import { WhatNext } from "./WhatNext.js";
import type { PromptTab } from "../domain/prompts.js";

/**
 * The connection, in the words the room sheet uses. On the dot itself,
 * because a colour is not a state anybody can name.
 */
const STATUS_SAID: Record<ConnectionStatus, string> = {
  offline: "Solo — nothing is syncing",
  connecting: "Connecting",
  online: "Live",
};

/** Every screen a prompt can name. Filtered per device by `reachable`. */
const PROMPT_TABS: readonly PromptTab[] = ["sheet", "spells", "party", "prep", "combat"];
import { Notes } from "./Notes.js";
import { Buzz } from "./Buzz.js";
import { loadSpells } from "../store/srd.js";

/** Device-local, like the seat — never in the log. */
type TabId =
  | "combat" | "party" | "prep" | "book" | "log" | "sheet" | "gear" | "spells" | "notes";

/** What a crash on this tab calls itself. */
const TAB_NAME: Record<TabId, string> = {
  combat: "Combat", party: "The party", prep: "Prep", book: "The book",
  log: "The log", sheet: "Your sheet", gear: "Your gear", spells: "Your spells",
  notes: "Your notes",
};
import { Shop } from "./Shop.js";
import { UpdateBar } from "./UpdateBar.js";

export function App() {
  const { seat, mine: myCharacters, setSeat, claim, claimOnly } = useSeat();
  /** Null until you pick one, so the sensible default can change under you. */
  const [tab, setTab] = useState<TabId | null>(null);
  /** Said yes to a reaction from another screen; the fight opens the swing. */
  const [takingReaction, setTakingReaction] = useState(false);
  /** Room for the fight and something else at the same time. */
  const wide = useWide();
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);
  /*
   * Rebuilding an existing character rather than making a new one. Held as
   * the character's id, because the rebuild has to replace THAT one — and
   * because it is what tells `create` which of the two things it is doing.
   */
  const [rebuilding, setRebuilding] = useState<CharacterId | null>(null);
  /** The two sheets behind the header: the room's controls, and this device's. */
  const [roomOpen, setRoomOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);

  // Events are signed by the seat, which is what makes one person editing
  // another's sheet acceptable rather than merely convenient.
  const campaign = useCampaign(actorKey(seat));
  const {
    ready, log, state, append, revert, reset, reverted, watch, unwatch,
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

  /** What this character did on their turn that changes their own dice. */
  const mySeatId = state.combat && mine ? combatantIdOf(state.combat, mine.id) : null;
  /*
   * A reaction the DM has offered me and I have not answered. It is owed NOW
   * — the table is stopped on it — so it belongs above the tabs beside a
   * check, not inside the fight where only somebody already looking would
   * find it.
   */
  const offer = state.combat?.offer ?? null;
  const offeredToMe =
    offer && mySeatId && offer.to.includes(mySeatId) && !offer.declined.includes(mySeatId)
      ? offer
      : null;
  const reactionSpare = mineState ? !mineState.economy.reaction : false;
  /*
   * And not once they have said yes.
   *
   * The prompt used to be an inline card, so leaving it up while the swing
   * opened underneath was untidy and nothing worse. It is a modal with a
   * scrim now, and a scrim that outlives its question blocks the very screen
   * it just sent you to.
   *
   * `takingReaction` is no good for this: PlayerTurn clears it the moment it
   * opens the swing, so the modal came straight back. What is needed is
   * "I have answered THIS offer" — remembered against the offer itself, so a
   * second offer later in the fight still interrupts.
   */
  const offerKey = offeredToMe ? `${offeredToMe.from}|${offeredToMe.because}` : null;
  const [answeredOffer, setAnsweredOffer] = useState<string | null>(null);
  const askingReaction =
    offeredToMe !== null && reactionSpare && answeredOffer !== offerKey;

  const dmTabs: TabDef<TabId>[] = [
    { id: "combat", label: "Combat", dot: state.combat?.phase === "rolling" },
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
    { id: "combat", label: "Combat", dot: myTurn || askingReaction },
    { id: "sheet", label: "Sheet", dot: owed > 0 || saveOwed },
    ...(casts ? [{ id: "spells" as const, label: "Spells" }] : []),
    { id: "gear", label: "Gear", dot: shopOpen },
    { id: "notes", label: "Notes" },
    { id: "log", label: "Log" },
  ];
  /*
   * Wide enough for two things at once, and there is a fight to be the first
   * of them. The tabs exist because a phone cannot show two things — given
   * the room, the fight simply stays on screen and the tab bar drives what
   * sits beside it. So the Fight tab is not offered: it is already there, and
   * a tab that shows you what you are looking at is a dead control.
   */
  const twoUp = wide && state.combat !== null && !needsCharacter && !needsClaim;
  const tabs = (dmView ? dmTabs : playerTabs).filter((t) => !(twoUp && t.id === "combat"));
  /*
   * Where a prompt is allowed to send someone. A player has no Prep tab and a
   * wide screen has no Combat one — the fight is already beside you — so a
   * prompt pointing at either is dropped rather than rendered as a button
   * that lands on the home screen instead.
   */
  const reachable = PROMPT_TABS.filter((t) => tabs.some((x) => x.id === t));
  /**
   * Where you land before choosing. Never "Combat" when there is no fight —
   * that is a dead screen with "No fight yet" on it. A player's home is their
   * sheet; a DM's is the party they are looking after.
   */
  /**
   * An aimed spell, sent to the DM exactly as a weapon attack is. Shared,
   * because a spell can now be cast from the turn as well as from the Spells
   * tab and the two must reach the DM's queue identically.
   */
  /*
   * One claim per creature it caught.
   *
   * Burning Hands catches three goblins and used to arrive as a single row
   * against a single target — the DM resolved it once and applied the other
   * two by hand, or reached for Area damage, which is a different tool for
   * the same fight. One roll of damage, each creature saving for itself, is
   * the rule; so the blast is one decision on the caster's screen and three
   * rows on the DM's, which is what the DM actually has to adjudicate.
   */
  const sendSpell = (c: {
    spell: { name: string };
    targets: readonly { id: string; name: string }[];
    toHit: number | null;
    damage: number;
    damageType: string;
    save?: { ability: string; dc: number; half: boolean };
  }) => {
    if (!mine) return;
    const at = Date.now();
    for (const [i, target] of c.targets.entries()) {
      append({
        type: "attackClaimed",
        claim: {
          id: `sp-${at.toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          who: mine.id,
          whoName: mine.name,
          targetId: target.id,
          targetName: target.name,
          weapon: c.spell.name,
          toHit: c.toHit,
          damage: c.damage,
          damageType: c.damageType,
          ...(c.save ? { save: c.save } : {}),
          at,
        },
      });
    }
  };

  const home: TabId =
    state.combat !== null && !twoUp ? "combat" : dmView ? "party" : "sheet";
  const myTags = (mySeatId && state.combat?.tags[mySeatId]) || [];

  // A seat change can also leave you on a tab the other side does not have.
  const current = tab !== null && tabs.some((t) => t.id === tab) ? tab : home;
  /* Said once, because the bar and the padding that makes room for it must
     never disagree — a bar with no gap under it covers the last control on
     the page, and a gap with no bar is a hole. */
  const showTurnBar =
    seat.kind === "player" &&
    myTurn &&
    /* Not on the fight: the whole turn is already on screen there, and a
       second copy is a door into a room you are standing in. */
    current !== "combat" &&
    !needsCharacter &&
    !needsClaim &&
    mine !== undefined;

  // A fresh device defaults to the DM's seat, which is right when it is alone
  // and wrong the instant it joins someone else's room. Move it off rather
  // than merely hiding the option — otherwise a player who never touches the
  // selector spends the session looking at the DM's screen.
  /**
   * A fight starting moves everyone to it. This is the "combat focus mode"
   * the players' side was always meant to have — on the transition only, so
   * it happens once per fight rather than fighting you for the screen.
   */
  /*
   * The place the DM last opened — device-local, and deliberately never an
   * event. Its note is the one part of a scene written FOR the DM, and a
   * player's log is the last place it belongs.
   */
  const [liveScene, setLiveScene] = useState<string | null>(null);
  const said = liveScene ? state.scenes[liveScene]?.note : undefined;

  const inFight = state.combat !== null;

  /*
   * Four megabytes of spellbook, fetched while people are still typing their
   * initiative rolls.
   *
   * The file is needed the instant a spell is pointed at something — the
   * casting time, whether the caster rolls or the target saves, the dice at
   * this level — and until it lands the aim screen can only say "looking up
   * what it does". The old trigger was the fight's ACTIVE phase, because
   * that is when the turn panel mounts; a fight is staged a good minute
   * before that, and nothing is happening on the wire in between.
   *
   * Cheap to be wrong: the loader memoises per device, so a fight that never
   * produces a cast has spent a fetch that the Spells tab would have made
   * anyway, and one that does starts the turn with the book already there.
   */
  useEffect(() => {
    if (!inFight || !casts) return;
    void loadSpells().catch(() => {});
  }, [inFight, casts]);

  const wasFighting = useRef(inFight);
  useEffect(() => {
    // Nothing to move to when the fight is already pinned beside you.
    if (inFight && !wasFighting.current && !twoUp) setTab("combat");
    wasFighting.current = inFight;
  }, [inFight, twoUp]);

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
    /*
     * Whether to sit in it.
     *
     * Making a character means sitting in it, which is right and was the only
     * behaviour. Loading a sample PARTY is not making two characters — it is
     * putting a table on the screen — and seating the device in whoever
     * happened to be loaded last is nobody's intention.
     */
    sit = true,
  ) {
    /*
     * A re-roll rather than a new character. The base AND the deltas are
     * replaced: the builder builds at any level, so this is a fresh
     * character at the level they had reached, and a delta naming a class
     * they no longer have would replay into nonsense.
     *
     * Everything that is not the build survives — hit points, inventory,
     * conditions, notes — because it lives under the same id in campaign
     * state. It changes who they are on paper, not that they are standing
     * there.
     */
    if (rebuilding) {
      const grant = grantToSpend(state.editAsks, rebuilding);
      if (grant) {
        append({
          type: "characterRebuilt",
          who: rebuilding,
          character: { ...c, base: { ...c.base, id: rebuilding } },
          askId: grant.id,
        });
      }
      setRebuilding(null);
      setBuilding(false);
      return;
    }
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
    if (dmRole !== true) {
      if (sit) claim(c.base.id);
      else claimOnly(c.base.id);
    }
  }

  if (!ready) return <div className="app"><p className="faint">Loading…</p></div>;

  return (
    /*
     * The DM gets more of the screen than a player does.
     *
     * The pinned column was drawn for a player glancing at the order while
     * they read their sheet. A DM is not glancing: the fight IS their work
     * surface, and it now carries a whole statblock. Most DMs run this from a
     * laptop or a propped-up tablet, so the room is there — it was just being
     * spent on the wrong side.
     */
    <div
      className={`app${twoUp ? " two" : ""}${twoUp && dmView ? " dm" : ""}${
        showTurnBar ? " has-turnbar" : ""
      }`}
    >
      <UpdateBar />
      {/* Said once, for a screen reader: see the h1 rule in app.css. */}
      <h1>Table Companion</h1>
      <RoomBar room={room} onJoin={joinRoom} />

      {/*
        * One row of chrome, not three.
        *
        * The room bar, the app's own name with two buttons beside it, and the
        * seat picker were three stacked bars — three hundred and thirty
        * pixels before the tabs, on a phone, on every screen. The fight
        * started below the fold on the device it is most often read from, and
        * everything in those bars except the seat and the code is pressed
        * about twice a session.
        *
        * So: who you are, the code that is read aloud, and a dot for the
        * connection. The room's own controls and this device's are two
        * sheets, split by what they act on rather than by what fits.
        */}
      {(room || builds.length > 0) && (
        <div className="seatbar">
          {needsClaim ? (
            <span className="label">Joining the table</span>
          ) : builds.length > 0 ? (
            <>
              {/* Associated, not merely adjacent — a label beside a control
                  is a label only to somebody who can see them together. */}
              <label className="label" htmlFor="seat-pick">I am</label>
              <select
                id="seat-pick"
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
          ) : null}
          {adding && <button onClick={() => setAdding(false)}>Cancel</button>}

          <span className="sb-end">
            {room && (
              <>
                {/* Read aloud, never pressed. It stays on screen because a
                    table that cannot find the code cannot start. */}
                <span className="rb-code num" title="Read this out to join">{room.code}</span>
                {/* The connection, as a dot with the words on it: three
                    states, and only one of them is worth a sentence. */}
                <span
                  className={`rb-dot s-${status}`}
                  title={STATUS_SAID[status]}
                  aria-label={STATUS_SAID[status]}
                  role="img"
                />
                {/* "The table", not "the room": the room is where the fight
                    is happening, it is named that on this very screen, and two
                    controls answering to one name is an ambiguity for anything
                    driving by name — a browser suite or a screen reader. */}
                <button className="sb-i" aria-label="The table" onClick={() => setRoomOpen(true)}>
                  <span aria-hidden="true">{"\u2699"}</span>
                </button>
              </>
            )}
            <button className="sb-i" aria-label="This device" onClick={() => setDeviceOpen(true)}>
              <span aria-hidden="true">{"\u22EF"}</span>
            </button>
          </span>
        </div>
      )}

      {room && (
        <Popover open={roomOpen} title="The table" onClose={() => setRoomOpen(false)}>
          <RoomMenu
            room={room}
            status={status}
            members={members}
            dmRole={dmRole}
            dmKey={dmKey}
            onLeave={leaveRoom}
            onClaim={claimDm}
          />
        </Popover>
      )}

      <Popover open={deviceOpen} title="This device" onClose={() => setDeviceOpen(false)}>
        <div className="rm">
          <p className="rm-said faint note">
            Characters, content and seats live on this device. The log lives in
            the room.
          </p>
          {(builds.length > 0 || dmView) && !adding && (
            <button
              onClick={() => {
                setAdding(true);
                setDeviceOpen(false);
              }}
            >
              Add character
            </button>
          )}
          {builds.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Discard everything on this device?")) reset();
                setDeviceOpen(false);
              }}
            >
              Start over
            </button>
          )}
        </div>
      </Popover>

      {twoUp && (
        <div className="pane-pin">
          <Combat
              state={state}
              seat={seat}
              append={append}
              onCast={sendSpell}
              takeReaction={takingReaction}
              onReactionOpened={() => setTakingReaction(false)}
              log={log}
              revert={revert}
              reverted={reverted}
            />
        </div>
      )}

      {/* The landmark. Five hundred and seventy-two divs and not one <main>:
          a screen reader arriving here had no way to skip the room code, the
          seat selector and the tab bar to reach the thing the page is about.
          Styled by class, so the tag is free. */}
      <main className="pane-main" data-pane={current}>
      {!needsCharacter && !needsClaim && (
        <Tabs tabs={tabs} active={current} onPick={setTab} />
      )}

      {/* Owed NOW, both of them, so they sit above whatever tab you happen to
          be on rather than waiting to be found. */}
      {askingReaction && offeredToMe && (
        <ReactionAsk
          offer={offeredToMe}
          onTake={() => {
            setAnsweredOffer(offerKey);
            setTab("combat");
            setTakingReaction(true);
          }}
          onDecline={() => {
            setAnsweredOffer(offerKey);
            if (mySeatId) append({ type: "reactionDeclined", combatantId: mySeatId });
          }}
        />
      )}
      {mine &&
        state.checks
          .filter((c) => c.who.includes(mine.id))
          .map((c) => (
            <AnswerCheck key={c.id} check={c} build={mine} append={append}
              {...(state.combat ? { scene: state.combat.scene } : {})} />
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
              <p className="faint note">
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
              <p className="faint note">
                Turning up mid-campaign is normal. Build one at whatever level
                the party is, or bring one in below.
              </p>
            </div>
          </section>

          <NewCharacter onCreate={create} />
        </>
      )}

      {/*
        * Keyed on the tab, so a crash is contained to the screen that caused
        * it and switching away clears it. Everything above this line — the
        * seat, the tabs, a check you owe right now — keeps working.
        */}
      <Boundary key={current} what={TAB_NAME[current]}>
      {needsCharacter ? (
        building ? (
          <CreateCharacter
            onCreate={create}
            /* A re-roll is a fresh character at the level they REACHED. The
               form defaults to 1, which made the first rebuild a level 1
               wizard with eight hit points. */
            startLevel={rebuilding ? (state.builds[rebuilding]?.totalLevel ?? 1) : 1}
            rebuilding={rebuilding !== null}
            onCancel={() => { setBuilding(false); setRebuilding(null); }}
          />
        ) : (
          <>
            <section className="card">
              <div className="card-hd">
                <span className="label">Session zero</span>
                <button onClick={() => setBuilding(true)}>Build a character</button>
              </div>
              <div className="card-body">
                <p className="faint note">
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
          {/* The line the DM meant to read, following them out of prep and
              into whatever tab opening the place threw them at. */}
          {dmView && said && (
            <p className="sc-said">
              {said}
              <button aria-label="Said it" onClick={() => setLiveScene(null)}>Said it</button>
            </p>
          )}
          {/* The fight is always the first tab, on both sides. */}
          {current === "combat" && (
            <Combat
              state={state}
              seat={seat}
              append={append}
              onCast={sendSpell}
              takeReaction={takingReaction}
              onReactionOpened={() => setTakingReaction(false)}
              log={log}
              revert={revert}
              reverted={reverted}
              buzz={
                <Buzz
                  characters={myCharacters}
                  {...(room ? { room: room.code } : {})}
                  onWatch={(sub) => watch(sub, myCharacters)}
                  onUnwatch={unwatch}
                />
              }
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
                          <p className="faint note">
                            Nobody yet. Make one here or bring one in — or leave
                            it and prep the session under Prep.
                          </p>
                        </div>
                      </section>
                      <NewCharacter onCreate={create} />
                    </>
                  )}
                  {/* What is waiting on the DM to answer. Above the party,
                      because it is a question somebody asked. */}
                  <EditAsks asks={state.editAsks} append={append} />
                  <Party state={state} seat={seat} append={append} />
                  <AskCheck state={state} append={append} />
                  <Progression state={state} append={append} />
                </>
              )}

              {current === "prep" && (
                <>
                  {/*
                    * Ordered by what a DM comes here to DO, which is the same
                    * rule the fight screen now follows.
                    *
                    * Places led it — the tallest card on the screen and the
                    * one that does the least, a description with nothing on
                    * the other end of it. Prep between sessions is: build the
                    * fight, decide who is in it, invent what the books do not
                    * have. Somewhere to put it is the last of those, so it is
                    * last.
                    */}
                  <EncounterBuilder state={state} append={append} />
                  <Npcs state={state} append={append} />
                  <Homebrew state={state} append={append} />
                  <Scenes state={state} append={append} onOpened={setLiveScene} />
                </>
              )}

              {current === "book" && (
                <>
                  <Reference homebrew={state.homebrew} />
                  {/* A player casts Hold Person and the table looks at the
                      DM — who had the whole bestiary and not one spell. */}
                  <SpellLookup />
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
                    state={mineState}
                    owed={levelsOwed(state, mine.id)}
                    append={append}
                  />
                  <Sheet build={mine} state={mineState} campaign={state} append={append} />
                  {/*
                    * Under the sheet, not on it. Re-rolling is a rare, whole
                    * conversation with the DM, and a button for it beside the
                    * hit points is a button somebody presses by accident on
                    * the evening they meant to press Heal.
                    */}
                  <AskToRebuild
                    who={mine.id}
                    name={mine.name}
                    asks={state.editAsks}
                    append={append}
                    onRebuild={() => { setRebuilding(mine.id); setBuilding(true); }}
                  />
                </>
              )}

              {current === "notes" && (
                <Notes
                  who={mine.id}
                  name={mine.name}
                  text={state.notes[mine.id] ?? ""}
                  append={append}
                />
              )}

              {current === "spells" && (
                <Spells
                  build={mine}
                  state={mineState}
                  append={append}
                  combat={state.combat}
                  {...(state.combat
                    ? {
                        stanceAt: (target: Combatant) =>
                          stanceFor({
                            attacker: {
                              name: "you",
                              conditions: mineState.conditions,
                              tags: myTags,
                              senses: mine.senses,
                            },
                            target: {
                              name: target.name,
                              conditions: state.combat?.creatureConditions[target.id] ?? [],
                              tags: state.combat?.tags[target.id] ?? [],
                            },
                            // A spell is thrown across the room, so a prone
                            // target is harder to hit rather than easier.
                            range: "ranged",
                          }),
                      }
                    : {})}
                  onCast={sendSpell}
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
                  <Gear build={mine} state={mineState} homebrew={state.homebrewItems} append={append} />
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
                  <p className="faint note">
                    That seat has no character on this device yet.
                  </p>
                </div>
              </section>
            )
          )}
        </>
      )}

      {/* What is waiting on you, before what happened — VISION law 7. */}
      {current === "log" && !needsCharacter && (
        <WhatNext
          log={log}
          state={state}
          reverted={reverted}
          seat={seat}
          reachable={reachable}
          onGo={setTab}
        />
      )}

      {current === "log" && !needsCharacter && (
        <Recap log={log} builds={state.builds} reverted={reverted} seat={seat} />
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
      </Boundary>
      </main>

      {/*
        * Your turn, reachable from wherever you are looking. Only off the
        * fight — on it the whole turn is already on screen, and a second copy
        * would be a door into a room you are standing in.
        */}
      {showTurnBar && mine && (
        <TurnBar
          who={mine.id}
          selfId={mySeatId}
          actionSpent={Boolean(state.characters[mine.id]?.economy.action)}
          dodging={myTags.includes("dodging")}
          onGo={(t) => setTab(t)}
          append={append}
        />
      )}
    </div>
  );
}
