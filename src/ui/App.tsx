import { useState } from "react";
import type { Character } from "../domain/build.js";
import { useCampaign } from "../store/useCampaign.js";
import { Feed } from "./Feed.js";
import { NewCharacter } from "./NewCharacter.js";
import { Sheet } from "./Sheet.js";
import { UpdateBar } from "./UpdateBar.js";

export function App() {
  const { ready, log, state, append, revert, reset, reverted } = useCampaign();
  const [showFeed, setShowFeed] = useState(true);

  const ids = Object.keys(state.builds);
  const id = ids[0];
  const build = id ? state.builds[id] : undefined;
  const character = id ? state.characters[id] : undefined;

  function create(c: Character) {
    append({ type: "characterAdded", character: c });
  }

  if (!ready) return <div className="app"><p className="faint">Loading…</p></div>;

  return (
    <div className="app">
      <UpdateBar />
      <div className="topbar">
        <h1>Table Companion</h1>
        <div className="row">
          {build && (
            <button onClick={() => setShowFeed((v) => !v)}>
              {showFeed ? "Hide log" : "Show log"}
            </button>
          )}
          {build && (
            <button
              onClick={() => {
                if (confirm("Discard this character and the whole log?")) reset();
              }}
            >
              Start over
            </button>
          )}
        </div>
      </div>

      {!build || !character ? (
        <NewCharacter onCreate={create} />
      ) : (
        <>
          <Sheet build={build} state={character} campaign={state} append={append} />
          {showFeed && (
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
        </>
      )}
    </div>
  );
}
