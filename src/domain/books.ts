/**
 * Which book a subclass came from.
 *
 * The compendium knows whether something is the game's own — anything without
 * a "(HB)", "(TP)" or "(UA)" marker — and says nothing at all about WHICH
 * official book it came from. That is the one piece this file supplies, and
 * it is supplied by hand because there is nowhere to read it from.
 *
 * 2014 rules only, which is what this table is for: an "origin" is a 2024
 * idea and has no place here. Books are listed in publication order, because
 * that is the order a table's shelf grew in.
 *
 * Anything not in this table is not hidden by it. The provenance markers do
 * the hiding; this decides the HEADING a thing sits under, and an official
 * subclass nobody has written down here lands under "other official" rather
 * than disappearing.
 */

export interface Book {
  readonly id: string;
  readonly name: string;
  /** Short, for a heading on a phone. */
  readonly short: string;
  readonly year: number;
}

export const BOOKS: readonly Book[] = [
  { id: "phb", name: "Player's Handbook", short: "Player's Handbook", year: 2014 },
  { id: "dmg", name: "Dungeon Master's Guide", short: "Dungeon Master's Guide", year: 2014 },
  { id: "scag", name: "Sword Coast Adventurer's Guide", short: "Sword Coast", year: 2015 },
  { id: "xge", name: "Xanathar's Guide to Everything", short: "Xanathar's", year: 2017 },
  { id: "ggr", name: "Guildmasters' Guide to Ravnica", short: "Ravnica", year: 2018 },
  { id: "erlw", name: "Eberron: Rising from the Last War", short: "Eberron", year: 2019 },
  { id: "egw", name: "Explorer's Guide to Wildemount", short: "Wildemount", year: 2020 },
  { id: "mot", name: "Mythic Odysseys of Theros", short: "Theros", year: 2020 },
  { id: "tce", name: "Tasha's Cauldron of Everything", short: "Tasha's", year: 2020 },
  { id: "vrgr", name: "Van Richten's Guide to Ravenloft", short: "Ravenloft", year: 2021 },
  { id: "ftd", name: "Fizban's Treasury of Dragons", short: "Fizban's", year: 2021 },
  { id: "dsotdq", name: "Dragonlance: Shadow of the Dragon Queen", short: "Dragonlance", year: 2022 },
  { id: "bgg", name: "Bigby Presents: Glory of Giants", short: "Bigby's", year: 2023 },
];

/**
 * Subclass → book, keyed by a normalised name.
 *
 * A reprint is filed under the book that FIRST printed it: Sun Soul is
 * Sword Coast, not Xanathar's, and Order Domain is Ravnica, not Tasha's. The
 * question this answers is "where does this come from", and the answer to
 * that does not change when a later book reprints it.
 */
/*
 * Two indexes, because two different books name the same words.
 *
 * A sorcerer's Wild Magic is the Player's Handbook and a barbarian's Path of
 * Wild Magic is Tasha's — and stripping "path of" to match loose spellings
 * collapses them into one key, so one of the two ends up filed under the
 * other's book. The exact spelling is tried first; the loose one only
 * answers when it is unambiguous.
 */
const EXACT: Record<string, string> = {};
const LOOSE: Record<string, string | null> = {};

/** Every name this table files, for checking it against a real compendium. */
export const FILED: { readonly name: string; readonly book: string }[] = [];
const file = (book: string, names: readonly string[]) => {
  for (const n of names) {
    EXACT[exact(n)] = book;
    const k = key(n);
    // null marks a key two books both answer to: it can no longer be trusted.
    LOOSE[k] = k in LOOSE && LOOSE[k] !== book ? null : book;
    FILED.push({ name: n, book });
  }
};

/** The name as written, minus punctuation and any trailing marker. */
export function exact(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Names differ in punctuation and in whether the class word is present. */
export function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/^(the|way of the|way of|path of the|path of|circle of the|circle of|college of|oath of the|oath of|school of|order of the|order of)\s+/, "")
    .replace(/\s+(domain|conclave)$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

file("phb", [
  "Path of the Berserker", "Path of the Totem Warrior",
  "College of Lore", "College of Valor",
  "Knowledge Domain", "Life Domain", "Light Domain", "Nature Domain",
  "Tempest Domain", "Trickery Domain", "War Domain",
  "Circle of the Land", "Circle of the Moon",
  "Champion", "Battle Master", "Eldritch Knight",
  "Way of the Open Hand", "Way of Shadow", "Way of the Four Elements",
  "Oath of Devotion", "Oath of the Ancients", "Oath of Vengeance",
  "Hunter", "Beast Master",
  "Thief", "Assassin", "Arcane Trickster",
  "Draconic Bloodline", "Wild Magic",
  "The Archfey", "The Fiend", "The Great Old One",
  "School of Abjuration", "School of Conjuration", "School of Divination",
  "School of Enchantment", "School of Evocation", "School of Illusion",
  "School of Necromancy", "School of Transmutation",
]);
file("dmg", ["Oathbreaker", "Death Domain"]);
file("scag", [
  "Path of the Battlerager", "Arcana Domain", "Purple Dragon Knight", "Banneret",
  "Way of the Long Death", "Way of the Sun Soul", "Oath of the Crown",
  "Mastermind", "Swashbuckler", "Storm Sorcery", "The Undying", "Bladesinging",
]);
file("xge", [
  "Path of the Ancestral Guardian", "Path of the Storm Herald", "Path of the Zealot",
  "College of Glamour", "College of Swords", "College of Whispers",
  "Forge Domain", "Grave Domain",
  "Circle of Dreams", "Circle of the Shepherd",
  "Arcane Archer", "Cavalier", "Samurai",
  "Way of the Drunken Master", "Way of the Kensei",
  "Oath of Conquest", "Oath of Redemption",
  "Gloom Stalker", "Horizon Walker", "Monster Slayer",
  "Inquisitive", "Scout",
  "Divine Soul", "Shadow Magic",
  "The Celestial", "The Hexblade",
  "War Magic",
]);
file("ggr", ["Order Domain", "Circle of Spores"]);
file("erlw", ["Alchemist", "Artillerist", "Battle Smith"]);
file("egw", ["Echo Knight", "Chronurgy Magic", "Graviturgy Magic"]);
file("mot", ["College of Eloquence", "Oath of Glory"]);
file("tce", [
  "Armorer", "Path of the Beast", "Path of Wild Magic", "College of Creation",
  "Peace Domain", "Twilight Domain", "Circle of Stars", "Circle of Wildfire",
  "Psi Warrior", "Rune Knight", "Way of Mercy", "Way of the Astral Self",
  "Oath of the Watchers", "Fey Wanderer", "Swarmkeeper", "Phantom", "Soulknife",
  "Aberrant Mind", "Clockwork Soul", "The Fathomless", "The Genie",
  "Order of Scribes",
]);
file("vrgr", ["College of Spirits", "The Undead"]);
file("ftd", ["Way of the Ascendant Dragon", "Drakewarden"]);
// The compendium files Dragonlance's lunar sorcerer as "Lunar Magic".
file("dsotdq", ["Lunar Sorcery", "Lunar Magic"]);
file("bgg", ["Path of the Giant"]);

/** Which book, or null for something no official book printed. */
export function bookOf(name: string): Book | null {
  const id = EXACT[exact(name)] ?? LOOSE[key(name)] ?? null;
  return id ? (BOOKS.find((b) => b.id === id) ?? null) : null;
}

/** In publication order, so a shelf reads left to right. */
export function sortBooks(ids: readonly string[]): Book[] {
  return BOOKS.filter((b) => ids.includes(b.id));
}

/**
 * Options under their book's name, in publication order.
 *
 * Anything the table does not place keeps its own heading rather than being
 * dropped or filed under a book that never printed it — the four Amonkhet
 * domains, Critical Role's gunslinger, and whatever a compendium adds next.
 */
export function byBook<T extends { readonly name: string }>(
  options: readonly T[],
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const o of options) {
    const book = bookOf(o.name);
    const label = book ? book.short : "elsewhere";
    groups.set(label, [...(groups.get(label) ?? []), o]);
  }
  const order = [...BOOKS.map((b) => b.short), "elsewhere"];
  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}
