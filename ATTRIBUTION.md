# Attribution

## Game content

This work includes material taken from the System Reference Document 5.1
("SRD 5.1") by Wizards of the Coast LLC and available at
<https://dnd.wizards.com/resources/systems-reference-document>. The SRD 5.1 is
licensed under the Creative Commons Attribution 4.0 International License
available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Content that is NOT under that licence

`src/domain/non-srd.ts` holds the encounter-building tables (XP thresholds by
character level, and the encounter multiplier) from the Dungeon Master's
Guide, and the ability-score generation tables (standard array, point buy)
from the Player's Handbook. None of it is SRD 5.1 — verified against the SRD PDF, where the
relevant headings appear on no page while control terms like "Goblin" and
"Fireball" appear on many.

They are present because this is a private tool for one table whose DM owns
the book. **This app is therefore not redistributable as it stands.** Deleting
that one file and the `budget` argument at its call sites returns the app to
fully-licensed behaviour: raw XP totals with no difficulty band. Nothing else
imports it.

Homebrew entry exists so that other content which cannot be shipped can still
be used.

**Trademarks are not covered by that licence.** CC BY 4.0 grants use of the SRD
*text* with attribution and says nothing about the Dungeons & Dragons name or
logo, which are governed separately by Wizards of the Coast's Fan Content
Policy. "Table Companion" is deliberately clear of both.

## Data source

Monster and condition data is built from
[5e-bits/5e-database](https://github.com/5e-bits/5e-database), which is MIT
licensed. The build is reproducible: `node scripts/build-srd.mjs` refetches and
rewrites `public/srd/*.json`.

MIT License, Copyright (c) 2018-2020 Adrian Padua, Christopher Ward.
