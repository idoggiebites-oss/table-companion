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

**The DM.** Encounter staging, initiative, turn order, damage and healing,
area damage, opportunity attacks, creature conditions, reaction offers,
contested shoves. The disclosure ladder (hidden / present / vague / exact) per
creature. A claim queue: players send rolls, the DM confirms. NPCs, homebrew
statblocks, saved encounters, rules and monster reference. XP or milestone
levels, loot, coin, a shop. Skill checks and saves asked of named players.

**The player.** Character building from level 1 or mid-campaign at any level,
with class, race, background, abilities, skills, subclass, spells, feats and
starting equipment — each choice showing its consequence. Sheet: HP, hit dice,
rests, death saves, conditions, concentration, slots, resources, features,
inventory, equipment, coin. Turn walkthrough for all twelve actions, with
advantage/disadvantage computed and explained. Casting inside the turn.

**Shape.** Phone-first, with a wide layout that pins the fight beside the tabs
on tablets and desktops. A crash is contained to its tab and reports itself.
The full 5e compendium ships with the app.

**Proof.** 521 unit tests, 33 browser suites, ~646 assertions, run against a
real build on two devices.

---

## Next

Proposed order, not decided — reorder freely.

1. **Languages and tool proficiencies in the builder.**
   *Creation & Progression.* Parsed out of the compendium already and then
   dropped on the floor. The only outright gap left in a character sheet.
2. **Prefetch the spellbook when a fight starts.**
   *Spellcasting.* Small. Casting moved into the turn, so the first cast of a
   session can pause while 4MB arrives — at the worst possible moment.
3. **Session recap.**
   *Guidance.* The log holds everything that happened and nothing turns it
   into something a table can read when they sit back down. This is the only
   item that opens a module rather than closing a gap in one.
4. **Multiclassing.**
   *Creation & Progression.* The builder edits one class; an imported
   multiclass character survives but cannot be built or levelled as one.
5. **Feats that carry their own choice.**
   *Creation & Progression.* Resilient picks a save, half-feats grant +1
   somewhere. Recorded by name today.

## Parked, on purpose

- **Reach, range and cover.** Needs positions, and the positions are on the
  table. The DM says these out loud; the app states what it can see and never
  contradicts them.
- **Rolling dice.** It asks for the number. This is the point, not a gap.
- **Fillable-PDF and D&D Beyond import.** Fight Club XML is in; the others are
  adapters with no demand behind them yet.
- **A passphrase on the deployment.** Built, reverted, left dormant — the site
  does not need to be private.

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
