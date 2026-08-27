/**
 * "Tell me when it's my turn."
 *
 * A companion that has to be watched gets put face-down, and then the table
 * spends its evening saying "it's you" out loud. Three moments earn a buzz —
 * your turn, initiative, a roll the DM asked you for — and nothing else does.
 *
 * One button, because the operating system's permission prompt is a question
 * that cannot be asked twice: a person who taps it by accident and says no
 * has turned the feature off for good on that device. So it says exactly what
 * will happen before it asks, and it is nowhere near a thumb mid-turn.
 *
 * Every reason it might not work is a sentence rather than a disabled
 * control. "Nothing happens and I don't know why" is the worst state a
 * notification setting can be in, and it is the usual one.
 */

import { useEffect, useState } from "react";
import { current, state as pushState, turnOff, turnOn, type PushState } from "../store/push.js";

export function Buzz({
  characters, room, onWatch, onUnwatch,
}: {
  /** Whose turns this device should be told about. */
  characters: readonly string[];
  /** The room code, to carry to a Home Screen app that starts out empty. */
  room?: string | undefined;
  onWatch: (sub: { endpoint: string; p256dh: string; auth: string }) => void;
  onUnwatch: (endpoint: string) => void;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  /*
   * Re-tell the room on every change of who this device holds. A room that
   * has forgotten the subscription is a phone that quietly stops ringing, and
   * that failure looks exactly like a quiet session.
   */
  useEffect(() => {
    if (state !== "on" || characters.length === 0) return;
    void current().then((sub) => {
      if (sub) onWatch(sub);
    });
  }, [state, characters, onWatch]);

  if (state === null || state === "unsupported" || state === "unconfigured") {
    // Nothing to offer: no service worker, or this deployment has no key.
    return null;
  }

  /*
   * The one unsupported case that is not a dead end.
   *
   * Apple gives Web Push to a Home Screen app and not to a Safari tab, so on
   * an iPhone every support check fails and the button simply was not there.
   * A player who has been told the app can buzz then finds nothing, and no
   * amount of looking explains it — which is worse than the feature being
   * missing, because it looks broken rather than absent.
   */
  if (state === "needs-install") {
    return (
      <p className="buzz-no">
        On an iPhone or iPad, only an installed app can buzz — that is Apple's
        rule, not this app's. Tap <b>Share</b>, then <b>Add to Home Screen</b>,
        and open Table Companion from there.
        {room
          ? <> A Home Screen app starts out empty, so join with <b className="num">{room}</b> again
            and claim your character; this setting will be waiting.</>
          : <> A Home Screen app starts out empty, so you will join the room again from there.</>}
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className="buzz-no">
        Notifications are blocked for this site. Your browser's settings can
        turn them back on; the app cannot ask again.
      </p>
    );
  }

  const on = state === "on";
  return (
    <div className="buzz">
      <button
        className={`buzz-go${on ? " on" : ""}`}
        disabled={busy || characters.length === 0}
        aria-pressed={on}
        aria-label={on ? "Stop telling me" : "Tell me when it is my turn"}
        onClick={async () => {
          setBusy(true);
          try {
            if (on) {
              const endpoint = await turnOff();
              if (endpoint) onUnwatch(endpoint);
            } else {
              const sub = await turnOn();
              if (sub) onWatch(sub);
            }
          } finally {
            setState(await pushState());
            setBusy(false);
          }
        }}
      >
        {on ? "Telling you" : "Tell me when it's my turn"}
      </button>
      <span className="buzz-say">
        {characters.length === 0
          ? "Claim a character first — a buzz is addressed to somebody."
          : on
            ? "Your turn, initiative, and rolls the DM asks you for. Nothing else."
            : "This phone will buzz for your turn, for initiative, and when the DM asks you for a roll."}
      </span>
    </div>
  );
}
