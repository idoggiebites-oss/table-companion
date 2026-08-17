/**
 * A reaction, on whatever screen you happen to be on.
 *
 * This was the app's most time-critical prompt and it had the weakest signal
 * of anything urgent: it lived inside the fight and carried no dot, so a
 * player looking at their gear when the DM offered one saw nothing at all,
 * while five people waited.
 *
 * The ladder was upside down. A check the DM asks for renders above the tabs.
 * A concentration save gets a dot and moves you. A reaction — the only one
 * with a table actually stopped on it — was tab-local. So it sits here now,
 * beside the check, for the same reason: it is owed NOW.
 *
 * Saying yes takes you to the fight, where the swing is walked through. That
 * navigation is the point rather than a cost — the answer is a real attack
 * roll, and the walkthrough for it already exists.
 */

import type { ReactionOffer } from "../domain/combat.js";

export function ReactionAsk({
  offer, onTake, onDecline,
}: {
  offer: ReactionOffer;
  onTake: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="react-ask">
      <span className="label">{offer.because}</span>
      <p className="swing-ask">
        {offer.from} — this is your reaction, if you want it.
      </p>
      <div className="row">
        <button onClick={onTake}>Take a swing</button>
        <button onClick={onDecline}>Let it go</button>
      </div>
    </section>
  );
}
