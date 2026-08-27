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
  { id: "vgm", name: "Volo's Guide to Monsters", short: "Volo's", year: 2016 },
  { id: "xge", name: "Xanathar's Guide to Everything", short: "Xanathar's", year: 2017 },
  { id: "mtf", name: "Mordenkainen's Tome of Foes", short: "Mordenkainen's", year: 2018 },
  { id: "ggr", name: "Guildmasters' Guide to Ravnica", short: "Ravnica", year: 2018 },
  { id: "acq", name: "Acquisitions Incorporated", short: "Acquisitions Inc", year: 2019 },
  { id: "erlw", name: "Eberron: Rising from the Last War", short: "Eberron", year: 2019 },
  { id: "egw", name: "Explorer's Guide to Wildemount", short: "Wildemount", year: 2020 },
  { id: "mot", name: "Mythic Odysseys of Theros", short: "Theros", year: 2020 },
  { id: "tce", name: "Tasha's Cauldron of Everything", short: "Tasha's", year: 2020 },
  { id: "vrgr", name: "Van Richten's Guide to Ravenloft", short: "Ravenloft", year: 2021 },
  { id: "ftd", name: "Fizban's Treasury of Dragons", short: "Fizban's", year: 2021 },
  { id: "scoc", name: "Strixhaven: A Curriculum of Chaos", short: "Strixhaven", year: 2021 },
  { id: "sjag", name: "Spelljammer: Astral Adventurer's Guide", short: "Spelljammer", year: 2022 },
  { id: "dsotdq", name: "Dragonlance: Shadow of the Dragon Queen", short: "Dragonlance", year: 2022 },
  { id: "bgg", name: "Bigby Presents: Glory of Giants", short: "Bigby's", year: 2023 },
  { id: "plan", name: "Planescape: Adventures in the Multiverse", short: "Planescape", year: 2023 },
];

/**
 * Subclass → book, keyed by a normalised name.
 *
 * A reprint is filed under the book that FIRST printed it: Sun Soul is
 * Sword Coast, not Xanathar's, and Order Domain is Ravnica, not Tasha's. The
 * question this answers is "where does this come from", and the answer to
 * that does not change when a later book reprints it.
 */
/**
 * What kind of thing is being placed.
 *
 * Kept apart because the same word is two different things in two different
 * books: Volo's goblin is a race and Ravnica's goblin is a different race,
 * and "Fey Touched" is a feat while "Fey Wanderer" is a subclass. One shared
 * index would have them overwrite each other.
 */
export type Kind = "subclass" | "race" | "background" | "feat" | "style";

/*
 * Two indexes, because two different books name the same words.
 *
 * A sorcerer's Wild Magic is the Player's Handbook and a barbarian's Path of
 * Wild Magic is Tasha's — and stripping "path of" to match loose spellings
 * collapses them into one key, so one of the two ends up filed under the
 * other's book. The exact spelling is tried first; the loose one only
 * answers when it is unambiguous.
 */
const EXACT: Record<string, Record<string, string>> = {};
const LOOSE: Record<string, Record<string, string | null>> = {};

/** Every name this table files, for checking it against a real compendium. */
export const FILED: {
  readonly name: string; readonly book: string; readonly kind: Kind;
}[] = [];

/*
 * First printing wins. The books are listed below in publication order, so a
 * reprint never displaces the book that first carried the thing — which is
 * the question "where does this come from" actually asks.
 */
const put = (kind: Kind, book: string, names: readonly string[]) => {
  EXACT[kind] ??= {};
  LOOSE[kind] ??= {};
  for (const n of names) {
    const e = exact(n);
    if (!(e in EXACT[kind]!)) EXACT[kind]![e] = book;
    const k = key(n);
    if (!(k in LOOSE[kind]!)) LOOSE[kind]![k] = book;
    else if (LOOSE[kind]![k] !== book) LOOSE[kind]![k] = null; // two books answer to it
    FILED.push({ name: n, book, kind });
  }
};

/** Subclasses, which is what this table was written for first. */
const file = (book: string, names: readonly string[]) => put("subclass", book, names);

/**
 * The spellings a compendium actually uses, brought together.
 *
 * Two of them cost this table half its matches. Subraces are written
 * comma-inverted so a shelf sorts by parent — "Dwarf, Hill" for Hill Dwarf,
 * "Elf, Drow / Dark" for two names at once. And fighting styles are filed as
 * feats called "Fighting Style: Archery". Neither is wrong; both have to be
 * read before a name can be looked up.
 */
/**
 * The name without its trailing parenthetical, counting brackets.
 *
 * A compendium expands a feat's choices into its name — "Squat Nimbleness
 * (Dexterity + Acrobatics (Proficient))" — and a regex that strips the LAST
 * group leaves "Squat Nimbleness (Dexterity + Acrobatics", which matches
 * nothing.
 */
function withoutTail(name: string): string {
  const t = name.trim();
  if (!t.endsWith(")")) return t;
  let depth = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ")") depth++;
    else if (t[i] === "(") {
      depth--;
      if (depth === 0) return t.slice(0, i).trim();
    }
  }
  return t;
}

function plain(name: string): string {
  let out = withoutTail(name)
    .toLowerCase()
    .replace(/^fighting style:\s*/, "")
    // "Elf, Drow / Dark" offers two names; the first is the one to match on.
    .split(" / ")[0]!;
  const comma = /^([^,]+),\s*(.+)$/.exec(out);
  if (comma) out = `${comma[2]} ${comma[1]}`;
  return out;
}

/** The name as written, minus punctuation and any trailing marker. */
export function exact(name: string): string {
  return plain(name).replace(/[^a-z0-9]+/g, "");
}

/** Names differ in punctuation and in whether the class word is present. */
export function key(name: string): string {
  return plain(name)
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


/* ---- races ------------------------------------------------------------ */
/*
 * Subraces are filed under their parent's book unless a later one printed
 * them: a wood elf is the Player's Handbook, an eladrin is Mordenkainen's.
 * Monsters of the Multiverse is deliberately absent — it reprints Volo's and
 * Mordenkainen's rather than adding, and a table asking "where is this from"
 * wants the first printing.
 */
put("race", "phb", [
  "Dwarf", "Hill Dwarf", "Mountain Dwarf",
  "Elf", "High Elf", "Wood Elf", "Dark Elf", "Drow", "Drow Elf",
  "Halfling", "Lightfoot Halfling", "Stout Halfling",
  "Human", "Variant Human",
  "Dragonborn", "Gnome", "Forest Gnome", "Rock Gnome",
  "Half-Elf", "Half-Orc", "Tiefling",
  // As the picker shows a subrace, with the parent's name taken off.
  "Standard", "Variant", "Hill", "Mountain", "High", "Wood", "Lightfoot",
  "Stout", "Forest", "Rock", "Dark",
]);
put("race", "scag", [
  "Ghostwise Halfling", "Svirfneblin", "Deep Gnome",
  "Feral Tiefling", "Devil's Tongue", "Hellfire", "Winged Tiefling",
  // As the compendium spells the half-elf and tiefling variants.
  "Half-Elf, Aquatic Elf Ancestry", "Half-Elf, Drow / Dark Elf Ancestry",
  "Half-Elf, High Elf Ancestry", "Half-Elf, Wood Elf Ancestry",
  "Half-Elf, Moon Elf or Sun Elf Ancestry", "Tiefling, Variants",
]);
put("race", "vgm", [
  "Aasimar", "Protector Aasimar", "Scourge Aasimar", "Fallen Aasimar",
  "Firbolg", "Goliath", "Kenku", "Lizardfolk", "Tabaxi", "Triton",
  "Bugbear", "Goblin", "Hobgoblin", "Kobold", "Orc", "Yuan-ti Pureblood",
]);
put("race", "mtf", [
  "Duergar", "Eladrin", "Sea Elf", "Shadar-kai", "Githyanki", "Githzerai",
  // The bloodlines, as the compendium spells them.
  "Baalzebul", "Dispater", "Fierna", "Glasya", "Levistus", "Mammon",
  "Mephistopheles", "Zariel",
  "Tiefling of Asmodeus", "Tiefling of Baalzebul", "Tiefling of Dispater",
  "Tiefling of Fierna", "Tiefling of Glasya", "Tiefling of Levistus",
  "Tiefling of Mammon", "Tiefling of Mephistopheles", "Tiefling of Zariel",
]);
put("race", "ggr", ["Centaur", "Loxodon", "Minotaur", "Simic Hybrid", "Vedalken"]);
put("race", "acq", ["Verdan"]);
put("race", "erlw", [
  "Changeling", "Kalashtar", "Shifter", "Warforged",
  "Beasthide", "Longtooth", "Swiftstride", "Wildhunt",
  /*
   * The twelve dragonmarks, which the compendium files as subraces of
   * whoever carries them: "Human, Mark of Making", "Elf, Mark of Shadow".
   */
  "Dwarf, Mark of Warding", "Elf, Mark of Shadow", "Gnome, Mark of Scribing",
  "Half-Elf, Mark of Detection", "Half-Elf, Mark of Storm",
  "Half-Orc, Mark of Finding", "Halfling, Mark of Healing",
  "Halfling, Mark of Hospitality", "Human, Mark of Finding",
  "Human, Mark of Handling", "Human, Mark of Making",
  "Human, Mark of Passage", "Human, Mark of Sentinel",
  /*
   * And the same twelve as the builder shows them. A subrace is listed under
   * its parent, so the picker strips the parent's name off the front —
   * "Mark of Finding", not "Human, Mark of Finding".
   */
  "Mark of Warding", "Mark of Shadow", "Mark of Scribing", "Mark of Detection",
  "Mark of Storm", "Mark of Finding", "Mark of Healing", "Mark of Hospitality",
  "Mark of Handling", "Mark of Making", "Mark of Passage", "Mark of Sentinel",
]);
put("race", "egw", [
  "Draconblood", "Ravenite", "Pallid Elf", "Lotusden Halfling",
]);
put("race", "mot", ["Leonin", "Satyr"]);
put("race", "tce", ["Custom Lineage"]);
put("race", "vrgr", ["Dhampir", "Hexblood", "Reborn"]);
put("race", "ftd", ["Chromatic Dragonborn", "Metallic Dragonborn", "Gem Dragonborn"]);
put("race", "scoc", ["Owlin"]);
put("race", "sjag", [
  "Astral Elf", "Autognome", "Giff", "Hadozee", "Plasmoid", "Thri-kreen",
]);
put("race", "dsotdq", ["Kender"]);

/* ---- backgrounds ------------------------------------------------------ */
put("background", "phb", [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero",
  "Guild Artisan", "Hermit", "Noble", "Outlander", "Sage", "Sailor",
  "Soldier", "Urchin",
  // The book's own variants, which it prints inside the parent's entry.
  "Spy", "Gladiator", "Pirate", "Knight", "Guild Merchant",
]);
put("background", "scag", [
  "City Watch", "Investigator", "Clan Crafter", "Cloistered Scholar", "Courtier",
  "Faction Agent", "Far Traveler", "Inheritor", "Knight of the Order",
  "Mercenary Veteran", "Urban Bounty Hunter", "Uthgardt Tribe Member",
  "Waterdhavian Noble",
]);
put("background", "ggr", [
  "Azorius Functionary", "Boros Legionnaire", "Dimir Operative",
  "Golgari Agent", "Gruul Anarch", "Izzet Engineer", "Orzhov Representative",
  "Rakdos Cultist", "Selesnya Initiate", "Simic Scientist",
]);
put("background", "acq", ["Celebrity Adventurer's Scion"]);
put("background", "erlw", ["House Agent"]);
put("background", "egw", ["Grinner", "Volstrucker Agent"]);
put("background", "vrgr", ["Haunted One"]);
put("background", "scoc", [
  "Lorehold Student", "Prismari Student", "Quandrix Student",
  "Silverquill Student", "Witherbloom Student",
]);
put("background", "sjag", ["Astral Drifter", "Wildspacer"]);
put("background", "dsotdq", ["Knight of Solamnia", "Mage of High Sorcery"]);
put("background", "bgg", ["Giant Foundling", "Rune Carver"]);
put("background", "plan", ["Gate Warden", "Planar Philosopher"]);

/* ---- feats ------------------------------------------------------------ */
put("feat", "phb", [
  "Alert", "Athlete", "Actor", "Charger", "Crossbow Expert",
  "Defensive Duelist", "Dual Wielder", "Dungeon Delver", "Durable",
  "Elemental Adept", "Grappler", "Great Weapon Master", "Healer",
  "Heavily Armored", "Heavy Armor Master", "Inspiring Leader", "Keen Mind",
  "Lightly Armored", "Linguist", "Lucky", "Mage Slayer", "Magic Initiate",
  "Martial Adept", "Medium Armor Master", "Mobile", "Moderately Armored",
  "Mounted Combatant", "Observant", "Polearm Master", "Resilient",
  "Ritual Caster", "Savage Attacker", "Sentinel", "Sharpshooter",
  "Shield Master", "Skilled", "Skulker", "Spell Sniper", "Tavern Brawler",
  "Tough", "War Caster", "Weapon Master",
]);
put("feat", "scag", ["Svirfneblin Magic"]);
put("feat", "erlw", ["Aberrant Dragonmark", "Revenant Blade"]);
put("feat", "xge", [
  "Bountiful Luck", "Dragon Fear", "Dragon Hide", "Drow High Magic",
  "Dwarven Fortitude", "Elven Accuracy", "Fade Away", "Fey Teleportation",
  "Flames of Phlegethos", "Infernal Constitution", "Orcish Fury", "Prodigy",
  "Second Chance", "Squat Nimbleness", "Wood Elf Magic",
]);
put("feat", "tce", [
  "Artificer Initiate", "Chef", "Crusher", "Eldritch Adept", "Fey Touched",
  "Fighting Initiate", "Gunner", "Metamagic Adept", "Piercer", "Poisoner",
  "Shadow Touched", "Skill Expert", "Slasher", "Telekinetic", "Telepathic",
]);
put("feat", "ftd", [
  "Gift of the Chromatic Dragon", "Gift of the Metallic Dragon",
  "Gift of the Gem Dragon",
  // The book's supernatural gifts, filed alongside feats.
  "Draconic Gift: Draconic Familiar", "Draconic Gift: Draconic Rebirth",
  "Draconic Gift: Draconic Senses", "Draconic Gift: Echo of Dragonsight",
  "Draconic Gift: Frightful Presence", "Draconic Gift: Psionic Reach",
  "Draconic Gift: Scaled Toughness", "Draconic Gift: Tongue of the Dragon",
]);
put("feat", "vrgr", [
  "Dark Gift: Echoing Soul", "Dark Gift: Gathered Whispers",
  "Dark Gift: Living Shadow", "Dark Gift: Mist Walker",
  "Dark Gift: Second Skin", "Dark Gift: Symbiotic Being",
  "Dark Gift: Touch of Death", "Dark Gift: Watchers",
]);
put("feat", "scoc", [
  "Strixhaven Initiate", "Strixhaven Mascot", "Mage of Lorehold",
  "Mage of Prismari", "Mage of Quandrix", "Mage of Silverquill",
  "Mage of Witherbloom",
]);
put("feat", "dsotdq", [
  "Adept of the Black Robes", "Adept of the Red Robes",
  "Adept of the White Robes", "Divinely Favored", "Initiate of High Sorcery",
  "Knight of the Crown", "Knight of the Sword", "Knight of the Rose",
  "Squire of Solamnia",
]);
put("feat", "bgg", [
  "Strike of the Giants", "Ember of the Fire Giant", "Fury of the Frost Giant",
  "Guile of the Cloud Giant", "Keenness of the Stone Giant",
  "Soul of the Storm Giant", "Vigor of the Hill Giant",
]);
put("feat", "plan", [
  "Scion of the Outer Planes", "Planar Wanderer", "Agent of Order",
]);

/* ---- fighting styles --------------------------------------------------- */
/* Tasha's is the only book of the era that added any. */
put("style", "phb", [
  "Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection",
  "Two-Weapon Fighting",
]);
put("style", "tce", [
  "Blind Fighting", "Interception", "Superior Technique",
  "Thrown Weapon Fighting", "Unarmed Fighting", "Druidic Warrior",
  // The paladin's, from the same book's optional class features.
  "Blessed Warrior",
]);

/** Which book, or null for something no official book printed. */
export function bookOf(name: string, kind: Kind = "subclass"): Book | null {
  const id = EXACT[kind]?.[exact(name)] ?? LOOSE[kind]?.[key(name)] ?? null;
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
  kind: Kind = "subclass",
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const o of options) {
    const book = bookOf(o.name, kind);
    const label = book ? book.short : "elsewhere";
    groups.set(label, [...(groups.get(label) ?? []), o]);
  }
  const order = [...BOOKS.map((b) => b.short), "elsewhere"];
  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}
