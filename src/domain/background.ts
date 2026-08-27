/**
 * What a background actually gives you.
 *
 * The builder asked for "two of your choice — languages or tools, in any
 * mix", which is a rule no edition has. In 2014 the BACKGROUND decides: an
 * acolyte gets two languages and no tools, a criminal gets two tools and no
 * languages, a guild artisan gets one of each. Offering the choice let a
 * criminal walk away speaking Draconic and knowing no trade.
 *
 * No compendium marks any of this structurally. It is in the background's own
 * text, in near-boilerplate lines — "Languages: Two of your choice", "Tool
 * Proficiencies: One type of gaming set, thieves' tools" — which is what
 * makes reading them safe, and what makes stating the reading out loud in the
 * builder necessary when it comes up thin.
 */

const NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4,
};

export interface ToolChoice {
  /** "gaming set", "artisan's tools" — a kind, not a thing. */
  readonly of: string;
  readonly count: number;
}

export interface BackgroundGrants {
  /** How many languages this background lets you choose. */
  readonly languages: number;
  /** Languages it names outright, which are not a choice. */
  readonly namedLanguages: readonly string[];
  /** Tools it hands you by name. */
  readonly tools: readonly string[];
  /** Tools it lets you choose, by kind. */
  readonly toolChoices: readonly ToolChoice[];
  /** The book's own words, for showing beside a reading that looks thin. */
  readonly said: { readonly languages?: string; readonly tools?: string };
}

const NOTHING: BackgroundGrants = {
  languages: 0, namedLanguages: [], tools: [], toolChoices: [], said: {},
};

/** The text after a heading, up to the next bullet or line break. */
function lineAfter(text: string, heading: string): string | null {
  const re = new RegExp(`${heading}\\s*:?\\s*([^\\n•]+)`, "i");
  return re.exec(text)?.[1]?.trim() ?? null;
}

/**
 * "Two of your choice" → two to choose. "Elvish and one of your choice" → one
 * named, one to choose. Anything unrecognised is left as a named language
 * rather than silently dropped: a wrong name on a sheet is visible, a missing
 * choice is not.
 */
function readLanguages(said: string): { choose: number; named: string[] } {
  const choose = /(\w+)\s+of your choice/i.exec(said);
  const n = choose ? (NUMBERS[choose[1]!.toLowerCase()] ?? 1) : 0;
  const named = said
    .replace(/(\w+)\s+of your choice/gi, "")
    .split(/,| and /i)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 2 && !/^any\b/i.test(s));
  return { choose: n, named };
}

/**
 * "One type of gaming set, thieves' tools" → one gaming set to choose, plus
 * thieves' tools outright.
 */
function readTools(said: string): { fixed: string[]; choices: ToolChoice[] } {
  const fixed: string[] = [];
  const choices: ToolChoice[] = [];
  for (const raw of said.split(",")) {
    const part = raw.trim().replace(/\.$/, "");
    if (part === "") continue;
    const kind = /^(\w+)\s+type[s]?\s+of\s+(.+)$/i.exec(part);
    if (kind) {
      choices.push({
        of: kind[2]!.trim(),
        count: NUMBERS[kind[1]!.toLowerCase()] ?? 1,
      });
      continue;
    }
    if (/of your choice/i.test(part)) {
      choices.push({ of: part.replace(/\s*of your choice/i, "").trim(), count: 1 });
      continue;
    }
    fixed.push(part);
  }
  return { fixed, choices };
}

/*
 * The shipped list spells a trait's body `desc`; an import spells it `text`.
 * Both are read rather than picking a side, because the reading is the same
 * either way and a background that arrived by the other door is still a
 * background.
 */
export function grantsOf(
  traits: readonly {
    readonly name: string;
    readonly text?: string;
    readonly desc?: string;
  }[],
): BackgroundGrants {
  const text = traits.map((t) => `${t.name}\n${t.text ?? t.desc ?? ""}`).join("\n");
  const langLine = lineAfter(text, "Languages");
  const toolLine = lineAfter(text, "Tool Proficiencies");
  if (langLine === null && toolLine === null) return NOTHING;

  const langs = langLine ? readLanguages(langLine) : { choose: 0, named: [] };
  const tools = toolLine ? readTools(toolLine) : { fixed: [], choices: [] };
  return {
    languages: langs.choose,
    namedLanguages: langs.named,
    tools: tools.fixed,
    toolChoices: tools.choices,
    said: {
      ...(langLine ? { languages: langLine } : {}),
      ...(toolLine ? { tools: toolLine } : {}),
    },
  };
}

const WORDS = ["no", "a", "two", "three", "four"];

/** "a gaming set", "an artisan's tools" — English, not string concatenation. */
const article = (s: string) => (/^[aeiou]/i.test(s) ? "an" : "a");

/**
 * The whole grant as one sentence, because the builder has to say it and a
 * sentence assembled out of JSX fragments reads like one: "Criminal thieves'
 * tools, plus a gaming set of your choice" was the first attempt.
 */
export function describeGrants(g: BackgroundGrants, name: string): string {
  const parts: string[] = [];
  if (g.languages > 0) {
    parts.push(
      g.languages === 1 ? "a language" : `${WORDS[g.languages] ?? g.languages} languages`,
    );
  }
  for (const named of g.namedLanguages) parts.push(named);
  for (const tool of g.tools) parts.push(tool);
  for (const c of g.toolChoices) {
    parts.push(`${article(c.of)} ${c.of} of your choice`);
  }
  if (parts.length === 0) return `${name} says nothing about languages or tools.`;
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]!}`;
  return `${name} gives you ${list}.`;
}

/** How many decisions this background asks for, all told. */
export function picksIn(g: BackgroundGrants): number {
  return g.languages + g.toolChoices.reduce((n, c) => n + c.count, 0);
}
