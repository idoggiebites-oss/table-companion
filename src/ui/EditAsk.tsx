/**
 * "Can I re-roll?" — both halves of it.
 *
 * A character was built once and then only ever added to. A player who put
 * their 15 in the wrong place on their first evening, or whose subclass turned
 * out to be nothing like they expected, was stuck with it — or asking the DM
 * to delete them and start again, which loses everything that happened since.
 *
 * The shape is law two's, the same as an attack: the player claims, the DM
 * confirms. Not because a player would cheat, but because a character that
 * changed without the table noticing is the sort of thing discovered three
 * weeks later in an argument.
 *
 * A grant is spent by using it. Being allowed to rebuild once is a different
 * thing from being allowed to rebuild.
 */

import { useState } from "react";
import type { CharacterId } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import { mayRebuild, pendingFor, type EditAsk as Ask } from "../domain/editask.js";

/** The player's side: ask, wait, and then the door. */
export function AskToRebuild({
  who, name, asks, onRebuild, append,
}: {
  who: CharacterId;
  name: string;
  asks: readonly Ask[];
  /** Opens the builder. Only offered once the DM has said yes. */
  onRebuild: () => void;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");

  const mine = asks.filter((a) => a.who === who);
  const waiting = mine.some((a) => a.granted === undefined);
  const allowed = mayRebuild(asks, who);
  const refused = mine.length > 0 && mine[mine.length - 1]?.granted === false;

  if (allowed) {
    return (
      <div className="ask-edit granted">
        <span className="label">The DM said yes</span>
        <p className="faint">
          Rebuild {name} at the level they have reached. What has happened to
          them — hit points, what they are carrying, their notes — stays.
        </p>
        <button aria-label="Rebuild my character" onClick={onRebuild}>
          Change my character
        </button>
      </div>
    );
  }

  if (waiting) {
    return (
      <p className="ask-edit faint">
        Asked the DM about changing {name}. Nothing happens until they answer.
      </p>
    );
  }

  return (
    <div className="ask-edit">
      {!open ? (
        <button
          aria-label="Ask to change my character"
          onClick={() => setOpen(true)}
        >
          Ask to change {name}
        </button>
      ) : (
        <>
          <span className="label">What would you change?</span>
          <textarea
            aria-label="Why you want to change your character"
            value={why}
            rows={2}
            placeholder="I put my 15 in the wrong place."
            onChange={(e) => setWhy(e.target.value)}
          />
          <p className="faint">
            The DM decides. Saying why is optional — "can I re-roll" is a
            whole sentence.
          </p>
          <div className="row">
            <button
              aria-label="Send the request"
              onClick={() => {
                append({
                  type: "characterEditAsked",
                  who,
                  whoName: name,
                  ...(why.trim() ? { why: why.trim() } : {}),
                });
                setWhy("");
                setOpen(false);
              }}
            >
              Ask
            </button>
            <button onClick={() => setOpen(false)}>Never mind</button>
          </div>
        </>
      )}
      {refused && (
        <p className="faint">
          The DM said no last time. You can ask again — they may have meant
          "not right now".
        </p>
      )}
    </div>
  );
}

/** The DM's side: what is waiting, and the two words that answer it. */
export function EditAsks({
  asks, append,
}: {
  asks: readonly Ask[];
  append: (body: EventBody) => void;
}) {
  const waiting = pendingFor(asks);
  if (waiting.length === 0) return null;
  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Asking to re-roll</span>
      </div>
      <div className="card-body">
        {waiting.map((a) => (
          <div className="ask-row" key={a.id}>
            <span className="nm">{a.whoName}</span>
            {a.why && <span className="faint why">{a.why}</span>}
            <div className="row">
              <button
                aria-label={`Let ${a.whoName} rebuild`}
                onClick={() =>
                  append({ type: "characterEditAnswered", askId: a.id, granted: true })
                }
              >
                Yes
              </button>
              <button
                aria-label={`Refuse ${a.whoName}`}
                onClick={() =>
                  append({ type: "characterEditAnswered", askId: a.id, granted: false })
                }
              >
                Not now
              </button>
            </div>
          </div>
        ))}
        <p className="faint" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
          Yes opens the builder for them once. Everything that has happened to
          the character stays — this changes who they are on paper, not that
          they are standing there.
        </p>
      </div>
    </section>
  );
}
