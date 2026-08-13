import { useState } from "react";
import type { Character } from "../domain/build.js";
import { actorKey } from "../domain/permissions.js";
import { levelsOwed } from "../domain/project.js";
import { useCampaign } from "../store/useCampaign.js";
import { useSeat } from "../store/useSeat.js";
import { Combat } from "./Combat.js";
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

  // Events are signed by the seat, which is what makes one person editing
  // another's sheet acceptable rather than merely convenient.
  const campaign = useCampaign(actorKey(seat));
  const {
    ready, log, state, append, revert, reset, reverted,
    room, status, members, joinRoom, leaveRoom,
  } = campaign;

  const builds = Object.values(state.builds);
  /** A player sees their own sheet; the DM sees the party instead. */
  const mine =
    seat.kind === "player" ? state.builds[seat.characterId] : undefined;
  const mineState = mine ? state.characters[mine.id] : undefined;

  const needsCharacter = builds.length === 0 || adding;

  function create(c: Character) {
    append({ type: "characterAdded", character: c });
    setAdding(false);
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
        onJoin={joinRoom}
        onLeave={leaveRoom}
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
            <option value="dm">the DM</option>
            {builds.map((b) => (
              <option key={b.id} value={`pc:${b.id}`}>{b.name}</option>
            ))}
          </select>
          {adding && <button onClick={() => setAdding(false)}>Cancel</button>}
        </div>
      )}

      {needsCharacter ? (
        <NewCharacter onCreate={create} />
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
