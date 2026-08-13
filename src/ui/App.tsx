import { useEffect, useState } from "react";
import type { Character } from "../domain/build.js";
import { actorKey } from "../domain/permissions.js";
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
import { Progression } from "./Progression.js";
import { Reference } from "./Reference.js";
import { RoomBar } from "./RoomBar.js";
import { Sheet } from "./Sheet.js";
import { UpdateBar } from "./UpdateBar.js";

export function App() {
  const [seat, setSeat] = useSeat();
  const [showFeed, setShowFeed] = useState(true);
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

  const needsCharacter = builds.length === 0 || adding;

  // A fresh device defaults to the DM's seat, which is right when it is alone
  // and wrong the instant it joins someone else's room. Move it off rather
  // than merely hiding the option — otherwise a player who never touches the
  // selector spends the session looking at the DM's screen.
  useEffect(() => {
    if (mayBeDm || seat.kind !== "dm") return;
    const first = builds[0];
    if (first) setSeat({ kind: "player", characterId: first.id });
  }, [mayBeDm, seat.kind, builds, setSeat]);

  function create(c: Character) {
    append({ type: "characterAdded", character: c });
    setAdding(false);
    setBuilding(false);
    // A device that just made a character is presumably going to play it.
    if (seat.kind === "player" || builds.length === 0) {
      setSeat({ kind: "player", characterId: c.base.id });
    }
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
          {builds.length > 0 && !adding && (
            <button onClick={() => setAdding(true)}>Add character</button>
          )}
          {builds.length > 0 && (
            <button onClick={() => setShowFeed((v) => !v)}>
              {showFeed ? "Hide log" : "Show log"}
            </button>
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
            {builds.map((b) => (
              <option key={b.id} value={`pc:${b.id}`}>{b.name}</option>
            ))}
          </select>
          {adding && <button onClick={() => setAdding(false)}>Cancel</button>}
        </div>
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
          <Combat state={state} seat={seat} append={append} />

          {seat.kind === "dm" ? (
            <>
              <Party state={state} seat={seat} append={append} />
              <Progression state={state} append={append} />
              <EncounterBuilder state={state} append={append} />
              <Homebrew state={state} append={append} />
              <Reference homebrew={state.homebrew} />
            </>
          ) : mine && mineState ? (
            <>
              <LevelUp
                build={mine}
                owed={levelsOwed(state, mine.id)}
                append={append}
              />
              <Sheet build={mine} state={mineState} campaign={state} append={append} />
            </>
          ) : (
            <section className="card">
              <div className="card-body">
                <p className="faint" style={{ margin: 0 }}>
                  That seat has no character on this device yet.
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {builds.length > 0 && showFeed && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Action log</span>
            <span className="label faint">{log.length} events</span>
          </div>
          <div className="card-body">
            <Feed log={log} builds={state.builds} reverted={reverted} onRevert={revert} />
          </div>
        </section>
      )}
    </div>
  );
}
