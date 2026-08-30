/**
 * What a player wrote down.
 *
 * The one thing at a table that has always been on paper, and the one thing
 * nobody can find afterwards. It goes in the log with everything else,
 * because a note that lives on one phone dies with that phone — and because
 * a player who switches devices mid-campaign should not lose the name of the
 * innkeeper they have been chasing for three sessions.
 *
 * Which means it is not secret, and the card says so rather than implying
 * otherwise. Every device replays every event; the DM's screen can read
 * these. Other players' screens cannot — see visibility.ts — and that is the
 * strongest promise the architecture can actually keep. Anything more would
 * be a lie printed above a text box.
 *
 * Saved on purpose rather than as you type: a keystroke is not an event, and
 * a log with four hundred "wrote something down" lines in it is a log nobody
 * reads.
 */

import { useEffect, useState } from "react";
import type { EventBody } from "../domain/events.js";

const LIMIT = 4000;

export function Notes({
  who, name, text, append,
}: {
  who: string;
  name: string;
  /** What is in the log. The draft starts here and returns here on undo. */
  text: string;
  append: (body: EventBody) => void;
}) {
  const [draft, setDraft] = useState(text);
  const [saved, setSaved] = useState(false);

  /*
   * Someone else's device — or an undo — can change this underneath you. Take
   * the new text only when nothing is being typed, so a sync never eats a
   * half-written sentence.
   */
  useEffect(() => {
    setDraft((d) => (d === "" || d === text ? text : d));
  }, [text]);

  const dirty = draft !== text;
  const save = () => {
    if (!dirty) return;
    append({ type: "notesSaved", who, text: draft.slice(0, LIMIT) });
    setSaved(true);
  };

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Notes · {name}</span>
        <span className="label q">
          {dirty ? "unsaved" : saved ? "saved" : `${draft.length}`}
        </span>
      </div>
      <div className="card-body">
        <textarea
          className="nt"
          aria-label="Notes"
          maxLength={LIMIT}
          value={draft}
          placeholder={
            "The innkeeper lied about the cellar.\n"
            + "Ask Bel about the ring.\n"
            + "The ghoul was immune to poison."
          }
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          onBlur={save}
        />
        <div className="row mt-2">
          <button disabled={!dirty} onClick={save}>Save</button>
          {dirty && (
            <button aria-label="Throw away the changes" onClick={() => setDraft(text)}>
              Never mind
            </button>
          )}
          <span className="nt-who">
            Only you and the DM can read these.
          </span>
        </div>
      </div>
    </section>
  );
}
