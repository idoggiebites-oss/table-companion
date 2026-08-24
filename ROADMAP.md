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

Judged as a character builder rather than as a session companion — a
different bar, and the gaps are not where this list used to say they were.
Ordered by how many characters meet them.

1. **Level-up barely levels you up.** *Creation & Progression.* It asks for
   hit points and an improvement and stops. It never asks for a **subclass at
   3** — build at 1, level to 3, and nothing prompts you. It does not say
   which **spells** you learn or name the **features** you gained. Every
   character meets this.
2. **Multiclassing at creation.** *Creation & Progression.* Done at the
   table — a level can be taken in a new class, with prerequisites enforced,
   hit dice pooled and slots from the multiclass caster table. What remains is
   BUILDING one from scratch: the builder still starts you in one class.
3. **You cannot get the character out.** *Creation & Progression.* Import
   exists; export does not. No printable sheet, no file, no link.
4. **Trait-granted spells go nowhere.** *Spellcasting.* A Drow's Faerie Fire,
   a Tiefling's Thaumaturgy — the trait is shown, the spell never reaches the
   spell list.
7. **Nothing about who the character is.** *Guidance.* No alignment, ideals,
   bonds, flaws, appearance or backstory. Mechanically irrelevant, and the
   part that makes a build somebody's character rather than a stat block.
8. **Prefetch the spellbook when a fight starts.** *Spellcasting.* Small.
   Casting moved into the turn, so the first cast of a session can pause while
   4MB arrives.
9. **Session recap.** *Guidance.* The only item here that opens a module
   rather than closing a gap in one.

## Parked, on purpose

- **Reach, range and cover.** Needs positions, and the positions are on the
  table. The DM says these out loud; the app states what it can see and never
  contradicts them.
- **Rolling dice.** It asks for the number. This is the point, not a gap.
- **Fillable-PDF and D&D Beyond import.** Fight Club XML is in; the others are
  adapters with no demand behind them yet.
- **A passphrase on the deployment.** Built, reverted, left dormant — the site
  does not need to be private.

## Noted, for when combat comes round again

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
