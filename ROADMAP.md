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

**Proof.** 813 unit tests, 55 browser suites, ~1,120 assertions, run against a
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

- **44px is a rule the code keeps forgetting.** Three separate controls have
  shipped too small to press — background chips at 30, feat rows at 39, and
  the skills table's tick at 18, which was the only way to train a skill.
  `verify-guidance` now measures every button, select and input on three
  screens, but nothing stops a new one being added at 33.

- **`verify-turns`'s "one move, not two" is racy.** It presses Next turn and
  End turn on two devices "at the same instant" and asserts the fight moves
  once. When the sync lands between the two clicks the second device reads an
  already-advanced turn, sends a valid `from`, and the fight moves twice —
  the app behaving correctly on the input it got. Passes on re-run.

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
