# What this is for

A companion for a table that is already in the room together.

Not a virtual tabletop, not a character sheet with a rules engine bolted on,
and not an attempt to run the game. Five people are sitting at a table with
dice in front of them. The app carries the bookkeeping that the table is bad
at and none of the things the table is good at.

What the table is bad at: remembering that the floor is rubble on everyone's
turn but the first, working out whether a paralysed target and a poisoned
attacker cancel out, tracking six goblins' hit points, knowing what a level-6
Blood Hunter can do, and remembering last week.

What the table is good at: everything else. Especially the parts that are the
reason anyone came.

[MODULES.md](MODULES.md) breaks this into twelve pieces of capability.
[ROADMAP.md](ROADMAP.md) says which of them are weak. This file is the part
that does not change: the rules that settle arguments about what to build.

---

# Who it serves

Two people, and the seam between them is where the tool earns its place.

**The player**, often one who has played twice, holding a sheet they do not
fully understand. Everything the app knows, it says in a sentence, at the
moment it applies — not in a help screen they will never open. "Advantage: the
goblin is prone" teaches the rule while it is being used. "Advantage" alone
teaches nothing.

**The DM**, holding the fiction, six statblocks, the plan for tonight, and the
attention of everyone at the table. What they need is fewer things to hold and
no surprises — the room they prepared as pitch dark opening in the dark, the
fight they built arriving already staged, the note they wrote appearing at the
moment the door opens.

Neither is the app's user in the sense of a person operating a tool. They are
two people having a conversation, and the app is one of the things on the
table.

---

# The laws

Six rules. Each one has cost something to hold, and each one settles a real
argument about what to build next.

## 1. The app never rolls

It names the die, holds the modifier, and does the arithmetic. Advantage is two
taps and keeps the right one. But the number comes from a person throwing
something.

This is not nostalgia. Rolling is the part of the game people are there for,
and a table that lets an app roll for it has quietly become a spreadsheet with
a story attached. Every "the app could just…" that ends in a random number ends
at this line.

The recap can say "one natural twenty, thrown by Bel" precisely *because* the
app never rolled it.

## 2. Nothing is applied by one person to another

A player claims; the DM confirms. The app works out hit-or-miss against armour
class and says so — "18 against 15, hits" — and the call still belongs to the
DM, because a shield spell or a cover rule the app has never heard of is always
possible.

This is not politeness. It is what keeps the disclosure ladder standing: a
player who could apply their own damage would learn a creature's armour class
by trial, and one told "that misses" by the app would learn it in one go.

## 3. What the log says depends on who is reading it

Every device replays the same events — that is what makes undo work across a
table. But "everyone replays the same events" is not "everyone reads the same
events". Prep is prep: the villain just written down, the creature waiting in
the next room, the place prepared as *the cellar under the mill*.

Opening that place is public, because the table can see the room go dark.
Preparing it is not.

## 4. Positions live on the table

The app computes a great deal about a roll and nothing at all about where
anybody is standing. No map, no tokens, no reach, no cover, no line of sight —
those belong to the miniatures, the battle mat, or the four people arguing
about whether the pillar counts.

So what the app says about a roll is *partial by design*, and it never
contradicts the DM. What it does model are the facts that are true for everyone
at once: it is dark, the floor is rubble, there is a gale.

## 5. Everything is undoable, and undo is not deletion

The state is the replay of an append-only log. Taking something back appends a
marker naming the event to skip, because other people have acted since and a
removed event would silently rewrite their history.

A DM who mis-taps at a table of five needs to fix it in one press, in front of
everyone, without a conversation about it.

## 6. Say only what can be stood behind

The app knows Kira took eleven damage. It does not know the ghoul had her by
the throat. Every line it writes is a fact it can defend, phrased plainly, and
the story around it stays with the people who were there.

The same rule governs its silences. An unknown statblock lands as 1 hit point,
which is visibly wrong rather than plausibly wrong. A spell whose text does not
say a save halves the damage takes nothing on a save — the rule's default, and
the safer way to be wrong.

## 7. A screen is ordered by the questions it raises

Not by the order its features were built. That order is invisible to whoever
wrote it and obvious to everyone else — it is what "tacked on" means, and it
is what every screen here drifted into, because a new card has to go
*somewhere* and the bottom is always free.

So each screen answers, top to bottom:

1. **What is waiting on me?** — the thing that stopped the table. A save owed,
   a reaction offered, a roll asked for.
2. **What can I do about it?** — the actions this moment allows.
3. **What is true right now?** — the live values. Hit points, conditions,
   whose turn it is.
4. **What am I?** — the reference you looked up once and glance at since.

The fight screen was rebuilt this way first: what is waiting, then what the
creature whose turn it is can do, then the order — which is a reference you
glance at, not the thing you work in. The character sheet followed: conditions
and concentration had been sitting last, under fourteen hundred pixels of
equipment, so the way to learn you were poisoned was to scroll past your boots.

The test for a new card is not "is there room" but "which of those four is
it, and is it above everything further down the list than itself." A card that
is none of them — a description with nothing on the other end — is a card that
should not be on a play screen at all.

---

# What it refuses

Each of these has been asked for, by the work itself, and turned down for a
reason that is still good.

**A battle map.** See law 4. The moment the app knows where people are
standing, it starts being the surface everyone looks at, and the table becomes
five people watching a screen.

**Rolling, automating, or resolving.** See laws 1 and 2. Every one of these
saves ten seconds and takes something the table came for.

**Being the DM's boss.** No "you should prepare three encounters", no session
pacing, no difficulty warnings beyond the arithmetic the DM asked for. The
encounter builder shows its working — raw XP, the multiplier, the reason for
the multiplier — and lets the DM disagree with the answer.

**Being public.** This runs for one table. That is what makes it legitimate to
ship a complete compendium with it, and the rule is stated where it is enforced
rather than assumed.

---

# The seams

Where the design puts its joints, and why they are there rather than elsewhere.

**Player / DM.** Not two apps: one act with two faces. A fight is a thing two
people are inside of, and the seam between them is disclosure, not features.

**Prep / the table.** Everything the DM writes down beforehand is inert until
they open it. A place carries its room, whatever waits in it, and the line to
read — and opening it does all three at once, because doing them separately is
how a fight starts in daylight it was meant to start in the dark.

**The session / between sessions.** Inside a session the app answers "what can
I do right now". Between them it answers "what happened last time". Both come
from the same log, read in opposite directions.

**Shipped / imported / device-local.** Content ships with the app, a table can
bring more, and a device's own state — seat, claimed characters, preferences —
never enters the log at all.

---

# How it would be judged

By a table that has used it for a session and forgotten it was there.

Not by feature count. The measure is how much of the evening the app took off
the table's hands without taking any of the evening itself: fewer stalls to
look something up, fewer rules quietly got wrong, fewer things one person was
holding alone, and nobody looking at a screen when they should be looking at
each other.

It has not been measured that way yet. Everything in this repository is built
on prediction and one DM's feedback — a deliberate choice, and the one thing no
amount of scaffolding can answer.
