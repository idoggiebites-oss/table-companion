# Where this stands

The build plan ran to Phase 5 and then stopped, and the twelve days since
have been driven by whatever surfaced. This file replaces it. It is the one
place to look for what exists, what is next, and what was parked on purpose.

Kept current with the work — if a commit changes what is true here, it changes
this file too.

What the app is *for*, broken into twelve modules, is in
[MODULES.md](MODULES.md). Why it is for that — the rules that settle what to
build and what to refuse — is in [VISION.md](VISION.md). Everything below is
ordered by which module it strengthens rather than by what surfaced most
recently.

---

## Built

**The room.** One device starts it, others join with a six-character code.
Live sync, works offline and catches up. Every action is an event; anything
can be undone. Device-local content and seats never enter the log.

**Notifications.** Three moments buzz a phone: your turn, initiative, and a
roll the DM asked you for. Nothing else — a notification that arrives when
nothing is being asked of you teaches people to swipe them away. Web Push,
written against the standards rather than a library, so the key stays in a
secret and the payload is unreadable to the push service carrying it. Off
until asked for, and every reason it might not work is a sentence.

**Combat.** Whose turn it is said in words with the next name beside it, the
round and turn counted, and one primary control that names who it hands to.
Damage and healing on the creature's own row. Reinforcements: something walks
in on round three at its own initiative without restaging the fight.
Duplicates numbered so two ghouls are two creatures. Conditions in a sheet
that does not shove the initiative order down the screen. And for a player
between fights — most of a session — what they would bring to one.

**The DM.** Places prepared ahead of the session — a room, whatever is
waiting in it, and the line to read when the door opens — opened live in one
press. Terrain and light on the fight, which every roll then accounts for.
Encounter staging, initiative, turn order, damage and healing,
area damage, opportunity attacks, creature conditions, reaction offers,
contested shoves. The disclosure ladder (hidden / present / vague / exact) per
creature. A claim queue: players send rolls, the DM confirms. NPCs, homebrew
statblocks, saved encounters, rules and monster reference. XP or milestone
levels, loot, coin, a shop. Skill checks and saves asked of named players.

**What a device pulls.** A player's load is 3.1MB of content, about 0.3MB
over the wire: the classes ship twice, once whole for the builder and once
slimmed to names and levels for the sheet. The spellbook arrives when a fight
is staged, and only on a caster's device.

**Between sessions.** A recap: the log read forwards rather than backwards —
where the party fought, how many fights, who hit the floor, the hardest hit
of the night, what it earned. Sessions are split on a six-hour gap, because
there is no button to forget to press.

**The player's own screen.** A panel rather than a document: vitals, a figure
showing what is worn and wielded in six slots, what is left to spend, and
three buttons that carry their own answer — skills, saves and features open
over the panel instead of being scrolled past. Spells are a grid where the
cost is on the tile and what cannot be paid for is dimmed rather than hidden.
The turn carries what is in your hands and what can be cast right now, both
of which used to be two tabs away. And a notes tab: in the log, so it
survives a lost phone, and honest about the DM being able to read it.

**Provenance.** A complete compendium offers a ranger sixty-three archetypes;
eight are the game's own. The rest sit behind the compendium switch, and the
official ones are grouped by the book that printed them — subclasses, races,
backgrounds, feats and fighting styles alike — in publication order, with
anything from outside those nineteen books kept last under "elsewhere". The
compendium does not carry which book anything came from; that table is
`books.ts`, 2014 rules only, 433 entries.

**The player.** Character building from level 1 or mid-campaign at any level,
with class, race, background, abilities, skills, subclass, spells, feats and
starting equipment — each choice showing its consequence. Sheet: HP, hit dice,
rests, death saves, conditions, concentration, slots, resources, features,
inventory, equipment, coin. Turn walkthrough for all twelve actions, with
advantage/disadvantage computed and explained. Casting inside the turn.

**Shape.** Phone-first, with a wide layout that pins the fight beside the tabs
on tablets and desktops. A crash is contained to its tab and reports itself.
The full 5e compendium ships with the app.

**Proof.** 853 unit tests, 63 browser suites, ~1,090 assertions, run against a
real build on two devices — including the push path end to end, decrypted at
the far end with the key a browser would have used.

---

## Next

The builder module is done bar its export, which is parked. What is left is
spread across the other modules.

1. **The recap reports; it does not prompt.** *Guidance.* It says what
   happened. Nothing says "here is what changed on your sheet", and nothing
   is offered to the DM about what to prepare next — the same question from
   the other side of the screen.

## Done since this list was written

**A creature has an action economy.** Players have had one since the beginning
and creatures had a single boolean for the reaction, so a DM running six
goblins tracked "has that one used its bonus action" in their head, six times a
round.

**Legendary actions and lair actions.** 702 shipped creatures have legendary
actions and the app tracked none of it. They sit on screen during OTHER
creatures' turns — which is when they are available — with the budget, each
option's cost, and the two rules people get wrong: not on their own turn, and
back at the start of it. A lair action belongs to the place, fires on its own
count, and is once a round.


**A breath weapon is not an attack roll.** Tapping a monster's action opened
the swing walkthrough whatever the action was, and four thousand of the twenty
thousand actions in the compendium ask for a saving throw instead. A save now
opens the tool that asks the right question — who was caught, and who made it
— pre-filled with the DC, the ability, the dice and what a success costs, all
read off the creature's own words. Where the line falls is still the table's.

**A subclass is a readable list, not a dropdown of names.** All 454 official
options carry a description and the builder showed it only AFTER you committed,
so comparing nine barbarian paths meant nine round trips.

**Boxes say what they are.** A placeholder disappears the moment somebody
types, so every form read clearly while empty and became a column of anonymous
boxes once filled.


**Who they are, then what they can do.** The builder asked for skills second —
before a race, a background or a single ability score existed — so the table it
draws showed every total as the bare proficiency bonus, and it asked about
skills twice over, since a background grants two and some races grant one. The
order is now class, race, story, scores, skills.


**"Can I re-roll?"** A character was built once and then only ever added to;
a player who put their 15 in the wrong place on their first evening was stuck
with it. It is law two's shape — the player asks, the DM answers — and a grant
is spent by using it. The rebuild replaces the build at the level they had
reached and keeps everything that is not the build: hit points, what they are
carrying, their notes. The wound comes with them rather than being healed by
paperwork.


**The homebrew tool makes things, not only creatures.** A magic sword used to
live in somebody's notes: it could not be carried, equipped, swung, priced or
sold, and the app had no idea it was a weapon. Homebrew items are produced in
the same shape the catalogue produces, so every rule that reads an item reads
these — the attack path, the armour-class derivation with its dexterity cap,
the hands rule, the shop shelf and press-and-hold all work without being told
homebrew exists. The form's read-back panel is built by the same function that
saves, because a preview assembled separately drifts.


**A shopkeeper can run out.** The stock entry has carried a quantity since it
was written and the buy path already decremented the shelf; the setup form
asked a price and hardcoded an endless supply.

**Both hands means both hands.** The versatile die was printed as a note and
never rolled. Both grips are attack rows now, a shield rules the second one
out, and a two-handed weapon takes the hand it needs — the app was handing out
+2 armour class for a hand that was holding a bow.

**Popover.** The sheet-under-the-thumb the conditions picker had, now a
component: Escape, a reachable scrim, and a centred width on desktop.
Everything else opened its chooser inside the page and pushed what you were
reading down half a screen.

**Press and hold to find out what something is.** Spells show the compendium's
own words; items show what the app knows and say why, since not one of the
10,760 items carries a description.


**Help had never once worked.** Being helped and then having your turn deleted
the advantage one instant before it could apply: `advance` cleared every stance
tag on the creature whose turn was opening, and Help times off the HELPER's
next turn, not the helped one's. Nothing noticed because the sample table had
one person in it, so the only reachable outcome was "nobody else is in this
fight". There is an ally to load now — a separate press, because "load the
sample" means one known character on twenty screens — and `verify-help` walks
the whole chain including the expiry.

**The room reaches checks.** `checkEffects` had known since it was written that
fog hides you and wind drowns you out, and neither check panel asked it. Both
do now, and both name the reason rather than only applying it.

**A hand-typed attack can say it is ranged**, so wind troubles an arrow and a
prone target is harder to hit from across the room.

**A blast is one decision and several claims.** Burning Hands caught three
goblins and arrived as one row; one roll of damage with each creature saving
for itself is the rule, so the caster picks who else it caught and the DM gets
a row each.

**The 44px rule is checked where it is written.** Two live violations were
sitting outside the three screens the browser suite visits. `check-css` now
reads the stylesheet whole and fails on any `min-height` under 44 without a
stated `tap-ok:` reason.


**Three from Improved Initiative, filtered through the laws.** Identical
creatures roll once — one player and six goblins was seven prompts and is now
two, splittable in one press. A creature can be renamed to what the table
calls it, through the log like anything else. And a turn can be stepped back
where the mis-tap happens: not a new mechanism, the existing undo put on the
screen a DM cannot leave.


**A creature's turn shows the creature.** Staging kept hit points, armour class
and the damaging actions and dropped the rest — twice, at two boundaries.
Across seven common monsters 17 of 57 entries survived; Multiattack is dropped
from nearly every statblock in the game. The fight now looks the statblock up
by id rather than copying it, so a corrected monster corrects a running fight,
and every action naming numbers is a button that loads the swing — it names the
die and holds the modifier, and the number still comes from a person. DM only,
for the same reason the Book tab is.

**The DM's fight gets the screen a DM uses.** The pinned column was sized for a
player glancing at the order while reading their sheet; a DM is not glancing.
Above 1024 the DM's fight takes 430–520px, and above 1500 it goes two-column
with the statblock beside the order.


**Push on iOS says what it needs.** Apple gives Web Push to a Home Screen app
and not to a Safari tab — and this list had the mechanism wrong: it assumed the
button worked and delivery failed silently. It does not. In a tab the API is
not exposed at all, so every support check failed and the control rendered
nothing, which is worse: a player told the app can buzz finds no setting and no
reason. It now says so, names whose rule it is, and carries the room code into
the sentence, because an iOS Home Screen app has its own storage and opens
empty. The check is `!supported() && an uninstalled Apple device`, so if some
future iOS exposes push to tabs the ordinary button comes back on its own.


The player side as a game interface — the panel, the equipment figure, the
spell grid, the turn's own weapons and spells, and notes. The sheet showing
the character's own features rather than every archetype's
— 372 names down to 24 for a Ranger 8. The slim class file: a player's load
went from 8.9MB to 3.1MB, and from
1.8MB to 0.3MB over the wire. Scenes — prepared places that carry their room, their encounter and the DM's
line, opened in one press. Half damage on a successful save, read off the
spell's own last sentence and carried on the claim. The spellbook fetched
when a fight is staged rather than when somebody is waiting on it — and no
longer fetched at all by a device with no level to spend. Level-up
completeness, identity, languages and tools, feats with their own
choices, racial ability choices, a level-one feat, trait-granted spells,
senses, multiclassing at creation and at the table, spell roles, the homebrew
switch, the monster piles, and the DM's spell lookup.

## Measured, and left alone

- **`item.json` is 2.5MB raw and 0.21MB gzipped.** The roadmap called it a
  2.4MB problem, which was the raw number; over the wire it is a fifth of a
  megabyte and about 5ms to parse on a desktop. Loading only the base
  equipment and escalating to the full catalogue when a character carries a
  magic item would save that fifth — and would silently show wrong stats the
  first time the escalation missed. Not worth it at this size. If the
  catalogue doubles, revisit.

## Noted, for when combat comes round again


- **Clean encounter.** Improved Initiative resets for the next fight in one
  press: drop the NPCs, keep the party, clear what was done to them. Scenes
  cover the prepared case and nothing covers the improvised one. Parked
  rather than dropped — the judgement was that Scenes may already be enough,
  and a table would tell us in one session.
- **A note that belongs to a creature.** Theirs survive the encounter; ours
  are per-scene and per-player. Same judgement, same test.


## Asked for, and not yet designed

- **A map screen.** Raised deliberately against law 4, which refuses one. The
  shape asked for is not a battle map: a DM makes *map items* — a custom
  image a player can open, zoom and pan, and pass to another player — as a
  thing the party shares rather than a surface the fight is resolved on. That
  distinction is the whole question, and it is a real one: a hand-drawn map of
  the town, passed round, is a prop. Tokens on a grid is the app becoming what
  everyone looks at.

  What has to be settled before any of it is built: whether creatures ever
  appear on it (law 4 says no), whether the DM can hide parts of it, where the
  image lives given a Worker and a Durable Object with no blob store, and what
  happens on a phone in a cellar with no signal. Not started — see VISION.md,
  which will need amending or explicitly excepting either way.

## Known and unfixed

- **44px is a rule the code keeps forgetting.** Four separate controls have
  shipped too small to press — background chips at 30, feat rows at 39, the
  skills table's tick at 18 (the only way to train a skill), and a creature's
  rename button, which was written with `min-height: 0` in the same commit
  that added it. Each one looked like text rather than a control.
  `verify-guidance` measures three screens and `verify-group` measures the
  fight, but nothing stops a new one being added at 33 somewhere else.

- **The dev server dies under repeated full-suite runs.** Removed from this
  list once on the evidence of a clean 55-suite run; that was wrong. It dies
  reliably when two sweeps overlap, and it died again on a single run of 60 —
  54 of them then reported nothing.

  What made it dangerous was not the crash but the check: a filter looking for
  lines that were NOT "N pass, 0 fail" treats "0 pass, 0 fail" as a pass, so a
  sweep that ran almost nothing read as clean. `scripts/sweep.sh` replaces it —
  it refuses to start without a server, counts a suite that asserted nothing as
  an error, re-checks the server at the end, and exits non-zero. Silence is not
  success.

- **The sheet sits two pixels under the height verify-panel guards.** It was
  2579 and is 2598 against a 2600 ceiling, because it gained a label the boxes
  needed. That is not comfortable: the next addition to the sheet will trip the
  guard, which is exactly what the guard is for, but it means the next person
  to add anything there has to buy the space rather than find it.

- **The builder rail still settles.** With a class and a race chosen, Gear
  reads as done until you visit it, and Race reads as not-done until you leave
  it — both flip once you navigate. The false ticks on a BRAND-NEW build are
  fixed and guarded; this remaining flicker is in how the gear choices and the
  race's own questions are derived, and it needs the derivation read rather
  than the symptom chased.

- **43 browser-suite selectors match more than one component.** `.v` is worn
  by seven, `.swing-ask` by six. Nothing is broken today — the right thing
  happens to render first — but it is why changing one dropdown to a readable
  list cost thirty suite edits, and it is how a suite silently began measuring
  the wrong component after SubclassPick borrowed the feat picker's classes.

  `scripts/check-selectors.mjs` records the 43 and fails on the 44th. The
  baseline is meant to shrink: driving a suite by role and name instead takes
  its line out of the file, and it can never come back unnoticed. This is the
  first thing to attack alongside any UI revision, because a redesign will
  thrash exactly these.

- **`verify-turns`'s race is arranged, not raced for.** The player goes
  offline before pressing, which is what "at the same instant" means in a
  distributed system. Deterministic across repeated runs, but it proves the
  invariant on one interleaving rather than on a real collision.

---

## The thing this cannot answer

It has never been used at a table. Everything here is built on prediction and
a DM's feedback, which is a deliberate choice — but no amount of scaffolding
tells you which of it survives contact with five people and a bag of dice.
