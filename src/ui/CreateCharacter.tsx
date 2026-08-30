/**
 * Building a character at session zero.
 *
 * The one screen a complete stranger opens. Every other surface assumes you
 * know what a saving throw is; this cannot. The usual fix — tooltips, an
 * explainer panel, a wizard that lectures — would wreck the instrument and
 * bore the veterans, so it teaches by CONSEQUENCE instead: the derived
 * numbers sit beside the scores and move as you assign them. Nobody reads
 * what Dexterity does; they watch armour class and Stealth change.
 *
 * Class comes first, not race. Every builder leads with race because the
 * printed sheet does, and mechanically that is backwards: class decides
 * almost everything you will actually do, so asking for it first lets every
 * later step filter and advise. Race first teaches the app nothing.
 *
 * Advice is never enforcement. Recommend is a button, not a default — auto
 * placing scores would quietly homogenise every character at the table.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABILITIES, abilityModifier, formatModifier, proficiencyBonus, SKILLS, SKILL_IDS,
  type Ability, type SkillId,
} from "../domain/abilities.js";
import type { Character } from "../domain/build.js";
import {
  asiPoints, assemble, finalScores, hpAtLevel, missing, withImprovements,
  type ExtraClass,
  type BackgroundChoice, type ClassChoice, type RaceChoice, type ScoreMethod,
} from "../domain/creation.js";
import {
  canAfford, POINT_BUY_BUDGET, POINT_BUY_MIN, pointsSpent, STANDARD_ARRAY,
} from "../domain/non-srd.js";
import {
  gather, isMundaneTool, kindsNamed, languagesFromTrait, resolveTool, toolKind,
  toolsFromClass, ALL_LANGUAGES, type ToolKind,
} from "../domain/proficiencies.js";
import { effectsOf } from "../domain/featvariants.js";
import { sensesFrom } from "../domain/senses.js";
import { freeBonusFrom, freeSkillsFrom, grantsFeatFrom } from "../domain/races.js";
import { hasInnate, innateAt, innateFrom } from "../domain/innate.js";
import { multiclassBlock } from "../domain/multiclass.js";
import { isCore } from "../domain/marks.js";
import { useHomebrew } from "./useHomebrew.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import type { ClassId, DieSize } from "../domain/resources.js";
import type { Identity } from "../domain/build.js";

/** The nine, in the order everybody lists them. */
const ALIGNMENTS = [
  "Lawful good", "Neutral good", "Chaotic good",
  "Lawful neutral", "True neutral", "Chaotic neutral",
  "Lawful evil", "Neutral evil", "Chaotic evil",
] as const;

const IDENTITY_FIELDS: readonly [keyof Identity, string, string][] = [
  ["personality", "Personality", "I am calm under pressure and think three steps ahead."],
  ["ideals", "Ideals", "Freedom. People should choose their own destiny."],
  ["bonds", "Bonds", "I would do anything to protect my sister."],
  ["flaws", "Flaws", "I struggle to trust anyone who hides what they want."],
];
import {
  loadBackgrounds, loadClasses, loadClassLevels, loadEquipment, loadFeats,
  loadRaces, loadSpells,
  type BackgroundEntry, type ClassEntry, type ClassLevels, type RaceEntry,
} from "../store/srd.js";
import type { CompendiumSpell } from "../import/compendium.js";
import {
  byBookOrder, castableBy, isClassFeature, toKnown, type KnownSpell,
} from "../domain/spells.js";
import {
  ABILITY_BLURB, abilityName, blurbFor, CLASS_BLURB, CLASS_HUE, describePriority,
  featureOf, mechanicalTraits, shapeOf,
} from "../domain/guidance.js";
import { FeatPick } from "./FeatPick.js";
import { SubclassPick } from "./SubclassPick.js";
import { describeGrants, grantsOf } from "../domain/background.js";
import { Num } from "./Num.js";
import { PickList } from "./PickList.js";
import { SpellPick } from "./SpellPick.js";
import { choicesBy, findChoices } from "../domain/subclass.js";
import { describeGrant, multiclassGrant } from "../domain/multiclassing.js";
import { byBook } from "../domain/books.js";
import type { CompendiumFeat } from "../import/compendium.js";
import {
  indexItems, isArmour, isShield, isWeapon, type Item, type Stack,
} from "../domain/items.js";
import { formatCoins } from "../domain/money.js";
import { describeWealthFor, wealthFor } from "../domain/non-srd.js";
import {
  parseChoice, parseFixed, toStack, type GearOption,
} from "../domain/starting-gear.js";

const FLAT: Record<Ability, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
const skillIdOf = (label: string): SkillId | undefined =>
  SKILL_IDS.find((s) => s.toLowerCase() === label.toLowerCase().replace(/\s+/g, ""));
const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

/** Priority order for Recommend — the app's opinion, offered not applied. */
const PRIORITY: Partial<Record<ClassId, Ability[]>> = {
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  cleric: ["wis", "con", "str", "dex", "cha", "int"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  fighter: ["str", "con", "dex", "wis", "cha", "int"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
  paladin: ["str", "cha", "con", "dex", "wis", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  rogue: ["dex", "con", "wis", "int", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
};

/**
 * What to call a picker that offers one family of tools.
 *
 * "Tools" over a list of ten instruments is the app declining to repeat what
 * the book just said — the row is the answer to "one type of musical
 * instrument", and it should say so.
 */
function labelFor(kinds: readonly ToolKind[]): string {
  const words: Record<ToolKind, string> = {
    "artisan tools": "Artisan's tools",
    "gaming set": "Gaming sets",
    instrument: "Musical instruments",
    tools: "Tools",
  };
  if (kinds.length === 0) return "Tools";
  if (kinds.length === 1) return words[kinds[0]!];
  return kinds.map((k) => words[k].toLowerCase()).join(" or ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function CreateCharacter({
  onCreate, onCancel, startLevel = 1, rebuilding = false,
}: {
  /*
   * The level to open at.
   *
   * A re-roll is a fresh character at the level they had REACHED, and this
   * form defaults to 1 — so the first rebuild produced a level 1 wizard with
   * eight hit points and knocked them unconscious on the spot. The level is
   * not the player's to change here; it is what they already were.
   */
  startLevel?: number;
  /** Says so on the screen, since "Create character" is the wrong verb. */
  rebuilding?: boolean;
  onCreate: (
    c: Character,
    starting?: {
      items: readonly Stack[];
      coins: number;
      equip?: readonly string[];
      spells?: readonly KnownSpell[];
    },
  ) => void;
  onCancel: () => void;
}) {
  const [races, setRaces] = useState<RaceEntry[] | null>(null);
  const [classes, setClasses] = useState<ClassEntry[] | null>(null);
  const [levels, setLevels] = useState<ClassLevels | null>(null);
  const [gear, setGear] = useState<Item[] | null>(null);
  /*
   * `null` until the compendium answers, like every other loader here.
   *
   * It was `[]`, which made "the spell list has not arrived" and "this device
   * has no spell list" the same value — and the Spells step read one of them
   * as the other. Its four siblings above are nullable for exactly this
   * reason; this one was the exception and it is what the step got wrong.
   */
  const [loadedBook, setLoadedBook] = useState<CompendiumSpell[] | null>(null);
  const book = loadedBook ?? [];
  const [spellFilter, setSpellFilter] = useState("");
  /** Which picker is open, keyed by class and kind: "wizard:cantrip". */
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  /**
   * Spells, kept per class rather than in one pile.
   *
   * A Wizard 2 / Cleric 1 has two allowances and two books. Pooled, a wizard
   * could fill their cleric's cantrips with wizard cantrips and the count
   * would still read as satisfied.
   */
  const [chosenByClass, setChosenByClass] = useState<Record<string, KnownSpell[]>>({});
  const [gearMode, setGearMode] = useState<"kit" | "gold">("kit");
  /** Which lettered option is taken, per choice. */
  const [picks, setPicks] = useState<Record<number, string>>({});
  /** What was chosen to satisfy "a martial weapon", keyed choice:phrase. */
  const [catPicks, setCatPicks] = useState<Record<string, string>>({});
  const [level, setLevel] = useState(startLevel);

  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [classSkills, setClassSkills] = useState<SkillId[]>([]);
  const [raceId, setRaceId] = useState<string>("");
  const [raceFilter, setRaceFilter] = useState("");
  const [whatDo, setWhatDo] = useState(false);
  const [raceWhat, setRaceWhat] = useState(false);
  const [improvements, setImprovements] = useState<
    Record<
      number,
      {
        abilities?: Partial<Record<Ability, number>>;
        feat?: { id: string; name: string };
        /** Resilient, and only Resilient: a save this feat made you good at. */
        save?: Ability;
      }
    >
  >({});
  const [featList, setFeatList] = useState<CompendiumFeat[]>([]);
  const [classPicks, setClassPicks] = useState<Record<string, string>>({});
  const [subraceId, setSubraceId] = useState<string>("");
  const [method, setMethod] = useState<ScoreMethod>("array");
  const [assigned, setAssigned] = useState<Partial<Record<Ability, number>>>({});
  const [pool, setPool] = useState<number[]>([...STANDARD_ARRAY]);
  const [picked, setPicked] = useState<number | null>(null);
  const [buy, setBuy] = useState<Record<Ability, number>>({ ...FLAT });
  const [rolled, setRolled] = useState<number[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgSkills, setBgSkills] = useState<SkillId[]>([]);
  const [pickedLangs, setPickedLangs] = useState<string[]>([]);
  const [identity, setIdentity] = useState<Identity>({});
  /** The half of a racial bonus the race leaves to you. */
  const [freeBonuses, setFreeBonuses] = useState<Partial<Record<Ability, number>>>({});
  const [raceSkills, setRaceSkills] = useState<SkillId[]>([]);
  const [raceFeat, setRaceFeat] = useState<{ id: string; name: string } | null>(null);
  /** Classes beyond the first — added at the end, the way a rebuild goes. */
  const [extras, setExtras] = useState<ExtraClass[]>([]);
  /** The one skill a second bard, ranger or rogue brings with it. */
  const [mcSkills, setMcSkills] = useState<Record<string, SkillId[]>>({});
  /** Which question is in front of you. */
  const [step, setStep] = useState(0);
  /** Whether other people's material is in the lists. Device-local. */
  const [homebrew, setHomebrew] = useHomebrew();
  const [toolsByAsk, setToolsByAsk] = useState<Record<string, string[]>>({});
  const [bgId, setBgId] = useState("");
  const [bgFilter, setBgFilter] = useState("");
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);

  useEffect(() => {
    loadRaces().then(setRaces, () => setRaces([]));
    loadClasses().then(setClasses, () => setClasses([]));
    loadClassLevels().then(setLevels, () => setLevels({}));
    loadEquipment().then(setGear, () => setGear([]));
    loadBackgrounds().then(setBackgrounds, () => setBackgrounds([]));
    loadSpells().then(setLoadedBook, () => setLoadedBook([]));
    loadFeats().then(setFeatList, () => setFeatList([]));
  }, []);

  /** Keeps the chosen race listed even when it falls out of the filter. */
  /*
   * Imported material is kept out until it is asked for. Four fifths of the
   * races in a complete compendium carry a provenance marker, and scrolling
   * past three hundred of them to reach Elf is not a choice, it is a search.
   *
   * Whatever is already chosen stays listed either way: a switch must never
   * silently un-choose something.
   */
  const raceable = useMemo(
    () => (races ?? []).filter((r) => homebrew || isCore(r.name) || r.id === raceId),
    [races, homebrew, raceId],
  );
  const hiddenRaces = (races?.length ?? 0) - raceable.length;

  const shownRaces = useMemo(() => {
    const q = raceFilter.trim().toLowerCase();
    if (!q) return raceable;
    return raceable.filter((r) => r.name.toLowerCase().includes(q) || r.id === raceId);
  }, [raceable, raceFilter, raceId]);

  const backgroundable = useMemo(
    () => backgrounds.filter((b) => homebrew || isCore(b.name) || b.id === bgId),
    [backgrounds, homebrew, bgId],
  );
  const hiddenBackgrounds = backgrounds.length - backgroundable.length;

  const shownBackgrounds = useMemo(() => {
    const q = bgFilter.trim().toLowerCase();
    return q
      ? backgroundable.filter((b) => b.name.toLowerCase().includes(q) || b.id === bgId)
      : backgroundable;
  }, [backgroundable, bgFilter, bgId]);

  const klass = classes?.find((c) => c.id === classId);
  const race = races?.find((r) => r.id === raceId);
  const subrace = race?.subraces.find((s) => s.id === subraceId);

  const raceChoice: RaceChoice | undefined = race && {
    id: race.id,
    name: race.name,
    speed: race.speed,
    abilityBonuses: race.abilityBonuses as Partial<Record<Ability, number>>,
    ...(subrace
      ? {
          subraceName: subrace.name.replace(new RegExp(`\\s*${race.name}$`), ""),
          subraceBonuses: subrace.abilityBonuses as Partial<Record<Ability, number>>,
        }
      : {}),
    // The half the race left to the player — see freeBonusFrom.
    ...(Object.keys(freeBonuses).length > 0 ? { freeBonuses } : {}),
  };

  const baseScores = useMemo<Record<Ability, number>>(() => {
    if (method === "pointBuy") return buy;
    return Object.fromEntries(
      ABILITIES.map((a) => [a, assigned[a] ?? 8]),
    ) as Record<Ability, number>;
  }, [method, buy, assigned]);

  /*
   * What the race hands over, and what it leaves to you.
   *
   * A half-elf gets +2 Charisma and two more points of their own choosing; a
   * variant human gets nothing fixed, two free points, a skill and a feat.
   * The builder applied the fixed half and dropped the rest, so a half-elf
   * arrived two points short of the book — on the one screen whose whole job
   * is showing consequences.
   */
  /*
   * Spells the race hands over. A tiefling knows Thaumaturgy and a drow knows
   * Dancing Lights; the trait said so and the spell never reached the spell
   * list, so they arrived unable to cast the one thing their race is known
   * for.
   *
   * Matched against the spellbook by name, because the trait writes "faerie
   * fire" and the file writes "Faerie Fire" — and a spell this app cannot
   * find is not added rather than invented.
   */
  const innate = useMemo(() => innateFrom(race?.traits), [race]);
  const innateSpells = useMemo(() => {
    if (book.length === 0) return [];
    const byName = new Map(book.map((sp) => [sp.name.toLowerCase(), sp]));
    return innateAt(innate, level)
      .map((g) => byName.get(g.name.toLowerCase()))
      .filter((sp): sp is CompendiumSpell => sp !== undefined);
  }, [innate, book, level]);

  const freeBonus = useMemo(() => freeBonusFrom(race?.traits), [race]);
  const freeSkills = useMemo(() => freeSkillsFrom(race?.traits), [race]);
  const offersFeat = useMemo(() => grantsFeatFrom(race?.traits), [race]);
  const freeSpent = Object.values(freeBonuses).reduce((n, v) => n + (v ?? 0), 0);
  const freeOwed = (freeBonus?.count ?? 0) * (freeBonus?.each ?? 1);

  const raced = raceChoice ? finalScores(baseScores, raceChoice) : baseScores;
  /*
   * Improvements count towards what is shown, not only towards what is saved.
   *
   * A character built at 8 has passed two of them, and the panel that exists
   * to show consequences was showing the scores they had at level 1 — so a
   * +2 to Dexterity moved the armour class on the finished sheet and nowhere
   * on the screen where it was chosen. A half-feat's +1 had the same problem
   * and no chip to hide behind.
   */
  const scores = withImprovements(
    raced,
    Object.values(improvements).filter((i) => i.abilities),
  );
  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(scores[a])]),
  ) as Record<Ability, number>;

  /*
   * Languages and tools, which the builder used to ask for and then throw
   * away — a finished character who spoke nothing and could use nothing.
   *
   * Read from the same places a player reads them: the race's own Languages
   * trait, the class's tool line, and a background, which is defined as two
   * of either.
   */
  const raceLangTrait = (race?.traits ?? []).find((t) => /^language/i.test(t.name));
  const raceLangs = raceLangTrait
    ? languagesFromTrait(raceLangTrait.desc)
    : { known: race?.languages ?? [], choose: 0 };
  const classTools = toolsFromClass(klass?.tools ?? "");
  /** Race extra + class choice + a background's two, in one pool. */
  /*
   * What the chosen background actually gives — not two picks to spend
   * however you like, which is a rule no edition has. An acolyte gets two
   * languages and no tools; a criminal two tools and no languages. See
   * background.ts for the reading.
   */
  const chosenBg = backgrounds.find((x) => x.id === bgId);
  const bgGives = useMemo(
    () => grantsOf(chosenBg?.traits ?? []),
    [chosenBg],
  );
  const langPicks = raceLangs.choose + bgGives.languages;
  const toolPicks =
    classTools.choose + bgGives.toolChoices.reduce((n, c) => n + c.count, 0);

  /** Every tool anyone can be proficient with, carrying its family. */
  const toolOptions = useMemo(() => {
    const seen = new Map<string, { name: string; kind: ToolKind }>();
    for (const i of gear ?? []) {
      if (!isMundaneTool(i.detail) || seen.has(i.name)) continue;
      const kind = toolKind(i.detail);
      if (kind) seen.set(i.name, { name: i.name, kind });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [gear]);

  /*
   * What the background hands over outright, spelled the way the equipment
   * list spells it.
   *
   * This was read, shown in the sentence, and then dropped: the card said
   * "Gladiator gives you Disguise kits" and the finished sheet had no
   * disguise kit on it, because the background's own tools were passed along
   * as an empty list. Nothing about it is a choice, so nothing about it
   * should be asked.
   */
  const bgTools = useMemo(
    () => bgGives.tools.map((t) => resolveTool(t, toolOptions.map((o) => o.name))),
    [bgGives, toolOptions],
  );

  /*
   * One picker per thing actually asked for.
   *
   * "One type of musical instrument" was a list of fifty-four tools with an
   * allowance of one — which is not the question the book asked, and leaves
   * a gladiator free to come away proficient with a plough. A phrase naming
   * a family narrows to it; one naming none is a genuinely open choice and
   * keeps the whole list.
   *
   * Asks are kept separate rather than pooled because two of them can name
   * overlapping families — a monk's "artisan's tools or a musical
   * instrument" beside an entertainer's instrument — and a shared pool
   * cannot say which pick answered which question.
   */
  const toolAsks = useMemo(() => {
    const asks: {
      readonly id: string;
      readonly of: string;
      readonly kinds: readonly ToolKind[];
      readonly max: number;
      readonly note?: string;
    }[] = [];
    if (klass && classTools.choose > 0) {
      asks.push({
        id: "class",
        of: klass.name,
        kinds: kindsNamed(classTools.choiceOf ?? classTools.stated ?? ""),
        max: classTools.choose,
        ...(classTools.stated ? { note: classTools.stated } : {}),
      });
    }
    bgGives.toolChoices.forEach((c, i) => {
      asks.push({
        id: `bg${i}`,
        of: bgName.trim() || "Background",
        kinds: kindsNamed(c.of),
        max: c.count,
      });
    });

    /*
     * Two asks for the same family are one question.
     *
     * A bard who took the gladiator background is asked for three musical
     * instruments and then for one, and the second row is identical to the
     * first — which reads as a bug and lets the same flute answer both. Four
     * instruments is what the two lines add up to, so that is what to ask.
     */
    const merged = new Map<string, (typeof asks)[number]>();
    for (const ask of asks) {
      const sig = [...ask.kinds].sort().join("|");
      const had = merged.get(sig);
      merged.set(sig, had
        ? { ...had, max: had.max + ask.max, of: `${had.of} · ${ask.of}` }
        : ask);
    }
    return [...merged.values()];
  }, [klass, classTools, bgGives, bgName]);

  const pickedTools = useMemo(
    () => [...new Set(toolAsks.flatMap((a) => toolsByAsk[a.id] ?? []))],
    [toolAsks, toolsByAsk],
  );

  /** What each ask offers: its families, or everything when it named none. */
  const optionsForAsk = useCallback(
    (kinds: readonly ToolKind[]) =>
      (kinds.length === 0
        ? toolOptions
        : toolOptions.filter((o) => kinds.includes(o.kind))
      ).map((o) => o.name),
    [toolOptions],
  );

  const table = klass && levels ? levels[klass.id] : undefined;
  const atLevel = table?.[level - 1];
  const asiLevels = (table ?? []).filter((l) => l.asi).map((l) => l.level);

  /*
   * Who a feat's prerequisites are measured against, as the build stands
   * right now — so raising Strength to 13 makes Grappler available in front
   * of you rather than after you commit to it.
   */
  /** Everything chosen, whichever class it came from. */
  const chosenSpells = useMemo(
    () => Object.values(chosenByClass).flat(),
    [chosenByClass],
  );

  const aspirant = {
    abilities: scores,
    spellSlots: atLevel?.slots ?? [],
    knowsSpells: chosenSpells.length > 0,
    race: race?.name ?? "",
  };
  const asi = asiPoints(asiLevels, level);
  // Proficiency has to come from the chosen level, not the level-1 default —
  // the preview's whole job is to be the number you will actually see.
  const prof = atLevel?.profBonus ?? proficiencyBonus(level);

  const hasKit =
    (klass?.equipment?.length ?? 0) > 0 || (klass?.equipmentChoices?.length ?? 0) > 0;

  /*
   * Follow the class, and only once a class exists. Keyed on the class rather
   * than on hasKit: before one is chosen hasKit is false, and an effect
   * watching it flipped every character to "buy your own" before they had
   * picked anything — so nobody got their starting kit at all.
   */
  useEffect(() => {
    if (!klass) return;
    setGearMode(hasKit ? "kit" : "gold");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klass?.id]);

  const catalogue = useMemo(() => indexItems(gear ?? []), [gear]);
  const fixedGear = useMemo(
    () => (klass ? parseFixed(klass.equipment ?? [], catalogue) : []),
    [klass, catalogue],
  );
  const choices2 = useMemo<GearOption[][]>(
    () => (klass ? (klass.equipmentChoices ?? []).map((d) => parseChoice(d, catalogue)) : []),
    [klass, catalogue],
  );

  /** What the character walks away carrying, and with what in their purse. */
  const starting = useMemo(() => {
    if (!klass) return { items: [] as Stack[], coins: 0, equip: [] as string[] };
    if (gearMode === "gold") {
      return { items: [], coins: wealthFor(klass.id, klass.wealth), equip: [] };
    }
    const items: Stack[] = [];
    for (const p of fixedGear) {
      const st = toStack(p);
      if (st) items.push(st);
    }
    choices2.forEach((opts, i) => {
      const taken = opts.find((o) => o.letter === (picks[i] ?? opts[0]?.letter));
      if (!taken) return;
      taken.phrases.forEach((p, j) => {
        if (p.kind === "category") {
          const chosen = catPicks[`${i}:${j}`];
          const it = chosen ? catalogue[chosen] : undefined;
          if (it) items.push({ itemId: it.id, name: it.name, qty: p.qty });
          return;
        }
        const st = toStack(p);
        if (st) items.push(st);
      });
    });
    /*
     * What to put ON them. A character whose kit sits in a pack has no
     * attacks and no armour class from it, and the first thing they are told
     * when they try to swing is to go and equip something — which is the
     * hidden step this whole screen exists to remove.
     *
     * One weapon, one set of armour, one shield: the obvious reading of a
     * starting kit, and all of it changeable under Gear.
     */
    const equip: string[] = [];
    const first = (test: (i: Item) => boolean) =>
      items.map((s) => catalogue[s.itemId]).find((i): i is Item => i !== undefined && test(i));
    const weapon = first(isWeapon);
    const armour = first(isArmour);
    const shield = first(isShield);
    for (const i of [weapon, armour, shield]) if (i) equip.push(i.id);

    return { items, coins: 0, equip };
  }, [klass, gearMode, fixedGear, choices2, picks, catPicks, catalogue]);

  /**
   * How many of each the class gets at this level, straight from the table.
   * A wizard at 1 knows three cantrips and six spells; at 5 it is four and
   * more — asking the builder to know that is the point of having the table.
   */
  /**
   * Every class this character has, the first one included.
   *
   * The builder used to know about exactly one class and treat the rest as an
   * afterthought bolted on at the review step: no subclass, no fighting
   * style, no spells. A Fighter 3 / Wizard 2 was offered no spell step at
   * all, because the question "does this character cast" was asked of the
   * fighter.
   */
  const roster = useMemo(
    () =>
      klass
        ? [
            {
              id: klass.id as ClassId,
              name: klass.name,
              hitDie: klass.hitDie as DieSize,
              level,
            },
            ...extras,
          ]
        : [],
    [klass, level, extras],
  );

  /**
   * Which of this character's classes cast, and what each is owed.
   *
   * Asked of every class rather than the first, because "does this character
   * cast" is not a question about the fighter half of a Fighter 3 / Wizard 2
   * — and asking it that way is why that character was offered no spells at
   * all.
   */
  const casters = useMemo(
    () =>
      roster
        .map((c) => {
          const row = levels?.[c.id]?.[c.level - 1];
          return {
            ...c,
            cantrips: row?.cantrips ?? 0,
            known: row?.known ?? 0,
            slots: (row?.slots ?? []).some((n) => n > 0),
          };
        })
        .filter((c) => c.cantrips > 0 || c.known > 0 || c.slots),
    [roster, levels],
  );

  const cantripsKnown = casters.reduce((n, c) => n + c.cantrips, 0);
  const spellsKnown = casters.reduce((n, c) => n + c.known, 0);
  const hasSlots = casters.some((c) => c.slots);
  const castsAtAll = casters.length > 0;

  const pickedCantrips = chosenSpells.filter((s) => s.level === 0).length;
  const pickedSpells = chosenSpells.filter((s) => s.level > 0).length;

  const spellsFor = useMemo(() => {
    if (!castsAtAll) return () => [] as typeof book;
    const q = spellFilter.trim().toLowerCase();
    const have = new Set(chosenSpells.map((s) => s.id));
    /*
     * One list per casting class, not one pooled list.
     *
     * A Wizard 2 / Cleric 1 has two allowances and two books, and offering
     * the two added together let a wizard fill their cleric's cantrips with
     * wizard cantrips. The tables say how many of each; this says which.
     */
    return (classId: string, top: number) =>
      book
        .filter((s) => {
          if (have.has(s.id) || isClassFeature(s)) return false;
          // The switch governs every list drawn from a compendium, and this
          // is the one a new player meets first.
          if (!homebrew && !isCore(s.name)) return false;
          if (!castableBy(s, classId, { homebrew })) return false;
          // Nothing you could not cast: a spell above your best slot is not
          // a choice, it is a tease.
          if (s.level > top + 1) return false;
          if (q && !s.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort(byBookOrder);
  }, [book, castsAtAll, spellFilter, chosenSpells, homebrew]);

  /** The highest slot a class has at its own level. */
  const topSlotOf = useCallback(
    (id: string, lvl: number) => {
      const slots = levels?.[id]?.[lvl - 1]?.slots ?? [];
      for (let i = slots.length - 1; i >= 0; i--) if ((slots[i] ?? 0) > 0) return i;
      return -1;
    },
    [levels],
  );

  /**
   * What the class asks about itself. A cleric without a domain is not a
   * cleric, and the builder was making them.
   */
  const classChoices = useMemo(() => {
    if (!levels) return [];
    return roster.flatMap((c) => {
      const table = levels[c.id] ?? [];
      const feats = table.flatMap((row) =>
        row.features.map((n) => ({
          level: row.level,
          name: n,
          ...(row.texts?.[n] ? { text: row.texts[n]! } : {}),
        })),
      );
      return choicesBy(findChoices(feats), c.level).map((p) =>
        // Two classes can both ask for a Fighting Style, so the key carries
        // whose question it is — and so does the heading, once there are two.
        roster.length > 1 ? { ...p, of: `${c.name} · ${p.of}` } : p,
      );
    });
  }, [roster, levels]);
  const picksDone = classChoices.every((c) => classPicks[c.of]);

  /** Improvement levels this character has already passed. */
  const earnedLevels = asiLevels.filter((l) => l <= level);
  const spentAt = (lvl: number) => {
    const at = improvements[lvl];
    if (!at) return false;
    if (at.feat) return true;
    return Object.values(at.abilities ?? {}).reduce((n, v) => n + (v ?? 0), 0) === 2;
  };
  const improvementsDone = earnedLevels.every(spentAt);

  const allAssigned = method === "pointBuy" || ABILITIES.every((a) => assigned[a] !== undefined);
  const skillsNeeded = klass?.skillChoices?.choose ?? 0;

  const choices =
    klass && raceChoice
      ? {
          name,
          race: raceChoice,
          klass: {
            id: klass.id as ClassId,
            name: klass.name,
            hitDie: klass.hitDie as DieSize,
            saves: klass.saves as Ability[],
            spellSlots: klass.spellcasting?.slots ?? [],
          } satisfies ClassChoice,
          background: {
            name: bgName, skills: bgSkills,
            tools: bgTools,
          } satisfies BackgroundChoice,
          // Granted and chosen, merged — Common arrives from more than one
          // source and should appear on the sheet once.
          identity,
          // Read off the race's own traits — see senses.ts.
          senses: sensesFrom(race?.traits),
          languages: gather(raceLangs.known, pickedLangs),
          tools: gather(classTools.known, pickedTools),
          baseScores,
          ...(extras.length > 0 ? { extraClasses: extras } : {}),
          // The race's own skill counts as a proficiency like any other.
          classSkills: [
            ...new Set([...classSkills, ...raceSkills, ...Object.values(mcSkills).flat()]),
          ],
          level,
          /*
           * A variant human's feat is taken at level ONE, before any
           * improvement — so it rides at the front of the same list rather
           * than needing a second channel to the sheet.
           */
          improvements: [
            ...(raceFeat ? [{ feat: raceFeat }] : []),
            ...earnedLevels.map((l) => improvements[l] ?? {}),
          ],
          picks: classChoices
            .filter((c) => classPicks[c.of])
            .map((c) => ({ of: c.of, name: classPicks[c.of]! })),
          ...(atLevel?.slots.length ? { spellSlots: atLevel.slots } : {}),
        }
      : undefined;

  /** Categories the book asks about and nobody has answered yet. */
  const unpicked = choices2.flatMap((opts, i) => {
    const taken = opts.find((o) => o.letter === (picks[i] ?? opts[0]?.letter));
    return (taken?.phrases ?? []).flatMap((p, j) =>
      p.kind === "category" && !catPicks[`${i}:${j}`] ? [p.label] : [],
    );
  });

  /*
   * Whether these classes will have each other. The rule cuts both ways and
   * people forget the first half: a new class asks for its own minimum AND
   * the minimum of every class already taken.
   */
  const mcBlock =
    klass && extras.length > 0
      ? multiclassBlock({
          from: [
            { classId: klass.id, level },
            ...extras.map((c) => ({ classId: c.id, level: c.level })),
          ],
          into: extras[extras.length - 1]!.id,
          abilities: scores,
        })
      : null;

  const gaps = [
    ...missing(choices ?? {}),
    ...(mcBlock ? [mcBlock.toLowerCase().replace(/\.$/, "")] : []),
    // A racial choice half-made is a character two points short of the book.
    ...(freeSpent === freeOwed ? [] : [`${freeOwed - freeSpent} racial ability points`]),
    ...(raceSkills.length >= freeSkills ? [] : [`${freeSkills} racial skill`]),
    ...(!offersFeat || raceFeat ? [] : ["your level-one feat"]),
    ...(gearMode === "kit" ? unpicked : []),
    ...(improvementsDone ? [] : ["your improvements"]),
    ...(picksDone ? [] : classChoices.filter((c) => !classPicks[c.of]).map((c) => c.of.toLowerCase())),
    ...(allAssigned ? [] : ["every score assigned"]),
    ...(classSkills.length === skillsNeeded ? [] : [`${skillsNeeded} class skills`]),
    ...extras.flatMap((c) => {
      const owed = multiclassGrant(c.id)?.skills?.choose ?? 0;
      return owed > (mcSkills[c.id]?.length ?? 0) ? [`${c.name}'s skill`] : [];
    }),
  ];

  /**
   * Finish. Hoisted out of the review card so the footer's primary button —
   * the biggest thing on the screen, and where a thumb already is — can be
   * the control that does it.
   */
  function finish(): void {
    if (!choices || gaps.length > 0) return;
    onCreate(
      { base: assemble(choices), deltas: [] },
      {
        ...starting,
        /*
         * What the race gave, alongside what the class chose. Deduped by id —
         * a high elf whose free cantrip is one their class also offers should
         * know it once.
         */
        spells: [
          ...chosenSpells,
          ...innateSpells
            .filter((sp) => !chosenSpells.some((x) => x.id === sp.id))
            .map((sp) => toKnown(sp)),
        ],
      },
    );
  }

  function recommend() {
    if (!klass) return;
    const order = PRIORITY[klass.id as ClassId] ?? [...ABILITIES];
    if (method === "pointBuy") {
      const spread = [15, 14, 13, 12, 10, 8];
      setBuy(Object.fromEntries(order.map((a, i) => [a, spread[i]!])) as Record<Ability, number>);
      return;
    }
    const values = (method === "rolled" ? [...rolled] : [...STANDARD_ARRAY])
      .sort((a, b) => b - a);
    if (values.length < 6) return;
    setAssigned(Object.fromEntries(order.map((a, i) => [a, values[i]!])));
    setPool([]);
    setPicked(null);
  }

  function resetScores(next: ScoreMethod) {
    setMethod(next);
    setAssigned({});
    setPicked(null);
    setBuy({ ...FLAT });
    setPool(next === "array" ? [...STANDARD_ARRAY] : []);
    setRolled([]);
  }

  const toggle = <T,>(list: T[], v: T, max: number): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list;

  /*
   * One question per screen.
   *
   * The builder was a single column you scrolled: eight cards, every one of
   * them open, and no sign of where you were or how much was left. Paging it
   * costs a tap between steps and buys the thing a scroll cannot give — the
   * question in front of you being the only question in front of you.
   *
   * The rail is the way back. Every step on it is reachable at any time,
   * because changing your race after picking spells is a normal thing to want
   * and a linear flow that forbids it is worse than the scroll was.
   */
  /*
   * What each step is waiting on before it can be answered at all.
   *
   * Every section from the story onwards is gated on `klass && race` in the
   * markup, and the rail did not know — so a step you could not yet answer
   * rendered an empty card with a Back and a Continue and no explanation,
   * and two of them ticked themselves because "nothing left unchosen" is
   * vacuously true when there is nothing to choose from.
   */
  const needsClass = klass === undefined;
  const needsRace = race === undefined;
  const waitingOn = (want: "class" | "both"): string | null => {
    if (want === "class") return needsClass ? "a class" : null;
    if (needsClass && needsRace) return "a class and a race";
    if (needsClass) return "a class";
    return needsRace ? "a race" : null;
  };

  const steps: {
    readonly id: string;
    readonly label: string;
    readonly done: boolean;
    /** What it is waiting on, or null when it can be answered now. */
    readonly waiting?: string | null;
  }[] = [
    /*
     * Who they are, then what they can do.
     *
     * Skills used to come second, before a race, a background or a single
     * ability score existed — so the table it draws showed every total as
     * the bare proficiency bonus, and the choice that is MEANT to be read
     * off consequences ("+7 stealth") was read off nothing. It also asked
     * about skills twice over: a background grants two and a race sometimes
     * grants one, and picking class skills before either is how a player
     * spends a choice on something they were about to be given.
     *
     * Class first because it is what makes everything after it advisable.
     * Then race, then the background, then the numbers — and only then the
     * skills, where every one of those has already had its say.
     */
    { id: "class", label: "Class", done: klass !== undefined },
    {
      id: "race",
      label: "Race",
      waiting: waitingOn("class"),
      done:
        race !== undefined &&
        freeSpent === freeOwed &&
        raceSkills.length >= freeSkills &&
        (!offersFeat || raceFeat !== null),
    },
    {
      id: "background",
      label: "Story",
      done: bgSkills.length >= 2 && bgName.trim() !== "",
      waiting: waitingOn("both"),
    },
    {
      id: "abilities",
      label: "Scores",
      done: allAssigned && improvementsDone && picksDone,
      waiting: waitingOn("both"),
    },
    /*
     * Answered, not merely unobjectionable.
     *
     * These two ticked themselves on a brand-new character: with no class
     * there is nothing to pick, so "picked as many as are needed" was 0 === 0
     * and "nothing left unchosen" was vacuously true. The rail told a player
     * two steps were finished before they had chosen a class.
     *
     * A step whose question does not exist yet is not done — it is not ready.
     * Both of these are the class's questions, so both wait for one.
     */
    {
      id: "skills",
      label: "Skills",
      done: klass !== undefined && classSkills.length === skillsNeeded,
      waiting: waitingOn("class"),
    },
    /* Only ever in the list for a caster, and a caster needs a class — but
       said out loud, because `true` is how the other two got it wrong. */
    ...(castsAtAll
      ? [
          {
            id: "spells",
            label: "Spells",
            /*
             * Having a class is not having chosen spells — the same mistake as
             * the two above, one step removed: it asked whether the QUESTION
             * existed rather than whether it had been answered, so a brand-new
             * warlock got a green tick against Spells before seeing the list.
             *
             * The criterion is the one the card itself prints in its header:
             * so many of so many cantrips, so many of so many spells. A
             * prepared caster has no "spells known" and the table says zero,
             * which is why that half is conditional rather than a comparison
             * against nothing.
             *
             * An empty book once the compendium HAS answered is done: there is
             * nothing on this device to pick, the card says so, and a step
             * that can never be satisfied would strand Review forever.
             */
            done:
              klass !== undefined &&
              loadedBook !== null &&
              (loadedBook.length === 0 ||
                (pickedCantrips >= cantripsKnown &&
                  (spellsKnown === 0 || pickedSpells >= spellsKnown))),
            waiting: waitingOn("both"),
          },
        ]
      : []),
    {
      id: "gear",
      label: "Gear",
      /*
       * And not before the equipment has arrived.
       *
       * `unpicked` is computed from the catalogue, so while it is still
       * loading there is nothing unpicked and the step ticked itself — then
       * un-ticked a moment later when the data landed. A step that reports
       * done and then changes its mind is worse than one that waits.
       */
      done:
        klass !== undefined &&
        gear !== null &&
        (gearMode !== "kit" || unpicked.length === 0),
      waiting: waitingOn("both"),
    },
    { id: "review", label: "Review", done: gaps.length === 0, waiting: waitingOn("both") },
  ];
  /*
   * A step that is waiting cannot be done.
   *
   * Said once here rather than repeated into every step's own condition,
   * because it is the same rule each time and the two that got it wrong got
   * it wrong by being written out separately. "Nothing left to choose" is
   * vacuously true when the thing that would offer choices has not been
   * chosen yet.
   */
  const rail = steps.map((s) => (s.waiting ? { ...s, done: false } : s));

  const stepIndex = Math.min(step, steps.length - 1);
  const here = steps[stepIndex]!.id;
  const at = (id: string) => here === id;
  /*
   * Which way the flow just moved, so the next card comes in from the side
   * it should — forwards from the right, back from the left. Anything else
   * reads as the app losing its place.
   */
  const [back, setBack] = useState(false);
  const chrome = useRef<HTMLElement | null>(null);

  const go = (n: number) => {
    const to = Math.max(0, Math.min(steps.length - 1, n));
    setBack(to < stepIndex);
    setStep(to);
  };

  /*
   * And put the top of the step under the eye. A phone keeps its scroll
   * position across a re-render, which on a long step means the next
   * question opens somewhere in the middle of itself.
   */
  useEffect(() => {
    const el = chrome.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 8;
    /*
     * Not smooth. The step itself slides in over 180ms with its own curve,
     * and a smooth scroll is a second motion of a different length running
     * against it — the card lands while the page is still moving under it.
     * One motion carries the step change; this just puts the top of it where
     * the eye already is.
     */
    window.scrollTo({ top, behavior: "auto" });
  }, [here]);

  return (
    <>
      <section className="card cr-chrome" ref={chrome}>
        <div className="card-hd">
          <span className="label">
            {klass ? `${race?.name ?? "Someone"} ${klass.name} ${level}` : "Build a character"}
          </span>
          {/* The summary follows you: the two numbers that move while you
              choose, where you can see them move. */}
          {klass && (
            <span className="cr-vitals">
              <span><b>{hpAtLevel(klass.hitDie as DieSize, mods.con, level)}</b>HP</span>
              <span><b>{10 + mods.dex}</b>AC</span>
              <span><b>{formatModifier(prof)}</b>PROF</span>
            </span>
          )}
          <button onClick={onCancel}>Cancel</button>
        </div>

        {races && classes && (
          <nav className="cr-rail" aria-label="Steps">
            {rail.map((st, i) => (
              <button
                key={st.id}
                className={`cr-node${i === stepIndex ? " on" : ""}${st.done ? " done" : ""}${st.waiting ? " waiting" : ""}`}
                aria-current={i === stepIndex ? "step" : undefined}
                /* The reason lives in the visible note, not here: every suite
                   in the app finds a step by `Step N, Label` exactly, and
                   appending to it would break twenty of them for a sentence
                   that is already on screen. */
                aria-label={`Step ${i + 1}, ${st.label}`}
                onClick={() => go(i)}
              >
                {/*
                  * A tick is a tick on the step you are standing on too.
                  *
                  * This read `st.done && i !== stepIndex`, and it is the whole
                  * of what was written down as "the rail settles": Gear is
                  * done before you reach it, so it showed a tick and then LOST
                  * it when you arrived; Race becomes done while you stand
                  * there answering it, so it showed a number until you left.
                  * One rule, seen from both sides, and neither is a
                  * derivation problem — both were right the entire time.
                  *
                  * Nothing is lost by ticking it: `.on` already puts the dot
                  * in gold, so where you ARE and what is ANSWERED are two
                  * marks rather than one that has to choose. And the step
                  * ticks under the choice that finished it, which is where a
                  * person is looking when they finish it.
                  */}
                <span className="cr-dot">{st.done ? "✓" : i + 1}</span>
                <span className="cr-lb">{st.label}</span>
              </button>
            ))}
          </nav>
        )}

        {(!races || !classes) && (
          <div className="card-body"><p className="faint note">Loading…</p></div>
        )}

        {/*
          * One step, one card, and it arrives.
          *
          * Pressing Continue changed the content under a screen still
          * scrolled to wherever the last question ended, so every step began
          * with a scroll back up to find it. Keyed by the step, so it
          * remounts — which is what makes the animation run.
          */}
        <div className={`cr-steps${back ? " back" : ""}`} key={here}>
        {races && classes && at("class") && (
          <div className="card-body">
            {/* Class first: it is what lets every later step advise. */}
            <span className="label cr-step">1 · Class</span>

            {/*
              * Cards, not a dropdown.
              *
              * A name told you nothing until you picked it and read the
              * paragraph underneath — which is the wrong way round when the
              * paragraph IS the choice. What it plays like and how much it
              * asks of you are both on the card, in two tags and five dots,
              * before you commit to anything.
              *
              * The twelve get cards; the fifty-odd a compendium adds stay in
              * a list underneath, because sixty cards is a scroll, not a
              * choice.
              */}
            <div className="klass-cards">
              {classes.filter((c) => !c.extra).map((c) => {
                const shape = shapeOf(c.id);
                const on = classId === c.id;
                return (
                  <button
                    key={c.id}
                    className={`klass${on ? " on" : ""}`}
                    aria-pressed={on}
                    aria-label={c.name}
                    onClick={() => { setClassId(c.id); setClassSkills([]); }}
                  >
                    <span
                      className="kg"
                      style={shape ? { color: CLASS_HUE[c.id] ?? "inherit" } : undefined}
                    >
                      {shape?.glyph ?? "\u25C7"}
                    </span>
                    <span className="kbody">
                      <span className="nm">{c.name}</span>
                      <span className="kdesc">{CLASS_BLURB[c.id] ?? ""}</span>
                      <span className="ktags">
                        {(shape?.tags ?? []).map((t) => (
                          <span className={`ktag ${t.toLowerCase()}`} key={t}>{t}</span>
                        ))}
                        {shape && (
                          <span className="kcx" aria-label={`Complexity ${shape.complexity} of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <i className={n <= shape.complexity ? "f" : ""} key={n} />
                            ))}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {classes.some((c) => c.extra) && (
              <div className="row mt-3">
                <HomebrewToggle
                  on={homebrew}
                  hidden={classes.filter((c) => c.extra).length}
                  onChange={setHomebrew}
                />
                {homebrew && (
                  <select
                    aria-label="Class"
                    value={classes.find((c) => c.id === classId)?.extra ? classId : ""}
                    style={{ width: "auto", flex: "1 1 160px" }}
                    onChange={(e) => { setClassId(e.target.value); setClassSkills([]); }}
                  >
                    <option value="">{classes.filter((c) => c.extra).length} more…</option>
                    {classes.filter((c) => c.extra).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {klass && (
              <>
                <div className="row mt-2">
                  <span className="label">Starting at level</span>
                  <Num
                    min={1} max={20} value={level}
                    aria-label="Starting level"
                    style={{ width: 78 }}
                    onChange={setLevel}
                  />
                  {level > 1 && (
                    <span className="faint aside">
                      joining a campaign in progress
                    </span>
                  )}
                </div>
                {CLASS_BLURB[klass.id] && (
                  <p className="cr-blurb">{CLASS_BLURB[klass.id]}</p>
                )}
                <p className="cr-note">
                  d{klass.hitDie} hit die · saves in{" "}
                  {klass.saves.map((s) => s.toUpperCase()).join(" and ")}
                  {klass.spellcasting ? " · casts from level 1" : ""}
                </p>
              </>
            )}

          </div>
        )}

        {/*
          * Skills, on their own.
          *
          * They lived inside the class step, under the class's own facts —
          * which made choosing a class and choosing what it trains in look
          * like one question when they are two, and put a sixteen-row table
          * beneath a card you were still reading.
          */}
        {/*
          * Multiclassing, asked HERE rather than at the end.
          *
          * It used to be the last question on the review card, which made
          * every class after the first a footnote: no subclass, no fighting
          * style, no spells, and a Fighter 3 / Wizard 2 who was never
          * offered a spell. Asked before the rest of the flow, the second
          * class gets the same questions the first one does.
          */}
        {races && classes && at("class") && klass && (
          <div className="card-body">
            {classes && (
              <div className="mc">
                <div className="cnt mb-2">
                  <span>Is this character more than one class?</span>
                  <b>{level + extras.reduce((n, c) => n + c.level, 0)}</b>
                </div>

                {extras.map((c, i) => (
                  <div className="mc-row" key={c.id}>
                    <span className="nm">{c.name}</span>
                    <Num
                      min={1} max={19}
                      aria-label={`${c.name} levels`}
                      value={c.level}
                      style={{ width: 70 }}
                      onChange={(n) =>
                        setExtras(extras.map((x, j) => (j === i ? { ...x, level: n } : x)))
                      }
                    />
                    <button
                      aria-label={`Remove ${c.name}`}
                      onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {/* The rule cuts both ways, and people forget the first half. */}
                {mcBlock && (
                  <p className="lv-block mt-2">{mcBlock}</p>
                )}

                <select
                  aria-label="Add a class"
                  value=""
                  className="mt-2"
                  onChange={(e) => {
                    const k = classes.find((x) => x.id === e.target.value);
                    if (!k) return;
                    setExtras([
                      ...extras,
                      {
                        id: k.id as ClassId,
                        name: k.name,
                        hitDie: k.hitDie as DieSize,
                        level: 1,
                      },
                    ]);
                  }}
                >
                  <option value="">add another class…</option>
                  {classes
                    .filter(
                      (k) =>
                        k.id !== klass.id &&
                        !extras.some((x) => x.id === k.id) &&
                        (homebrew || !k.extra),
                    )
                    .map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                </select>
              </div>
            )}

          </div>
        )}

        {races && classes && at("skills") && klass && (
          <div className="card-body">
            <span className="label cr-step">2 · Skills</span>
            <p className="cr-blurb mt-1">
              What a {klass.name.toLowerCase()} trains in. Your background adds
              two more, at the story step.
            </p>
                {klass.skillChoices && (
                  <>
                    {/*
                      * A table, not a wall of chips.
                      *
                      * The consequence of taking a skill IS a number, so the
                      * number is the control: what the ability gives you, what
                      * proficiency adds, and what you end up rolling. Skills a
                      * ${klass.name} cannot train are shown and locked rather
                      * than hidden — "why is Stealth not here" is a question
                      * an absent row cannot answer.
                      */}
                    <div className="cnt mt-3">
                      <span>Proficiency adds to whatever you take</span>
                      <b>{formatModifier(prof)}</b>
                    </div>
                    <table className="skl">
                      <thead>
                        <tr>
                          <th>Skill</th><th>Prof</th><th>Ability</th><th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SKILL_IDS.map((id) => {
                          const offered = klass.skillChoices!.from.some(
                            (label) => skillIdOf(label) === id,
                          );
                          const on = classSkills.includes(id);
                          const ability = SKILLS[id];
                          const total = mods[ability] + (on ? prof : 0);
                          return (
                            <tr
                              key={id}
                              className={`${on ? "on" : ""}${offered ? "" : " shut"}`}
                            >
                              <td>
                                {spaced(id)}
                                <span className="ab">{ability}</span>
                              </td>
                              <td>
                                {offered ? (
                                  <button
                                    className="mark"
                                    aria-pressed={on}
                                    aria-label={`Train ${spaced(id)}`}
                                    onClick={() =>
                                      setClassSkills(
                                        toggle(classSkills, id, klass.skillChoices!.choose),
                                      )
                                    }
                                  >
                                    ✓
                                  </button>
                                ) : (
                                  <span
                                    className="mark"
                                    title={`Not on the ${klass.name} list`}
                                  >
                                    ·
                                  </span>
                                )}
                              </td>
                              <td>{formatModifier(mods[ability])}</td>
                              <td>{formatModifier(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div
                      className={`cnt${classSkills.length === klass.skillChoices.choose ? " full" : ""}`}
                    >
                      <span>Chosen</span>
                      <b>{classSkills.length} of {klass.skillChoices.choose}</b>
                    </div>
                  </>
                )}

            {/*
              * And what the OTHER classes bring, which is not what they would
              * have brought as a first class. A fighter taken at creation has
              * two skills off its list; taken later it has none, and brings
              * shields instead. Three classes grant a skill and the rest do
              * not — see multiclassing.ts.
              */}
            {extras.length > 0 && (
              <div className="mc-brings">
                {extras.map((c) => {
                  const grant = multiclassGrant(c.id);
                  if (!grant) return null;
                  const owed = grant.skills?.choose ?? 0;
                  const taken = mcSkills[c.id] ?? [];
                  const from =
                    grant.skills && grant.skills.from.length > 0
                      ? grant.skills.from
                      : SKILL_IDS;
                  return (
                    <div className="mc-brought" key={c.id}>
                      <p className="cr-note mt-0">
                        {describeGrant(c.name, grant)}
                      </p>
                      {owed > 0 && (
                        <PickList
                          label={`${c.name} skill`}
                          verb="Train"
                          options={from
                            .filter((id) => !classSkills.includes(id) && !bgSkills.includes(id))
                            .map(spaced)}
                          chosen={taken.map(spaced)}
                          max={owed}
                          onChange={(picked) =>
                            setMcSkills({
                              ...mcSkills,
                              [c.id]: picked.map(
                                (nice) =>
                                  SKILL_IDS.find((id) => spaced(id) === nice) ?? (nice as SkillId),
                              ),
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {races && classes && at("race") && (
          <div className="card-body">
            {/* A shipped SRD list is nine long; an imported one is six hundred.
                The filter appears only when the list is long enough to need
                it, so the common case stays a single control. */}
            {hiddenRaces > 0 || homebrew ? (
              <div className="row mb-2">
                <HomebrewToggle on={homebrew} hidden={hiddenRaces} onChange={setHomebrew} />
              </div>
            ) : null}
            {races.length > 20 && (
              <input
                value={raceFilter}
                aria-label="Filter races"
                placeholder={`filter ${races.length} races…`}
                className="mb-2"
                onChange={(e) => setRaceFilter(e.target.value)}
              />
            )}
            <select
              aria-label="Race"
              value={raceId}
              onChange={(e) => {
                setRaceId(e.target.value);
                const r = races.find((x) => x.id === e.target.value);
                setSubraceId(r?.subraces[0]?.id ?? "");
              }}
            >
              <option value="">choose a race…</option>
              {/*
                * Under the book that printed them. "Core" and "from your
                * compendium" was the only split there was, which put a
                * Volo's tabaxi, a Ravnica loxodon and somebody's homebrew in
                * one bucket of two hundred.
                */}
              {byBook(shownRaces, "race").map(([book, list]) => (
                <optgroup key={book} label={book}>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {races.length > 20 && shownRaces.length === 0 && (
              <p className="cr-note">Nothing matches that.</p>
            )}
            {race && blurbFor(race.id, race.traits) && (
              <p className="cr-blurb">{blurbFor(race.id, race.traits)}</p>
            )}
            {race && mechanicalTraits(race.traits).length > 0 && (
              <>
                <button
                  className="cr-what"
                  aria-expanded={raceWhat}
                  onClick={() => setRaceWhat((v) => !v)}
                >
                  {raceWhat ? "Hide what this gives you" : "What does this give me?"}
                </button>
                {raceWhat && (
                  <div className="cr-abils-help">
                    {mechanicalTraits(race.traits).map((t) => (
                      <p key={t.name}>
                        <b>{t.name}</b> {t.desc}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
{/*
              * Subraces went through none of this: no switch, no headings.
              * A human offered "Mark of Finding" and "Mark of Finding (WGtE)"
              * one after the other — the same dragonmark twice, once from
              * Eberron and once from the playtest that preceded it — with
              * somebody's "Umbral (TP)" underneath.
              */}
            {race && race.subraces.length > 0 && (() => {
              const own = race.subraces.filter((s) => isCore(s.name));
              const shown = homebrew || own.length === 0 ? race.subraces : own;
              const hidden = race.subraces.length - own.length;
              return (
                <>
                  <select
                    aria-label="Subrace"
                    value={subraceId}
                    className="mt-2"
                    onChange={(e) => setSubraceId(e.target.value)}
                  >
                    {byBook(shown, "race").map(([book, list]) => (
                      <optgroup key={book} label={book}>
                        {list.map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {hidden > 0 && (
                    <div className="row mt-2">
                      <HomebrewToggle on={homebrew} hidden={hidden} onChange={setHomebrew} />
                    </div>
                  )}
                </>
              );
            })()}

            {/*
              * The half the race leaves to you.
              *
              * A half-elf gets +2 Charisma and two more points of their own
              * choosing; a variant human gets nothing fixed, two free points,
              * a skill and a feat. The builder applied the fixed half and
              * dropped the rest, so a half-elf arrived two points short of
              * what the book says — on the one screen whose whole job is
              * showing consequences.
              */}
            {/* What the race casts. Stated where it is granted, because a
                spell appearing on the sheet from nowhere is a mystery. */}
            {race && hasInnate(innate) && (
              <div className="cnt block mt-4">
                <span className="label">{race.name} casts</span>
                <p className="cr-note mt-1">
                  {innateAt(innate, level).map((g) => g.name).join(", ") || "nothing yet"}
                  {innate.spells.some((g) => g.level > level) && (
                    <>
                      {" · later: "}
                      {innate.spells
                        .filter((g) => g.level > level)
                        .map((g) => `${g.name} at ${g.level}`)
                        .join(", ")}
                    </>
                  )}
                  {innate.choices.length > 0 && (
                    <>
                      {" · and "}
                      {innate.choices
                        .map((c) => `${c.count} ${c.list} cantrip${c.count === 1 ? "" : "s"} of your choice, under Spells`)
                        .join("; ")}
                    </>
                  )}
                </p>
              </div>
            )}

            {race && freeBonus && (
              <>
                <div className="cnt mt-4">
                  <span>
                    {race.name} leaves {freeBonus.count} point
                    {freeBonus.count === 1 ? "" : "s"} to you
                  </span>
                  <b>{freeSpent} of {freeOwed}</b>
                </div>
                <div className="chips">
                  {ABILITIES.map((a) => {
                    const got = freeBonuses[a] ?? 0;
                    return (
                      <button
                        key={a}
                        className={`chip${got > 0 ? " on" : ""}`}
                        aria-pressed={got > 0}
                        aria-label={`Raise ${a}`}
                        disabled={got === 0 && freeSpent >= freeOwed}
                        onClick={() =>
                          setFreeBonuses((cur) => {
                            if ((cur[a] ?? 0) > 0) {
                              const next = { ...cur };
                              delete next[a];
                              return next;
                            }
                            // Different abilities, so one each rather than
                            // stacking — which is what the rules say.
                            return { ...cur, [a]: freeBonus.each };
                          })
                        }
                      >
                        {a} {got > 0 ? `+${got}` : ""}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {freeSkills > 0 && (
              <>
                <div className="cnt mt-4">
                  <span>and {freeSkills} skill{freeSkills === 1 ? "" : "s"} of your choice</span>
                  <b>{raceSkills.length} of {freeSkills}</b>
                </div>
                <div className="chips">
                  {SKILL_IDS.map((sk) => {
                    const on = raceSkills.includes(sk);
                    return (
                      <button
                        key={sk}
                        className={`chip${on ? " on" : ""}`}
                        aria-pressed={on}
                        aria-label={`Race skill ${spaced(sk)}`}
                        onClick={() => setRaceSkills(toggle(raceSkills, sk, freeSkills))}
                      >
                        {spaced(sk)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {offersFeat && (
              <>
                <div className="cnt mt-4">
                  <span>and a feat, at level one</span>
                  <b>{raceFeat ? "taken" : "0 of 1"}</b>
                </div>
                <FeatPick
                  feats={featList}
                  who={aspirant}
                  {...(raceFeat ? { taken: raceFeat.id } : {})}
                  onPick={(f) => setRaceFeat(f ? { id: f.id, name: f.name } : null)}
                />
              </>
            )}
          </div>
        )}
        </div>
      </section>

      <div className={`cr-steps${back ? " back" : ""}`} key={`late-${here}`}>
      {at("abilities") && klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">3 · Ability scores</span>
            <span className="seg">
              {(["array", "pointBuy", "rolled"] as ScoreMethod[]).map((m) => (
                <button
                  key={m}
                  aria-pressed={method === m}
                  className={method === m ? "on" : ""}
                  onClick={() => resetScores(m)}
                >
                  {m === "array" ? "Array" : m === "pointBuy" ? "Point buy" : "Roll"}
                </button>
              ))}
            </span>
          </div>

          {klass && describePriority(klass.name, PRIORITY[klass.id as ClassId]) && (
            <p className="cr-blurb" style={{ padding: "0 16px" }}>
              {describePriority(klass.name, PRIORITY[klass.id as ClassId])}
            </p>
          )}
          {/* On request, not by default: six explanations at once is the wall
              of text the turn menu already had to be rescued from. */}
          <div style={{ padding: "0 16px" }}>
            <button
              className="cr-what"
              aria-expanded={whatDo}
              onClick={() => setWhatDo((v) => !v)}
            >
              {whatDo ? "Hide what these do" : "What do these do?"}
            </button>
            {whatDo && (
              <div className="cr-abils-help">
                {ABILITIES.map((a) => (
                  <p key={a}>
                    <b>{abilityName(a)}</b> {ABILITY_BLURB[a]}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="cr-scores">
            <div className="cr-assign">
              {method === "rolled" && rolled.length < 6 && (
                <div className="cr-roll">
                  <p className="cr-note mt-0">
                    Roll <strong>4d6</strong>, drop the lowest, and tap each total.
                    {" "}{6 - rolled.length} to go.
                  </p>
                  <div className="cr-pad">
                    {Array.from({ length: 16 }, (_, i) => i + 3).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          const next = [...rolled, v];
                          setRolled(next);
                          if (next.length === 6) setPool(next);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {method !== "pointBuy" && pool.length > 0 && (
                <div className="cr-pool">
                  {pool.map((v, i) => (
                    <button
                      key={i}
                      className={`chipv${picked === i ? " on" : ""}`}
                      aria-label={`Value ${v}`}
                      aria-pressed={picked === i}
                      onClick={() => setPicked(picked === i ? null : i)}
                    >
                      {v}
                    </button>
                  ))}
                  <span className="faint aside">
                    tap a value, then an ability
                  </span>
                </div>
              )}

              {ABILITIES.map((a) => {
                const base = method === "pointBuy" ? buy[a] : assigned[a];
                /*
                 * Every racial term, not just the fixed ones. A half-elf who
                 * spent their two free points and saw no change here would
                 * reasonably conclude the app had lost them.
                 */
                const bonus =
                  (raceChoice?.abilityBonuses[a] ?? 0) +
                  (raceChoice?.subraceBonuses?.[a] ?? 0) +
                  (raceChoice?.freeBonuses?.[a] ?? 0);
                return (
                  <div className={`cr-ab${base === undefined ? " empty" : ""}`} key={a}>
                    <button
                      className="cr-name"
                      disabled={method === "pointBuy"}
                      onClick={() => {
                        if (method === "pointBuy") return;
                        if (base !== undefined) {
                          setPool([...pool, base]);
                          setAssigned({ ...assigned, [a]: undefined });
                          return;
                        }
                        if (picked === null) return;
                        setAssigned({ ...assigned, [a]: pool[picked] });
                        setPool(pool.filter((_, i) => i !== picked));
                        setPicked(null);
                      }}
                    >
                      {a}
                    </button>
                    {method === "pointBuy" ? (
                      <span className="step">
                        <button
                          aria-label={`Lower ${a}`}
                          disabled={buy[a] <= POINT_BUY_MIN}
                          onClick={() => setBuy({ ...buy, [a]: buy[a] - 1 })}
                        >−</button>
                        <span className="ct num">{buy[a]}</span>
                        <button
                          aria-label={`Raise ${a}`}
                          disabled={!canAfford(buy, a, buy[a] + 1)}
                          onClick={() => setBuy({ ...buy, [a]: buy[a] + 1 })}
                        >+</button>
                      </span>
                    ) : (
                      <span className="cr-val num">{base ?? "—"}</span>
                    )}
                    {/* Shown as a separate term: "15 + 2", never a mystery 17. */}
                    <span className="cr-bonus num">{bonus > 0 ? `+ ${bonus}` : ""}</span>
                    <span className="cr-total num">
                      {base === undefined ? "—" : scores[a]}
                      <span className="cr-mod">{base === undefined ? "" : formatModifier(mods[a])}</span>
                    </span>
                  </div>
                );
              })}

              <div className="row mt-3">
                <button onClick={recommend}>Recommend</button>
                <button onClick={() => resetScores(method)}>Clear</button>
                {method === "pointBuy" && (
                  <span className="faint aside num">
                    {POINT_BUY_BUDGET - pointsSpent(buy)} of {POINT_BUY_BUDGET} left
                  </span>
                )}
              </div>
            </div>

            {/* The consequences, so nobody has to be told what Dexterity does. */}
            <div className="cr-conseq">
              <div className="cr-grid">
                <div><span className="l">Armour class</span><span className="v num">{10 + mods.dex}</span></div>
                <div><span className="l">Hit points</span><span className="v num">{hpAtLevel(klass.hitDie as DieSize, mods.con, level)}</span></div>
                <div><span className="l">Initiative</span><span className="v num">{formatModifier(mods.dex)}</span></div>
                <div><span className="l">Speed</span><span className="v num">{race.speed}</span></div>
              </div>
              {level > 1 && (
                <p className="cr-note mt-0">
                  Level {level}: average hit points per level, proficiency{" "}
                  {formatModifier(prof)}
                  {atLevel?.slots.length ? `, slots ${atLevel.slots.join("/")}` : ""}
                  {asi > 0 ? ` · ${asi} ability points to spend in your builder` : ""}.
                </p>
              )}
              <span className="label cr-sub">Skills you are proficient in</span>
              {[...new Set([...classSkills, ...bgSkills, ...Object.values(mcSkills).flat()])].map((s) => (
                <div className="cr-srow" key={s}>
                  <span>{spaced(s)}<span className="faint"> {SKILLS[s]}</span></span>
                  <span className="num">{formatModifier(mods[SKILLS[s]] + prof)}</span>
                </div>
              ))}
              {classSkills.length + bgSkills.length === 0 && (
                <p className="faint note">None yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {at("background") && klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">4 · Background</span>
            <span className="faint aside">{bgSkills.length} of 2 skills</span>
          </div>
          <div className="card-body">
            {/* Imported backgrounds fill in the name and the skills; the
                custom route stays underneath, because a table invents one
                more often than it looks one up. */}
            {(hiddenBackgrounds > 0 || homebrew) && (
              <div className="row mb-2">
                <HomebrewToggle on={homebrew} hidden={hiddenBackgrounds} onChange={setHomebrew} />
              </div>
            )}
            {backgrounds.length > 0 && (
              <>
                <input
                  value={bgFilter}
                  aria-label="Filter backgrounds"
                  placeholder={`filter ${backgrounds.length} backgrounds…`}
                  onChange={(e) => setBgFilter(e.target.value)}
                />
                <select
                  aria-label="Background"
                  value={bgId}
                  className="mt-2"
                  onChange={(e) => {
                    const b = backgrounds.find((x) => x.id === e.target.value);
                    setBgId(e.target.value);
                    if (!b) return;
                    setBgName(b.name);
                    // Only the skills this app knows how to score. A
                    // background naming a tool proficiency keeps its name and
                    // loses nothing the sheet was going to show.
                    setBgSkills(
                      b.skills
                        .map((n) => skillIdOf(n))
                        .filter((x): x is SkillId => x !== undefined)
                        .slice(0, 2),
                    );
                  }}
                >
                  <option value="">choose one, or make your own below…</option>
                  {byBook(shownBackgrounds, "background").map(([book, list]) => (
                    <optgroup key={book} label={book}>
                      {list.map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </>
            )}
            {(() => {
              const chosen = backgrounds.find((x) => x.id === bgId);
              const feature = featureOf(chosen?.traits);
              if (!chosen) return null;
              return (
                <>
                  {blurbFor(chosen.id, chosen.traits, {}) && (
                    <p className="cr-blurb">{blurbFor(chosen.id, chosen.traits, {})}</p>
                  )}
                  {feature && (
                    <p className="cr-note">
                      <b>{feature.name}</b> {feature.desc.slice(0, 220)}
                      {feature.desc.length > 220 ? "…" : ""}
                    </p>
                  )}
                </>
              );
            })()}
            <p className="cr-note" style={{ marginTop: backgrounds.length > 0 ? 12 : 0 }}>
              {backgrounds.length > 0
                ? "Or make one up — two skills and a name is all a background mechanically is."
                : "The SRD ships one background, so this builder offers a custom one instead — two skills and a name. That is all a background mechanically is."}
            </p>
            {/* The last chip wall on this step. Same control as the two
                beneath it, so the step has one shape rather than three. */}
            <PickList
              label="Skills"
              verb="Train"
              options={SKILL_IDS.map(spaced)}
              chosen={bgSkills.map(spaced)}
              max={2}
              onChange={(next) =>
                setBgSkills(
                  next
                    .map((n) => SKILL_IDS.find((id) => spaced(id) === n))
                    .filter((x): x is SkillId => x !== undefined),
                )
              }
            />

            <input
              value={bgName}
              aria-label="Background name"
              placeholder="Greenwarden's apprentice"
              className="mt-3"
              onChange={(e) => setBgName(e.target.value)}
            />
          </div>
        </section>
      )}

      {/*
        * Languages and tools. The builder asked for everything else and then
        * produced a character who spoke nothing and could use nothing — the
        * data was read out of the compendium and dropped on the floor.
        *
        * What the race and class hand over is shown as given, not as a
        * choice; only what is actually chosen is offered. A background is
        * two of either, which is the rule and also why they share one card.
        */}
      {at("background") && klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">5 · Languages &amp; tools</span>
            <span className="faint aside">
              {pickedLangs.length + pickedTools.length} of {langPicks + toolPicks}
            </span>
          </div>
          <div className="card-body">
            {(raceLangs.known.length > 0 || classTools.known.length > 0) && (
              <>
                <p className="cr-note mt-0">
                  {race.name} gives you{" "}
                  <b>{raceLangs.known.join(", ") || "no language"}</b>
                  {classTools.known.length > 0 && (
                    <> and a {klass.name.toLowerCase()} can use <b>{classTools.known.join(", ")}</b></>
                  )}.
                </p>
              </>
            )}
            {raceLangs.stated && <p className="cr-note">{raceLangs.stated}</p>}

            {/*
              * What the background gives, in its own words. It is not a pool
              * of two to spend either way: the book decides, and a criminal
              * who came away speaking Draconic and knowing no trade was this
              * screen inventing a rule.
              */}
            {bgName.trim() !== "" && (
              <p className="cr-note">{describeGrants(bgGives, bgName)}</p>
            )}

            <p className="cr-blurb mt-2">
              {langPicks + toolPicks > 0
                ? `${[
                    langPicks > 0 ? `${langPicks} language${langPicks === 1 ? "" : "s"}` : "",
                    toolPicks > 0 ? `${toolPicks} tool${toolPicks === 1 ? "" : "s"}` : "",
                  ]
                    .filter(Boolean)
                    .join(" and ")} to choose.`
                : "Nothing to choose here — your race, class and background have said it all."}
            </p>

            {/*
              * Two lists, closed. Sixteen languages and fifty-three tools laid
              * out at once made this step three and a half screens tall — and
              * eighty-odd chips is not a choice, it is a search with no search
              * box. What was chosen reads on the closed row, because that is
              * the answer; the list is only how you got there.
              */}
            {/*
              * A picker only where there is something to pick.
              *
              * A sage gets two languages and no tools, and the card says so —
              * but the tools list was still sitting underneath offering
              * fifty-four of them with an allowance of zero, which reads as
              * a choice somebody forgot to make.
              */}
            {langPicks > 0 && (
              <PickList
                label="Languages"
                verb="Speak"
                options={ALL_LANGUAGES.filter((l) => !raceLangs.known.includes(l))}
                chosen={pickedLangs}
                max={langPicks}
                onChange={setPickedLangs}
              />
            )}
            {toolAsks.map((ask) => (
              <PickList
                key={ask.id}
                label={labelFor(ask.kinds)}
                verb="Use"
                options={optionsForAsk(ask.kinds)}
                chosen={toolsByAsk[ask.id] ?? []}
                max={ask.max}
                onChange={(next) =>
                  setToolsByAsk((prev) => ({ ...prev, [ask.id]: next }))
                }
                {...(ask.note ? { note: ask.note } : {})}
              />
            ))}
          </div>
        </section>
      )}

      {/*
        * Who they are, as opposed to what they can do.
        *
        * The builder asked for every number a character has and never once
        * asked this — which is the difference between a build and somebody's
        * character. None of it is required: a blank one is a character too,
        * and these usually turn up at the table rather than before it.
        */}
      {at("background") && klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">6 · Who are they?</span>
            <span className="faint aside">optional</span>
          </div>
          <div className="card-body">
            <div className="row mb-3">
              <span className="label">Alignment</span>
              <select
                aria-label="Alignment"
                value={identity.alignment ?? ""}
                style={{ width: "auto" }}
                onChange={(e) => setIdentity({ ...identity, alignment: e.target.value })}
              >
                <option value="">not yet</option>
                {ALIGNMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {IDENTITY_FIELDS.map(([key, label, hint]) => {
              const value = identity[key] ?? "";
              return (
                <div className="who-say" key={key}>
                  <label>
                    <span className="label">{label}</span>
                    <span className="who-ct">{value.length} / 120</span>
                  </label>
                  <textarea
                    aria-label={label}
                    maxLength={120}
                    placeholder={hint}
                    value={value}
                    onChange={(e) => setIdentity({ ...identity, [key]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Its own step rather than buried in the ability-score block, where it
          was invisible until two unrelated questions had been answered. Last
          in the flow because it is the least consequential thing here. */}
      {at("gear") && klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">5 · Equipment</span>
            <span className="faint aside">
              {gearMode === "gold" ? "buying your own" : `${starting.items.length} items`}
            </span>
          </div>
          <div className="card-body">
          {/* Starting equipment belongs in creation, not after it: a
              character who arrives with nothing is one the first fight
              cannot use. The book writes the choices as prose, so they
              are taken apart rather than shown as a paragraph to obey. */}
          {gear !== null && (hasKit || wealthFor(klass.id, klass.wealth) > 0) ? (
            <div className="gear-step">
              <span className="label cr-sub">Starting equipment</span>
              <div className="seg">
                <button
                  aria-pressed={gearMode === "kit"}
                  className={gearMode === "kit" ? "on" : ""}
                  onClick={() => setGearMode("kit")}
                >
                  Take the kit
                </button>
                <button
                  aria-pressed={gearMode === "gold"}
                  className={gearMode === "gold" ? "on" : ""}
                  onClick={() => setGearMode("gold")}
                >
                  Buy your own
                </button>
              </div>

              {gearMode === "gold" ? (
                <p className="cr-note">
                  {describeWealthFor(klass.id, klass.wealth)} to spend — you start
                  with <b>{formatCoins(wealthFor(klass.id, klass.wealth))}</b> and
                  nothing else. Buy it under Gear once you are in.
                  {!hasKit && " This class has no kit written down, so this is the only route."}
                </p>
              ) : (
                <>
                  {fixedGear.length > 0 && (
                    <p className="cr-note">
                      Comes with{" "}
                      {fixedGear
                        .map((p) => {
                          const st = toStack(p);
                          return st ? (st.qty > 1 ? `${st.qty} × ${st.name}` : st.name) : "";
                        })
                        .filter(Boolean)
                        .join(", ")}.
                    </p>
                  )}
                  {choices2.map((opts, i) => {
                    const taken = picks[i] ?? opts[0]?.letter;
                    const chosen = opts.find((o) => o.letter === taken);
                    return (
                      <div className="gear-choice" key={i}>
                        <div className="chips">
                          {opts.map((o) => (
                            <button
                              key={o.letter}
                              className={`chip${o.letter === taken ? " on" : ""}`}
                              aria-pressed={o.letter === taken}
                              onClick={() => setPicks({ ...picks, [i]: o.letter })}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        {chosen?.phrases.map((p, j) =>
                          p.kind === "category" ? (
                            <select
                              key={j}
                              aria-label={`Choose ${p.label}`}
                              value={catPicks[`${i}:${j}`] ?? ""}
                              onChange={(e) =>
                                setCatPicks({ ...catPicks, [`${i}:${j}`]: e.target.value })
                              }
                            >
                              <option value="">which {p.label}…</option>
                              {(gear ?? [])
                                .filter(
                                  (it) =>
                                    it.category === "weapon" &&
                                    it.weaponCategory === p.weaponCategory &&
                                    (p.weaponRange === undefined || it.weaponRange === p.weaponRange),
                                )
                                .map((it) => (
                                  <option key={it.id} value={it.id}>{it.name}</option>
                                ))}
                            </select>
                          ) : null,
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : null}
          </div>
        </section>
      )}

      {at("abilities") && klass && race && classChoices.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">6 · Your class</span>
            <span className="faint aside">
              {classChoices.filter((c) => classPicks[c.of]).length} of {classChoices.length}
            </span>
          </div>
          <div className="card-body">
            {classChoices.map((c) => {
              /*
               * The switch reaches here too. Three quarters of the archetypes
               * a complete compendium offers are somebody else's, and a
               * builder that hides them everywhere except the one dropdown
               * where you choose your subclass is not hiding them.
               */
              /*
               * On the FULL name, marker and all. The display name has its
               * trailing parenthetical stripped for the menu, so filtering on
               * it meant every homebrew archetype read as the game's own —
               * this switch was here all along and matched nothing. A ranger
               * was offered sixty-three subclasses; eight are official.
               */
              const allowed = c.options.filter((o) => homebrew || isCore(o.full));
              /*
               * How many the switch is ABOUT, not how many it is hiding right
               * now — otherwise turning it on makes it vanish, and there is
               * no way back to the game's own list.
               */
              const marked = c.options.filter((o) => !isCore(o.full)).length;
              /* The picker does its own filtering, so it takes the list the
                 compendium switch allows and searches inside that. */
              const offered = allowed.length > 0 ? allowed : c.options;
              return (
                <div className="chooser" key={c.of}>
                  <div className="chooser-hd" style={{ cursor: "default" }}>
                    <span className="nm">{c.of}</span>
                    <span className="faint num">level {c.level}</span>
                  </div>
                  <div className="chooser-body">
                    {/*
                      * A list you can read, not a dropdown of names.
                      *
                      * A subclass IS its description — "Path of the
                      * Battlerager" is not a choice; what a Battlerager does
                      * is the choice. The text was there all along and the
                      * builder showed it only AFTER you committed, so
                      * comparing nine paths meant nine round trips.
                      */}
                    <SubclassPick
                      of={c.of}
                      options={offered}
                      hidden={marked}
                      homebrew={homebrew}
                      onHomebrew={setHomebrew}
                      {...(classPicks[c.of] ? { taken: classPicks[c.of] } : {})}
                      onPick={(name) =>
                        setClassPicks((p) => ({ ...p, [c.of]: name ?? "" }))
                      }
                    />
                  </div>
                </div>
              );
            })}
            {/* Recorded, never mechanised — the app cannot know what
                eighty-five domains do, and half-applying them would be worse
                than being clear that it applies none. */}
            <p className="faint note">
              Written on your sheet. What each one grants is yours to read and
              tell the table.
            </p>
          </div>
        </section>
      )}

      {/*
        * Improvements a character has already passed. The builder was stating
        * "4 ability points to spend in your builder" and giving nowhere to
        * spend them — a promise the screen made and did not keep.
        */}
      {at("abilities") && klass && race && earnedLevels.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">6 · Improvements</span>
            <span className="faint aside">
              {earnedLevels.filter((l) => spentAt(l)).length} of {earnedLevels.length} taken
            </span>
          </div>
          <div className="card-body">
            <p className="cr-blurb mt-0">
              Starting at {level} means you have already passed{" "}
              {earnedLevels.length === 1 ? "an improvement" : `${earnedLevels.length} improvements`}.
              Two points each, or a feat instead.
            </p>
            {earnedLevels.map((lvl) => {
              const at = improvements[lvl] ?? {};
              const used = Object.values(at.abilities ?? {}).reduce((n, v) => n + (v ?? 0), 0);
              return (
                <div className="chooser" key={lvl}>
                  <div className="chooser-hd" style={{ cursor: "default" }}>
                    <span className="nm">Level {lvl}</span>
                    <span className="faint num">
                      {at.feat ? at.feat.name : `${used} of 2`}
                    </span>
                  </div>
                  <div className="chooser-body">
                    <div className="lv-abils">
                      {ABILITIES.map((a) => {
                        const added = at.abilities?.[a] ?? 0;
                        // Already counted in `scores`, so this IS the total.
                        const total = scores[a];
                        return (
                          <button
                            key={a}
                            className={`chip${added > 0 ? " on" : ""}`}
                            /*
                             * Two points, full stop — and once they are
                             * spent, tapping a raised one gives a point
                             * back. A mistap used to be permanent: every
                             * chip disabled, nothing to press, and no way
                             * back short of starting the character again.
                             */
                            disabled={
                              at.feat !== undefined
                              || (used >= 2 && added === 0)
                              || (total >= 20 && added === 0)
                            }
                            aria-label={
                              used >= 2 && added > 0
                                ? `Level ${lvl} take back ${a}`
                                : `Level ${lvl} raise ${a}`
                            }
                            onClick={() =>
                              setImprovements((cur) => {
                                const now = cur[lvl]?.abilities ?? {};
                                const has = now[a] ?? 0;
                                const spent = Object.values(now).reduce(
                                  (n, v) => n + (v ?? 0), 0,
                                );
                                // Full, and this one is raised: give it back.
                                const next = spent >= 2 && has > 0 ? has - 1 : has + 1;
                                const abilities = { ...now, [a]: next };
                                if (next === 0) delete abilities[a];
                                return { ...cur, [lvl]: { abilities } };
                              })
                            }
                          >
                            {a} {total}
                          </button>
                        );
                      })}
                    </div>
                    {/* Names alone are not a choice — a feat IS its
                        description, and this was eight hundred and fifty of
                        them in a dropdown. */}
                    <FeatPick
                      feats={featList}
                      who={aspirant}
                      {...(at.feat ? { taken: at.feat.id } : {})}
                      onPick={(f) =>
                        setImprovements((cur) => ({
                          ...cur,
                          /*
                           * A half-feat's +1 is applied here, through the same
                           * path an ability improvement uses — the feat itself
                           * stays recorded rather than mechanised, and the one
                           * number it moves actually moves.
                           */
                          [lvl]: f
                            ? {
                                feat: { id: f.id, name: f.name },
                                ...(effectsOf(f).increase
                                  ? { abilities: { [effectsOf(f).increase!]: 1 } }
                                  : {}),
                                ...(effectsOf(f).saveProficiency
                                  ? { save: effectsOf(f).saveProficiency }
                                  : {}),
                              }
                            : {},
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Only for casters, and only as many as the class table allows. The
          counts are the point: a wizard is told three cantrips and six
          spells, not left to remember it. */}
      {at("spells") && klass && race && castsAtAll && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">6 · Spells</span>
            <span className="faint aside">
              {cantripsKnown > 0 && `${pickedCantrips} of ${cantripsKnown} cantrips`}
              {cantripsKnown > 0 && (spellsKnown > 0 || hasSlots) && " · "}
              {/* A prepared caster has no "spells known" and the table says so
                  by leaving it at zero. Counting up rather than down is the
                  honest way to show a limit that does not exist. */}
              {spellsKnown > 0
                ? `${pickedSpells} of ${spellsKnown} spells`
                : hasSlots && `${pickedSpells} spells`}
            </span>
          </div>
          <div className="card-body">
            {casters.length > 1 && (
              /*
               * Two casting classes, two lists, one allowance shown. Which
               * spell came from which class is a line on a sheet rather than
               * a rule the app can check — a wizard/cleric picks from both
               * books, and the counts are what the tables say.
               */
              <p className="cr-note mt-0">
                Both lists are offered:{" "}
                <b>{casters.map((c) => `${c.name} ${c.level}`).join(" and ")}</b>. The
                allowance is the two added together; which class each spell
                came from is yours to note.
              </p>
            )}
            {book.length === 0 ? (
              <p className="cr-note mt-0">
                No spell list on this device. The SRD data shipped here has
                none — a compendium provides it, and you can pick spells later
                under Spells.
              </p>
            ) : (
              <>
                {book.some((sp) => !isCore(sp.name)) && (
                  <div className="row mb-2">
                    <HomebrewToggle
                      on={homebrew}
                      hidden={book.filter((sp) => !isCore(sp.name)).length}
                      onChange={setHomebrew}
                    />
                  </div>
                )}
                {chosenSpells.length > 0 && (
                  <div className="chips mb-2">
                    {casters.flatMap((c) =>
                      (chosenByClass[c.id] ?? []).map((sp) => (
                        <button
                          key={`${c.id}:${sp.id}`}
                          className="chip on"
                          aria-label={`Remove ${sp.name}`}
                          onClick={() =>
                            setChosenByClass({
                              ...chosenByClass,
                              [c.id]: (chosenByClass[c.id] ?? []).filter((x) => x.id !== sp.id),
                            })
                          }
                        >
                          {sp.name}
                        </button>
                      )),
                    )}
                  </div>
                )}

                {/*
                  * Two pickers rather than one list. A sorcerer can cast
                  * hundreds of things, and a single flat list ran off the
                  * bottom of the card — you cannot choose three cantrips from
                  * a page you are still scrolling. Each opens on its own,
                  * carries its own search, and scrolls inside a fixed height
                  * so the step stays the same size whatever the class.
                  */}
                {casters.flatMap((caster) =>
                  ([["cantrip", "Cantrips"], ["spell", "Spells"]] as const).map(([kind, label]) => {
                  const isCantrip = kind === "cantrip";
                  if (isCantrip && caster.cantrips === 0) return null;
                  if (!isCantrip && !caster.slots && caster.known === 0) return null;

                  // Keyed by class as well as kind: two casters, four pickers.
                  const key = `${caster.id}:${kind}`;
                  const mine = chosenByClass[caster.id] ?? [];
                  const open = openPicker === key;
                  const taken = mine.filter((sp) =>
                    isCantrip ? sp.level === 0 : sp.level > 0,
                  ).length;
                  const limit = isCantrip ? caster.cantrips : caster.known;
                  const full = limit > 0 && taken >= limit;
                  /*
                   * Capped per picker, not across both. Capping the shared
                   * list first was silently fatal with a complete compendium:
                   * sorted by level, the first eighty entries are ALL
                   * cantrips, so a wizard choosing their first spells was
                   * offered an empty list and no reason for it.
                   */
                  const rows = spellsFor(caster.id, topSlotOf(caster.id, caster.level))
                    .filter((sp) => (isCantrip ? sp.level === 0 : sp.level > 0))
                    .slice(0, 80);

                  return (
                    <div className="chooser" key={key}>
                      <button
                        className={`chooser-hd${open ? " open" : ""}`}
                        aria-expanded={open}
                        aria-label={`${
                          casters.length > 1 ? `${caster.name} ` : ""
                        }${label}, ${taken}${limit > 0 ? ` of ${limit}` : ""} chosen`}
                        onClick={() => {
                          setOpenPicker(open ? null : key);
                          setSpellFilter("");
                        }}
                      >
                        <span className="nm">
                          {casters.length > 1 ? `${caster.name} · ${label}` : label}
                        </span>
                        <span className="faint num">
                          {limit > 0 ? `${taken} of ${limit}` : `${taken} chosen`}
                        </span>
                        <span className="chooser-mark">{open ? "−" : "+"}</span>
                      </button>

                      {open && (
                        <div className="chooser-body">
                          <input
                            value={spellFilter}
                            aria-label={`Filter ${label.toLowerCase()}`}
                            placeholder={`filter ${rows.length} ${label.toLowerCase()}…`}
                            onChange={(e) => setSpellFilter(e.target.value)}
                          />
                          <div className="chooser-list">
                            {/* Names alone are not a choice: "Faerie Fire"
                                means nothing to somebody picking their first
                                cantrips, and the file has carried the
                                description all along. */}
                            <SpellPick
                              spells={rows}
                              actionLabel="Take it"
                              {...(full ? { disabled: () => `That is all ${limit}.` } : {})}
                              onPick={(sp) =>
                                setChosenByClass({
                                  ...chosenByClass,
                                  [caster.id]: [...mine, toKnown(sp)],
                                })
                              }
                            />
                          </div>
                          {full && (
                            <p className="faint note">
                              That is all {limit}. Remove one above to swap.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  }),
                )}

                <p className="faint note">
                  {spellsKnown === 0 && hasSlots
                    ? `A ${klass.name.toLowerCase()} prepares from a book rather than knowing a fixed few, so there is no number to hit here. Take what you like, or leave it — the Spells tab does the same job afterwards.`
                    : "Take what you like now or leave it — the Spells tab does the same job afterwards."}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/*
        * The review. A form you have filled in is not a character until
        * something reads it back to you as one.
        */}
      {at("review") && klass && race && (
        <section className="card cr-review">
          <div className="card-hd">
            <span className="label">Your hero</span>
            <span className="faint aside">
              nothing is saved until you say so
            </span>
          </div>
          <div className="card-body">
            <input
              value={name}
              aria-label="Character name"
              placeholder="Kira Vance"
              onChange={(e) => setName(e.target.value)}
            />

            <div className="rv-who">
              <span className="rv-crest">{shapeOf(klass.id)?.glyph ?? "\u25C7"}</span>
              <span>
                <span className="rv-nm">{name.trim() || "Unnamed"}</span>
                <span className="rv-sub">
                  {raceChoice?.subraceName ? `${raceChoice.subraceName} ` : ""}
                  {race.name} · {klass.name} {level}
                  {bgName.trim() ? ` · ${bgName.trim()}` : ""}
                </span>
              </span>
            </div>

            {(identity.ideals || identity.personality) && (
              <p className="rv-quote">
                &ldquo;{identity.ideals || identity.personality}&rdquo;
              </p>
            )}

            <div className="rv-abils">
              {ABILITIES.map((a) => (
                <div key={a}>
                  <b>{scores[a]}</b>
                  <span>{a}</span>
                  <em>{formatModifier(mods[a])}</em>
                </div>
              ))}
            </div>

            {/*
              * More than one class, added at the end.
              *
              * Every screen before this one answers a single class's
              * questions — which is what makes them legible — and a rebuild
              * happens in this order anyway: you know you are a Fighter 5 /
              * Warlock 3, so you build the fighter and add the warlock.
              */}
            <div className="rv-cols">
              <div>
                <span className="label">Trained in</span>
                <p>
                  {[...new Set([...classSkills, ...bgSkills, ...Object.values(mcSkills).flat()])]
                    .map(spaced)
                    .join(", ") || "—"}
                </p>
              </div>
              <div>
                <span className="label">Hit points</span>
                <p>{hpAtLevel(klass.hitDie as DieSize, mods.con, level)} · d{klass.hitDie} hit die</p>
              </div>
              {gather(raceLangs.known, pickedLangs).length > 0 && (
                <div>
                  <span className="label">Speaks</span>
                  <p>{gather(raceLangs.known, pickedLangs).join(", ")}</p>
                </div>
              )}
              {chosenSpells.length > 0 && (
                <div>
                  <span className="label">Knows</span>
                  <p>{chosenSpells.map((sp) => sp.name).join(", ")}</p>
                </div>
              )}
            </div>

            <div className="row mt-3">
              <span className="faint aside">
                {gaps.length > 0 ? `Still needed: ${gaps.join(", ")}.` : "Ready to play."}
              </span>
            </div>
          </div>
        </section>
      )}

      </div>

      {/*
        * Back and on — and, on the last step, the thing that finishes.
        *
        * The primary button used to go dead on the review step while the
        * control that actually created the character sat in the card above
        * it. It was still gold, still the biggest thing on the screen, and
        * pressing it did nothing at all.
        */}
      {/*
        * A step you cannot answer yet says why.
        *
        * Every section from the story onwards is gated on a class and a race
        * in the markup, so landing on one without them rendered an empty
        * card with a Back and a Continue and nothing between them. The
        * builder knew what was missing and did not say.
        */}
      {races && classes && steps[stepIndex]?.waiting && (
        <p className="cr-waiting">
          {steps[stepIndex]!.label} needs {steps[stepIndex]!.waiting} first.
          <button className="linky" onClick={() => go(0)}>Go back and choose</button>
        </p>
      )}

      {races && classes && (
        <div className="cr-nav">
          <button disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>Back</button>
          {stepIndex === steps.length - 1 ? (
            <button
              className="cr-on"
              disabled={gaps.length > 0 || !choices}
              onClick={() => finish()}
            >
              {rebuilding ? "Replace my character" : "Create character"}
            </button>
          ) : (
            <button className="cr-on" onClick={() => go(stepIndex + 1)}>
              Continue
            </button>
          )}
        </div>
      )}
    </>
  );
}
