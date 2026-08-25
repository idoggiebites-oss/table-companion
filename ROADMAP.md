# Where this stands

The build plan ran to Phase 5 and then stopped, and the twelve days since
have been driven by whatever surfaced. This file replaces it. It is the one
place to look for what exists, what is next, and what was parked on purpose.

Kept current with the work — if a commit changes what is true here, it changes
this file too.

What the app is *for*, broken into twelve modules, is in
[MODULES.md](MODULES.md). Everything below is ordered by which module it
strengthens rather than by what surfaced most recently.

---

## Built

**The room.** One device starts it, others join with a six-character code.
Live sync, works offline and catches up. Every action is an event; anything
can be undone. Device-local content and seats never enter the log.

**The DM.** Places prepared ahead of the session — a room, whatever is
waiting in it, and the line to read when the door opens — opened live in one
press. Terrain and light on the fight, which every roll then accounts for.
Encounter staging, initiative, turn order, damage and healing,
area damage, opportunity attacks, creature conditions, reaction offers,
contested shoves. The disclosure ladder (hidden / present / vague / exact) per
creature. A claim queue: players send rolls, the DM confirms. NPCs, homebrew
statblocks, saved encounters, rules and monster reference. XP or milestone
levels, loot, coin, a shop. Skill checks and saves asked of named players.

**Between sessions.** A recap: the log read forwards rather than backwards —
where the party fought, how many fights, who hit the floor, the hardest hit
of the night, what it earned. Sessions are split on a six-hour gap, because
there is no button to forget to press.

**The player.** Character building from level 1 or mid-campaign at any level,
with class, race, background, abilities, skills, subclass, spells, feats and
starting equipment — each choice showing its consequence. Sheet: HP, hit dice,
rests, death saves, conditions, concentration, slots, resources, features,
inventory, equipment, coin. Turn walkthrough for all twelve actions, with
advantage/disadvantage computed and explained. Casting inside the turn.

**Shape.** Phone-first, with a wide layout that pins the fight beside the tabs
on tablets and desktops. A crash is contained to its tab and reports itself.
The full 5e compendium ships with the app.

**Proof.** 695 unit tests, 47 browser suites, ~864 assertions, run against a
real build on two devices.

---

## Next

The builder module is done bar its export, which is parked. What is left is
spread across the other modules.

1. **A player's device pulls 6MB of `class.json` on load.** *Content.*
   Measured, not guessed: the sheet's feature list merges the shipped classes
   into the per-level table to pick up subclass feature NAMES, and pays six
   megabytes for a list of strings. The fix is a slimmer shipped file built
   alongside the others — names and levels — rather than skipping the fetch,
   which would quietly drop a cleric's domain features off their sheet.
   `item.json` is another 2.4MB on the same load, for the same reason.
2. **The recap reports; it does not prompt.** *Guidance.* It says what
   happened. Nothing says "here is what changed on your sheet", and nothing
   is offered to the DM about what to prepare next — the same question from
   the other side of the screen.

## Done since this list was written

Scenes — prepared places that carry their room, their encounter and the DM's
line, opened in one press. Half damage on a successful save, read off the
spell's own last sentence and carried on the claim. The spellbook fetched
when a fight is staged rather than when somebody is waiting on it — and no
longer fetched at all by a device with no level to spend. Level-up
completeness, identity, languages and tools, feats with their own
choices, racial ability choices, a level-one feat, trait-granted spells,
senses, multiclassing at creation and at the table, spell roles, the homebrew
switch, the monster piles, and the DM's spell lookup.

## Noted, for when combat comes round again

- **The room does not reach checks yet.** `checkEffects` knows that fog hides
  you and wind drowns you out, and the DM's check panel does not ask it. A
  Stealth roll in fog should say so.
- **A hand-typed attack states no reach**, so the room treats it as melee —
  which is why wind does not trouble the sample character's longbow. Correct
  by the app's own rule and still worth a way for a player to say "this one is
  ranged".

- **A save spell aimed at more than one creature is still one claim.** Burning
  Hands catches three goblins and arrives as one row against one target; the
  DM resolves it once and applies the rest by hand, or uses Area damage, which
  takes the whole blast and asks who saved. Two paths to the same fight.

## Known and unfixed

- **Help is untested end to end.** The sample campaign has one character, so
  the browser suite proves the step exists and says "nobody else is in this
  fight" honestly. Needs a two-character fixture.
- **The dev server dies under repeated full-suite runs**, serving the 30MB
  compendium. Suites are re-run against a restarted server; production is
  fine.

---

## The thing this cannot answer

It has never been used at a table. Everything here is built on prediction and
a DM's feedback, which is a deliberate choice — but no amount of scaffolding
tells you which of it survives contact with five people and a bag of dice.
