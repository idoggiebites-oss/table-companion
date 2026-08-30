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
spread across the other modules, and MODULES.md's table is the whole of it.

1. **A creature's conditions are shown to everyone.** *Disclosure.* The
   ladder decides what a player may learn about a creature — hidden, present,
   vague, exact — and the conditions on it were never put behind it. Shown to
   the table is the right default, because the table watches the goblin fall
   over; a DM who wants one hidden has no way to hide it.

2. **Help has never been tested against a real ally.** *The Turn.* It is the
   one action whose whole meaning is another character, and every suite that
   drives it drives it alone.

3. **Provenance is a trap for the next list drawn from a compendium.**
   *Content.* Ordering by book has been fixed twice, in two places, after the
   same bug. A third list will have it a third time unless it is written
   against `marks.ts` from the start.

## Done since this list was written

**A combat screen read against a reference image, again.** The mockup was
compared to the running app rather than reimplemented from it — the same
method as last time, and again most of it was already there: the two bands,
the round header with End round in it, Up now and Then with the step pair
between them, the claim card with its sword and shield, The room line with its
plus, the initiative strip, the disclosure chip, the gold. Four things were
genuinely different, and one of them was worth most of the work.

**One row of chrome, not three.** The room bar, the app's own name with two
buttons beside it, and the seat picker were three stacked bars: about 280
pixels above the tabs, on every screen, on a phone. The fight — the screen a
DM reads forty times an evening — started below the fold. Everything in those
bars except the seat and the code is pressed roughly twice a session.

So the header keeps what is READ: who you are, the code that gets read aloud,
and a dot for the connection with its meaning on its own label, because a
colour is not a state anybody can name. What is pressed went into two sheets,
split by what it acts on rather than by what fits: **The table** holds the
connection, the DM key and Leave; **This device** holds Add character and
Start over, which is exactly the line the app already draws between the log
and the things that never leave your phone. The fight card's top moved from
405px to 225px.

Not "The room": that name is already on this very screen, on the control that
says where the fight is happening, and two controls answering to one name is
an ambiguity for anything driving by name — a browser suite or a screen
reader. The gear is the table.

The app's name is now said once, to a screen reader, and drawn nowhere. It was
a 1.2rem heading above every screen, spending thirty pixels of a phone telling
somebody the name of the app they had just opened — but dropping it outright
would have left the page with no h1 at all, which is how a screen reader finds
the top of a document.

**A creature is an object, not a line in a list.** The rows ran flush into
each other with a hairline between, so the strip of seven controls under a
name read as belonging to the LIST rather than to the creature above it, and
at a glance the whole fight was one grey slab. Each row is its own box now.
That is the mockup's idea and it is a good one; what was not taken from it is
the gold border on the active creature — active is carried by luminance here,
because gold already means "the thing you are about to commit to" and red
already means damage.

**What the suites had been leaning on.** `.seatbar` used to mean "the campaign
has arrived", because it only rendered once this device had characters — and
thirty-two suites waited on it before picking a seat. The header row now
appears the moment you are in a room, which is right (a player who has joined
and has nobody to sit in yet still needs the way out), and useless as that
signal. Sixty-six waits now wait for the thing they actually need: a seat to
pick, or a character to claim. Three suites had been passing on the old
meaning by luck and started failing honestly the moment it changed.

The sweep after it: 63 suites, 1266 assertions, none failing and none empty —
run in four slices rather than one, because the twenty-minute version kept
being cut off, and a sweep that does not reach its own verdict says nothing.

Declined, and why. **The bottom action bar** of ATTACK / DODGE / USE ITEM
under a screen headed "I am the DM" — declined once already, for the same
reason: a DM does not dodge, and those are a character's turn actions. It
exists, for players, off the fight. **ACT / BON / REA on a player's row** on
the DM's screen: the action economy belongs to the person spending it, and two
devices tracking one turn is how a table ends up arguing about whether the
bonus action was used. **End round on the last turn of a round**, where Next
turn already does it.

**A comment is checked where it is written, not where it lands.** `/* … */`
among JSX children is not a comment, it is TEXT — and fourteen lines about how
the combat screen is arranged shipped onto the combat screen, in a fight,
under the initiative order. Three browser suites were taught to read their own
page for comment punctuation afterwards, which is the right check in the wrong
place three times over: it costs a browser, it covers only the screens
somebody thought to visit, and it can only ever find what has already shipped.

`check-prose` asks it of every `.tsx` in the repo, in a tenth of a second. The
earlier attempt to read it out of the source with a regular expression
produced a hundred and two false positives, because "is this line inside JSX
children" is not a question text can answer — so it is not asked of text.
TypeScript parses the file and every `JsxText` node is examined: the parser's
own word for "this renders". No heuristics, nothing to tune, and proved by
putting one back and watching it go red. The three page-reading assertions
stay, because a template literal could still carry one past the parser.

**44px, measured on the page.** `check-css` refuses a `min-height` under 44
without a stated reason, and cannot see the case that caused three of the four
known violations: a control that never declares one at all, sized by its
padding, its content, or a class it borrowed. Only the rendered box knows.

`verify-taps` walks twenty states at 390px — the room, five DM screens, six
player screens, the sheet with its drawers open, and the builder step by step,
which is where three of the four lived — and measures every button, select and
input a finger is meant to land on. It asserts nothing about styling. All
twenty are clean today, which is the point: this is a guard, not a repair. It
was proved by dropping the base button rule to 33px and watching all twenty
fail with the offenders named, because a check that has never failed is a
check nobody has tested. A new SCREEN still has to be added to its list.

**The builder rail settles, and it was one condition.** Written down as
needing "the derivation read rather than the symptom chased" — and the
derivations were right the whole time. The dot rendered a tick on
`st.done && i !== stepIndex`: the step you are STANDING on never showed its
own. That is both halves of what was reported. Gear is finished before you
ever reach it, because a starting kit's option (a) is a real choice the
character genuinely gets — so it ticked, and then lost the tick when you
arrived. Class and Race become finished while you stand there answering them,
so they held their number until you walked away.

Nothing was lost by ticking it. `.on` already puts that dot in gold, so where
you ARE and what is ANSWERED were two marks fighting over one; now the step
ticks under the choice that just finished it, which is where the person who
finished it is looking.

The lesson is the diagnosis, not the fix: the symptom was described in terms
of loading and derivation, and reading it in a browser — printing the rail
after each choice and again after each move — put the cause on screen in one
run. Three assertions in `verify-creation` hold it: a done step ticks where
you stand, an unanswered one keeps its number, and the whole rail is
unchanged by walking away from it.

**The recap prompts.** It reported and stopped, and the two questions arrive
together: a table that has just read "you levelled and came away with three
things" is the table about to ask what that changed on their sheet — and the
DM reading the same night back is asking it from the other side of the screen,
where it is called what do I prepare next.

Nine rules, four on a player's screen and five on the DM's, each one a fact
out of the log with the screen that settles it. A player is told about a level
nobody took, the hit points the night left them on, what is still spent, the
class features they have never once used, and the spells they know and have
never cast. The DM is told about the fight nobody ended, who is owed a level,
fights that earned nothing in an XP campaign, loot still sitting in the stash,
saved encounters the party has just outgrown, and an empty drawer.

Three rules decide what may be one. It has to be TRUE from the log rather than
inferred from what a session usually means — "you are on 7 of 24" is a fact,
"you had a rough night" is a story, and the story belongs to the people who
were there. Something has to be doable about it. And it has to have somewhere
to GO: a prompt naming a screen this device does not have is dropped rather
than rendered as a button that lands on the home screen, which is why a player
never gets one about prep and a wide screen never gets one about the fight.

Four of them are decisions rather than code. Nothing is said about XP in a
milestone campaign, because a night with three fights and nothing handed out is
how milestone campaigns work and the app would be arguing with a decision the
DM already made. Nothing is said about hit points to somebody who did not get
back up — the recap says that one line above, and saying it twice is the app
telling somebody the worst thing that happened to them again. Nothing is said
about the untouched half of a sheet to a character who was not at the table:
being told on the day you are made that you have neglected half of yourself is
the app calling a new player behind before they have sat down. And the
outgrown-encounter rule fires only after a level is gained, or it is a standing
complaint about fights that were fine when they were written.

The seam is asserted twice, because it is the one that matters: prompts are
built from the events handed in, so a player's come from a player's log, and
the DM's half only ever runs in the DM's seat. Unit tests assert a player is
shown none of the five, and `verify-recap` drives two real devices through a
session and reads them off the screen.

What it turned up: every button in this app is uppercase, and until now every
button was a LABEL of one or two words. These are sentences, and the first
render shouted them. The browser suite caught it and the unit tests could not
have — `innerText` returns what is rendered, and the string in the source was
sentence case all along.

Thirty unit tests and eight browser assertions on top of the suite that
already reads the recap. The sweep after it: 62 suites, 1241 assertions, none
failing and none empty.

**The three things declined from the mockup, built anyway.** Shipped as three
separate deploys so each could be verified on its own.

**A turn bar that follows you off the fight.** A player wanders to their sheet
between turns — which is what that screen is for — and then it is their turn
and the app says so with a dot on a tab. The answer to "I did not notice" was
never a louder dot. Five items matching the reference; Dodge is the one that
ACTS from the bar, because it is the only common action needing no target, no
roll and no choice. It appears only off the fight, where the whole turn is
already on screen. The bar and the padding that makes room for it come from
one named condition — the first draft had them disagree, which is a hole at
the foot of the page.

**End round, in the round's own header.** It advances past everyone left to
the top of the next round, which means those creatures do not act — so it says
how many turns it is about to skip rather than making that a discovery. Absent
on the last turn, where Next turn already does it.

**Stepping the turn where the turn is named.** Next turn stays the primary and
the biggest thing on the screen; this is the pair beside the NAME, for the two
moments the big button is wrong for. The foot's "Back a turn" was REMOVED
rather than duplicated — `verify-group` caught two controls answering to the
same name, which is an ambiguity for anything driving by name, browser suites
and screen readers alike.

One sweep failed on `verify-guidance` and passed 25/25 alone; a clean run on a
fresh server passed. Recorded as flake, not as a fix — the dev server dying
under repeated runs is still on the list below.

**Two marks from the mockup.** A combat screen was handed over as a reference
image and read against the running app rather than reimplemented. Most of it
already existed — the two bands, the aligned strip, ACT/BON/REA, the gold
accent — which is the useful outcome of comparing a mockup to the thing rather
than to a memory of it. Three things were genuinely absent:

`.pc` answers a question six rows of initiative could not: which of these is
somebody at the table. A goblin and a player character were the same shape of
row with the same kind of number, and the only tell was that creatures carry a
disclosure chip, which you have to already know to read.

`.vg` puts the meaning on the two buttons that resolve an attack. They sit
side by side, are pressed at speed, and "It hits" and "Missed" are the same
length and weight; a sword and a shield are not. And the add-condition control
is now the one gold thing on a creature's row — the only control there that
puts something NEW on the table rather than spending or revealing.

Glyphs from the set the hotbar already uses, not an icon library: this app
ships no webfont, and an icon font would be the same mistake wearing a
different hat. Each was checked against a private-use codepoint to confirm the
system font actually draws it — a glyph with nothing behind it renders as a
tofu box, which is worse than no glyph. The first version of that check was
worthless (it compared against an invalid font family, which falls back to the
default that DOES have the glyph) and was rewritten.

Not taken from the mockup, and why: **a bottom action bar** of ATTACK / DODGE /
USE ITEM under a screen headed "I am the DM" — a DM does not dodge, and those
are a character's turn actions; **END ROUND** beside the round counter, which
duplicates Next turn; and **moving turn navigation into the Up-now band**,
which would demote the one control a DM presses forty times an evening from
the biggest thing on the screen to a chevron.

**A press is acknowledged.** taste-skill's redesign audit, run against the
code rather than recited: a hundred and forty buttons and not one `:active`
rule. On a phone the finger covers the target, so the only confirmation a tap
registered was whatever changed afterwards — and here "afterwards" is often a
round trip to the DM's device. That is a good part of what reads as clunky and
it cost two lines.

A pixel down and a shade darker, not a scale: these sit in lists of 44px rows
and anything that changes a button's SIZE reflows the row under a thumb still
resting on it. `prefers-reduced-motion` drops the movement and keeps the
colour. Asserted on the live element rather than read off the stylesheet — a
rule that exists and a rule that WINS are different claims — and confirmed to
fail with the transform removed.

Two more from the same audit: `text-wrap: pretty` on paragraphs and `balance`
on headings, so a single word is never left alone on a last line; and the
content region is a `<main>`, which it had never been — 572 divs, 60 sections,
two navs and no landmark, so a screen reader had no way past the room code and
the tab bar to the thing the page is about.

What the audit did NOT change: the system font stack (it wants a display face
with character; this app ships no webfont on purpose, because a table opens it
on a phone with no signal and a font that arrives late moves the layout while
somebody is reading it), and the 48 uppercase labels (it dislikes all-caps
subheaders; here they are the one consistent naming device and the app's own
voice).

**A caster's turn leads with what a caster does.** It led with the weapon, so
a wizard's turn opened with "Attack with Quarterstaff" — a thing a wizard does
roughly never — and their cantrip sat a tap further behind a question. The
small print beside it read "or something else", which sounds like every option
on the turn and means another WEAPON.

That wording sent me to the weapon picker twice while looking for the spell,
and on the strength of it I reported to the table that a caster is never
offered their cantrip on their turn. That was wrong: the cast strip was there
the whole time, under "What else can I do?". The bug was that the one route a
caster wants was the one route the obvious button did not go to.

Now both are primaries, ordered by `leadsWithSpell` — the numbers, not a guess
about the class. A wizard swings at +1 and throws a Fire Bolt at +5, so the
spell leads; a ranger shoots at +7 and casts at +5, so the bow does; ties go to
the weapon rather than moving a screen somebody has already learnt. The button
also does what it says now: pressing "Cast Fire Bolt" aims Fire Bolt instead of
opening a menu and asking again.

Both directions are unit-tested, because a rule that only ever answers one way
is not a rule — and the ranger is the half that keeps it honest.

**A spell's damage is read from its own text when the data carries none.**
Fire Bolt arrived at the DM as "0 damage" — and the tell was the word: the
claim said "damage" rather than "fire", and the type is only generic when
`damageFor` found no roll to name it.

`rolls` is a Fight Club extension, not something a compendium must carry. The
one a real table imports has 317 spells and NOT ONE `<roll>` element, and 76
bundled spells state dice in prose and carry none either. Where that happens
the caster is asked for an attack roll, never asked for damage, and the claim
is sent as zero. `mergeById` already refuses to let an empty list overwrite a
full one — but a device that imported before that fix has the stripped copy
persisted locally, and stored content wins on reload, which is why this
survives a refresh and could not be reproduced on a clean device.

So `damageFor` now falls back to the spell's prose: the base line ("takes
1d10 fire damage", "10d6 + 40 force damage", bare "3d8 damage") and a
cantrip's own upgrade table, which scales on the CASTER's level. Of 1322
bundled spells whose text mentions dice, 1280 have usable data and 1074 are
recoverable from prose alone — 84%.

It deliberately does NOT invent slot scaling from prose like "an extra d6 for
each slot level above 3rd". And the pattern is anchored to the word "damage",
which is the whole of its safety: Cure Wounds "regains a number of hit points
equal to 1d8", False Life gives "1d4 + 4 temporary hit points", Control
Weather takes "1d4 x 10 minutes". Offering a player healing dice to hurt
somebody with is worse than offering nothing, and those four are asserted to
return nothing.

**Twenty-four declarations were using a CSS variable that does not exist.**
`--line` for `--rule`, `--accent` for `--gold`, `--sunk` for `--ground` —
names invented from memory while writing a new component. CSS fails silently
and it fails WHOLE: `border: 1px solid var(--line)` with no `--line` is not a
border in the wrong colour, it is no border at all, because the entire
shorthand is invalid at computed-value time. Nothing warns, the build
succeeds, the page renders.

They had clustered in the newest sections, which is most of why recent work
looked flatter than old work. Three of the seven controls on a creature's row
had never had a border and so did not read as pressable. `check-css` now
refuses a `var()` naming a property that is never defined; a written fallback
— `var(--hp, 1)` — is a deliberate default and still passes. Proved by
injecting one and watching it go red, after the first attempt to prove it
failed to fail: the pattern was lowercase-only and never saw the typo.

**A creature's row was four ragged bands.** It is a grid, and the grid had
been sized for the five children that existed when it was written; the action
economy, the condition +, and the hurt menu were added afterwards and fell
onto implicit rows. At 390px the initiative number sat thirty-six pixels
BELOW the name it belongs to and the left column alternated between two x
positions. 173px per creature, against 48px for a player.

Now three columns and two declared bands: the name line is exactly the
player's — initiative, name, health, aligned down the list — and everything a
DM presses is one strip beneath it. 121px. A control added tomorrow joins the
strip; it cannot quietly invent a band. `verify-combat` counts the bands
(clustered on element centres, because bucketing tops splits one line into
two and the count then means nothing), and it was confirmed to fail at three.

**A, B and R say ACT, BON and REA.** The words they stand for had lived only
in the `aria-label`, so the screen reader heard "Goblin 1 bonus action" and
the person holding the phone got a letter. The first thing anyone asked about
this feature was what the letters meant.

**Every screen is ordered by the questions it raises.** The fight screen was
rebuilt that way; the rest of the app still carried the order its features had
been built in, which is invisible to whoever wrote it and obvious to everyone
else. It is what "tacked on" means, and it happens because a new card has to go
*somewhere* and the bottom is always free.

The sheet had conditions, exhaustion and concentration LAST, under fourteen
hundred pixels of equipment — so the way to find out you were poisoned was to
scroll past your boots. They now sit beside the hit points, the only other
block that changes during a session, and what is worn moved down beside the
attacks it explains. Prep led with Places, the tallest card on the screen and
the one that does the least; it now leads with the encounter.

Written down as VISION law 7, because a reordering nobody can state is one
that drifts straight back. Two suites pin the orders — the sheet's in
`verify-panel`, prep's in `verify-tabs` — so a seventh card cannot be appended
without someone looking at the list and saying where it belongs. Both were
confirmed to fail against the old order.

Still hand-placed and left alone: Gear leads with what the equipment gets you
before what you are carrying, which is summary-before-detail and defensible;
and the Party screen shows the party before the roll it asks for, which is
look-then-act. Neither is the disease.

**The Spells step ticked before it was answered.** A brand-new warlock with a
class and a race showed a green tick against Spells, having seen nothing. Its
condition was `klass !== undefined` — which asks whether the QUESTION exists,
not whether it has been ANSWERED. Skills and Gear made that mistake and were
fixed; this was the same one, one step further removed, sitting directly under
a comment warning about it.

Underneath was a smaller thing: `book` was the only loader here initialised to
`[]` rather than `null`, so "the spell list has not arrived" and "this device
has no spell list" were the same value and no honest condition could be written
over it. Its four siblings are nullable for exactly that reason.

The step now uses the criterion its own card header prints: so many of so many
cantrips, so many of so many spells. It does not gate creating a character —
`gaps` never included spells and still does not, so "take what you like now or
leave it" remains true. What changed is only that the rail stops claiming a
step is finished when it is not.

**A type scale and a spacing scale.** The mockups kept looking more finished
than the app, and it was not the ideas in them — it was that a mockup is
written in one sitting against one scale, and the app was written over weeks,
one hand-picked number at a time. It had 43 distinct font sizes, including
0.94, 0.95, 0.96 and 0.98rem; one screen showed 15.36px, 15.2px and 15.04px
text within a third of a pixel of each other, which reads as blur rather than
as hierarchy. Margins were the same story: 90 inline `marginTop`s across seven
values two pixels apart.

Both are now scales. Type: 43 sizes down to 19, snapped down wherever a
cluster sat within a pixel of itself. Space: the stylesheet's own margins ran
every integer from 2 to 14 — 169 declarations across 15 values — and are now
eight steps, and the inline margins are five classes. The 262 inline styles are 72, and
none of the survivors is a literal size or margin; they are computed widths and
flex bases that a class genuinely cannot express. `check-inline` refuses a new
one, so the next person to reach for `style={{ marginTop: 11 }}` is told where
the scale is instead.

Nothing moved more than a pixel, and every snap went DOWN — the sheet sits four
pixels under a height guard, and a scale that makes a screen taller is not an
improvement.

**The combat screen follows the turn.** It was the order, then the statblock,
then whatever each feature needed when it was built. It now answers the
questions a turn raises, in that order: what is WAITING on you, what the one
who is up can DO, and only then the order — a reference you glance at rather
than the thing you work in. Legendary actions appear on somebody else's turn,
which is when they are available, and vanish on the creature's own.


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

- **The sweep checked one of three servers.** Fixed today. Six suites drive a
  built preview on port 4319 or 4173 rather than the worker on 8787, and the
  precondition check knew only about the worker — so a sweep with no preview
  running started happily and reported those six as *empty* at the end, which
  reads as a suite problem rather than the missing server it actually was. It
  now names all three before it starts. The same lesson as the empty-suite
  rule, one layer up: state the precondition where the message can still name
  the cause.

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

- **The sheet sits twelve pixels under the height verify-panel guards.** 2588
  against a 2600 ceiling — it was 2598 before the spacing scale took a few
  back. Still not comfortable: the next addition to the sheet trips the guard,
  which is exactly what the guard is for, but it means the next person to add
  anything there has to buy the space rather than find it. Deliberately not
  bought in advance — shaving padding to bank headroom is gaming the guard,
  and the trade is only judgeable against the thing being added.

- **26 browser-suite selectors match more than one component.** Was 43, and
  seventeen of those were the CHECK being wrong rather than a suite: it read
  `.sub-book .menu-hd` as scoped — which it is — and `card.locator(".menu-hd")`
  as bare, which is the same scoping written with a dot instead of a space.
  Two wrong findings in every five is why a baseline "meant to shrink" sat
  still: nobody works through a list that is mostly noise. It now follows the
  chain, and a locator held in a variable counts as the scope it is.

  The 26 that are left are real: `.saved` is worn by five components,
  `.swing-ask` by six, and each of these selects one from the page. Nothing is
  broken today — the right thing happens to render first — but it is how a
  suite silently began measuring the wrong component after SubclassPick
  borrowed the feat picker's classes. Still the first thing to attack
  alongside any UI revision, because a redesign will thrash exactly these.

- **`verify-turns`'s race is arranged, not raced for.** The player goes
  offline before pressing, which is what "at the same instant" means in a
  distributed system. Deterministic across repeated runs, but it proves the
  invariant on one interleaving rather than on a real collision.

---

## The thing this cannot answer

It has never been used at a table. Everything here is built on prediction and
a DM's feedback, which is a deliberate choice — but no amount of scaffolding
tells you which of it survives contact with five people and a bag of dice.
