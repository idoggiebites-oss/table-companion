# The project, in modules

Not a code layout — a breakdown of what this tool is *for*, so that "what
should we build next" becomes "which of these is weakest."

Every module names the person it serves and the job it does for them. Where a
module has two faces, that is the point rather than a split: a fight is one
act that two people are inside of.

Each is marked:

- **Solid** — does its job; work here is polish.
- **Working** — does its job with a named gap.
- **Thin** — exists, but a table would notice what is missing.

---

# I. The spine

Three modules nobody asks for by name. When they work, nobody mentions them.

## 1. The Table — *both* · **Solid**

One shared truth. A room joined by a six-character code, every action an
event, every event undoable, the same state on every device. Offline and
catches up. A crash is contained to its tab and reports itself rather than
going black.

`project.ts` `events.ts` `useCampaign.ts` `log.ts` `worker/` `Boundary.tsx`
· suites: `room` `modes` `pwa` `sides`

**Weakest point:** nothing known. This is the most tested part of the app.

## 2. Disclosure — *DM* · **Solid**

Who may see what, and who may do what. Four levels per creature — hidden,
present, vague, exact — orthogonal to who controls it. The DM's prep never
reaches a player's log; a player cannot undo somebody else's action.

`visibility.ts` `permissions.ts` `combat.ts` · suites: `sides` `seat` `turns`

**Weakest point:** conditions on a creature are shown to everyone. That is
deliberate — the table watches the goblin fall over — but a DM may want to
hide one.

## 3. Content — *both* · **Working**

The whole 5e compendium, shipped with the app: spells, feats, races, classes,
backgrounds, items, monsters. Imports merge field-by-field so a thinner file
cannot delete what a richer one knew. Two thirds of a complete compendium is
homebrew, so the game's own material sorts first everywhere it is listed.

`compendium.ts` `content.ts` `bundled.ts` `srd.ts` `marks.ts` `non-srd.ts`
· suites: `compendium` `import` `shipped` `builder-content`

**Weakest point:** provenance ordering has now been fixed twice, in two
places, after the same bug. Any *new* list drawn from the compendium will have
it a third time unless it is written against `marks.ts` from the start.

---

# II. The fight

One act, two faces, and the seam between them is where this tool earns its
place.

## 4. The Encounter — *DM* · **Solid**

Staging, initiative collected from everyone at once, turn order, rounds,
surprise, creature health, area damage, opportunity attacks, NPC turns, and
conditions on creatures.

`combat.ts` `encounter.ts` `statblock.ts` `Combat.tsx` `Conditions.tsx`
· suites: `turns` `fight` `encounter` `area` `stance`

## 5. The Turn — *player* · **Solid**

What you can do right now and what it costs. Twelve actions with consequences
rather than names, movement, the action economy enforced, attack and cast
walked through one question at a time, reactions that arrive on whatever
screen you are on.

`actions.ts` `attack.ts` `stance.ts` `PlayerTurn.tsx` `Swing.tsx`
`AimSpell.tsx` `ReactionAsk.tsx` · suites: `attacks` `stance` `guide` `fight`

**Weakest point:** Help is untested against a real ally — the sample campaign
has one character.

## 6. Adjudication — *both* · **Solid**

The rule that nothing is applied by one person to another. Players claim,
the DM confirms. The app works out hit-or-miss against armour class and says
so; the call stays with the DM. Skill checks and saves asked of named players.
Contested shoves carried across when only half the contest is knowable.

`attackflow.ts` `checks.ts` `roll.ts` `AskCheck.tsx` `AnswerCheck.tsx`
· suites: `fight` `roll` `table` `stance`

---

# III. The character

## 7. Creation & Progression — *player* · **Solid**

Class first, then race, background, abilities, skills, subclass, spells, feats
and equipment — at level 1 or joining mid-campaign at any level, with
improvements already earned taken at the table. Levelling with hit dice, ASI
or feat, and subclass choices read out of the compendium.

`creation.ts` `build.ts` `progression.ts` `subclass.ts` `feats.ts`
`classes-from-compendium.ts` `CreateCharacter.tsx` `LevelUp.tsx` `FeatPick.tsx`
· suites: `creation` `level` `progression` `feats` `builder-content`

**Weakest point:** nothing mechanical. Everything a character has is asked
for — languages, tools, feats and their own choices, subclasses, racial
ability choices, a level-one feat, trait-granted spells, senses, identity, and
multiclassing at creation as well as at the table. What is missing is a way to
get the character back OUT: no printable sheet, no file, no link. That is
parked with the decision open rather than forgotten.

## 8. The Sheet — *player* · **Solid**

Everything true about your character between turns: hit points, temporary hit
points, hit dice, short and long rests, death saves, conditions, exhaustion,
inspiration, concentration and the saves it owes, class resources, boons.

`project.ts` `rest.ts` `resources.ts` `concentration.ts` `boons.ts`
`Sheet.tsx` `StateCard.tsx` · suites: `table` `conc` `progression`

## 9. Gear & Economy — *player, DM opens the shop* · **Solid**

Inventory, equipping, and the consequences of it — armour class and available
attacks derived from what is actually worn. Coins, loot, stashes, and a trader
the DM opens and closes.

`items.ts` `equipment.ts` `money.ts` `starting-gear.ts` `Gear.tsx`
`Inventory.tsx` `Shop.tsx` · suites: `items` `gear`

## 10. Spellcasting — *player* · **Working**

Known and prepared spells, slots, upcasting in the open, concentration
displacement, cantrips scaling by caster and levelled spells by slot. Cast
from the turn during a fight or from the Spells tab outside one — one set of
rules behind both.

`spells.ts` `spellcast.ts` `useCasting.ts` `Spells.tsx` `SpellPick.tsx`
· suites: `spells` `conc`

**Weakest point:** the spellbook is 4MB and loads on first need. Casting now
happens in the turn, so the first cast of a session can pause.

---

# IV. Across everything

## 11. Guidance — *player, mostly new ones* · **Working**

Not a screen: the reason most of the others look the way they do. Classes,
races and abilities that say what they are before you pick them. Spells and
feats that carry what they do, with prerequisites checked where they can be
and stated where they cannot. Actions described by consequence. Advantage
computed from both sides of the roll and explained in a sentence. One question
per screen, never a wall.

`guidance.ts` `stance.ts` `actions.ts` `feats.ts` `marks.ts`
· suites: `guidance` `guide` `stance` `feats`

**Weakest point:** it stops at the fight and the builder. Nothing guides a
player *between* sessions — no recap, no "here is what changed", no prompt
toward the parts of their sheet they have never used.

## 12. Prep — *DM* · **Solid**

Encounters built ahead of time, NPCs kept, homebrew statblocks written, rules
and creatures looked up mid-session without leaving the fight.

`npc.ts` `encounter.ts` `statblock.ts` `EncounterBuilder.tsx` `Npcs.tsx`
`Homebrew.tsx` `Reference.tsx` · suites: `encounter` `homebrew` `reference`

---

# Reading it

Nine of twelve are solid. Every gap in the app right now sits in one of four:

| Module | Gap |
|---|---|
| Creation & Progression | export — parked, decision open |
| Spellcasting | 4MB loaded at the worst moment |
| Guidance | nothing between sessions |
| Content | provenance is a trap for the next list added |

That is the whole of it, and it is a shorter list than the shape of the last
twelve days would suggest. The roadmap's order follows from this rather than
from whatever surfaced most recently.
