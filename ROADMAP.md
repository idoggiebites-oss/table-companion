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

The builder module is done bar its export, which is parked. What is left is
spread across the other modules.

1. **Half damage on a successful save.** *Adjudication.* The only place the
   app hands the DM arithmetic it could do itself.
2. **Prefetch the spellbook when a fight starts.** *Spellcasting.* Small.
   Casting happens in the turn now, so the first cast of a session can pause
   while 4MB arrives.
3. **Session recap.** *Guidance.* The log holds everything that happened and
   nothing turns it into something a table can read when they sit back down.
   The only item here that opens a module rather than closing a gap.

## Done since this list was written

Level-up completeness, identity, languages and tools, feats with their own
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

- **The DM's light control.** Bright / dim / dark on the fight, which is the
  point of tracking senses at all. The domain already takes a `Light` and
  works out who suffers — a dwarf reads dim as bright, a drow suffers in
  daylight — and every character carries what they can see. What is missing is
  the DM's switch and putting the light on the combat state so it syncs.

- **Damage is not halved on a successful save.** Sacred Flame hands the DM the
  full roll and they apply what they rule; there is no "half on save" control
  on the claim. A small addition to the queue, and the only place the app
  makes the DM do arithmetic it could do itself.

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
