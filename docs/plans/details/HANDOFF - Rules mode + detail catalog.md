# Handoff — "Rules mode" disclosure + detail-text catalog

## 1. What we're building

A way to show the long reference text (full spell/feature/condition rules) for a
**planned choice** and for an **active effect**, without spending screen space on
it when the player isn't looking at it.

Chosen pattern (validated in the prototype `Detail Disclosure Options v2.html`,
top section _"★ Chosen direction — 19 + 22"_): **a single "Rules mode" gesture**
applied identically to two places.

- **Plan row (19):** the row's verb rail (`CAST`/`ATTACK`/…) doubles as a toggle.
  Tap it → the row's right side swaps from the plan face to a **Rules pane**; the
  rail tints to `primary-container` and reads **RULES**, with a `↺ Cast` chip to
  flip back.
- **Effect strip (22):** tapping an effect chip morphs the Active-State strip into
  the **same** Rules pane, fronted by the **same** tinted rail (reads **RULES**,
  flips back via `↺ Effects`). Because the strip hosts several effects, the pane
  adds a small inline switcher to move between standing effects; everything else
  is byte-for-byte the same vocabulary as the plan row.

Both share one set of CSS primitives (`.rules-shell` / `.rules-rail` /
`.rules-pane` in the prototype's `shell.css`) so they read as one idea. Match that
spec: tinted rail, `Cinzel` mode label, italic `meta` subtitle, an inline
key/value field row, then body paragraphs in `Lora`.

Only one honest difference between the two: the rail's return word
(`Cast` vs `Effects`).

---

## 2. The data question (the important part)

> We need a place to store the detail text per item, but we must **not** carry it
> through the effects data — effects persist to DynamoDB and we don't want to
> blow out the user's effect store with a wall of prose.

### Principle: key on the rule, not text on the rule

The app already does this for display names — `rule.ui.name` is an **i18n key**,
resolved through `t()` at render time. Detail text is just more of the same, only
larger and structured. So:

- **Persisted data (DynamoDB) stays exactly as today.** A `Rule` carries an id and
  `ui` keys. The **only** thing we add to the rule is one short string:
  `ui.detailKey` (e.g. `spell/sleep`). No `meta`, no `fields`, no `body`, no
  `source` on the rule — all of that lives in a separate object resolved by the key.
- **The prose lives in separate, version-controlled, locale-split objects**, one per
  `detailKey`, **served from S3** (public, CDN-fronted). They ship with the app, not
  with the user's data, and are fetched one item at a time on demand.

This means: turning on Rules mode for 30 effects adds **zero** bytes to the effect
store. The rule (and any effect persisted to DynamoDB) carries one tiny key;
everything bulky is resolved client-side from the S3 object.

### The detail data model

A detail object is small and deliberately extensible. The body is a flat list of
lines, each of which is either a paragraph or a bullet; inline emphasis is carried
by a `Span` union that we can grow later **without** a data migration.

```ts
// src/lib/details/types.ts

/** One run of inline content. Plain text is the common case. The union is
 *  open by design: future variants like { strongEm: string } or
 *  { diceRoll: {...} } slot in here, and old renderers safely ignore
 *  kinds they don't know (see renderer). */
export type Span = string | { strong: string } | { em: string };
// future: | { strongEm: string } | { diceRoll: DiceRef } | { ref: DetailKey } …

/** A line of body text: a paragraph, or a bullet when `bullet` is true. */
export interface Line {
  bullet?: boolean;
  text: Span[];
}

export interface ItemDetail {
  /** Provenance, for auditing where the text came from. Just a label —
   *  not a key, not a serving/licence switch. One detail = one source. */
  source: 'srd52' | 'srd51' | 'custom';
  /** Italic subtitle, e.g. 'Level 1 Enchantment (Bard, Sorcerer, Wizard)'
   *  or 'Condition · Ongoing'. Plain string. */
  meta?: string;
  /** Bold key / value stat block above the prose. `labelKey` is an i18n key
   *  resolved via t() (labels repeat across hundreds of items → translate
   *  once in common.json); `value` is per-item content. */
  fields?: { labelKey: string; value: string }[];
  /** The rules prose: paragraphs and bullets, in order. */
  body: Line[];
}
```

Notes on the shape:

- **`meta` and `fields[].value` are plain strings** — no inline formatting needed
  there, so they stay trivial (and auto-escaped on render).
- **No separate `notes`/appendix block.** The "Using a Higher-Level Spell Slot"
  rider is just a `bullet` line whose first span is `strong` (see worked example).
- **`source` is provenance only** — see _Source / provenance_ below.

### Formatting & safe rendering

Formatting is where a naive implementation invites XSS, so the rule is firm:
**never ship HTML, never use Svelte `{@html}` / `innerHTML`.** Author prose as
Markdown in the source YAML; the **publish step** parses it (in trusted Node, with
raw-HTML passthrough **disabled**) into the `Span`/`Line` tree above; the runtime
renders that tree with a component that can only emit known elements:

```svelte
<!-- Line.svelte: render one Line's spans -->
{#each line.text as s}
  {#if typeof s === 'string'}{s}
  {:else if 'strong' in s}<strong>{s.strong}</strong>
  {:else if 'em' in s}<em>{s.em}</em>
  {/if}
  <!-- unknown span kinds: ignored, never injected -->
{/each}
```

Group consecutive `bullet` lines into one `<ul>`; render the rest as `<p>`. Because
text is interpolated (escaped) and the component only renders span kinds it has a
case for, this is XSS-proof by construction — a hostile `{ html: "<script>…" }`
has no branch, and a `"<script>"` _string_ renders as escaped text. The open union
also means **old clients tolerate new span kinds**: when `{ strongEm }` or
`{ diceRoll }` is added later, a renderer without that case simply skips it rather
than breaking.

**Security is light right now, by design.** All detail content is first-party
(authored in git, parsed at build, served from S3) — there is no user-authored
prose reaching the renderer (the custom-rule editor only references a `detailKey`,
see below). So we do **not** need zod/allowlist sanitization of adversarial
payloads; a light type guard for "did our own build emit well-formed JSON" is
enough. **The day "specify details for custom rules" is added, untrusted input
returns — that is the trigger to reinstate parse + allowlist validation at the
trusted boundary (build- or server-side) before any user span reaches the
renderer.** Flag it as a precondition on that future feature.

### Storage & identity (S3)

- **Ref on the rule:** `ui.detailKey`, a path-like slug, e.g. `spell/sleep`,
  `feature/lay-on-hands`. (If rule `id`s are already clean slugs you may derive the
  key from the id instead of storing it — confirm ids are stable paths first.)
- **S3 key:** `details/{locale}/{detailKey}.json` →
  `details/en/spell/sleep.json`. Locale segment first, then the key maps straight
  onto the object path. (S3 keys are flat strings, so path-like ids are safe — no
  traversal concern.)
- **Locale fallback at fetch time, never source fallback.** `spell/sleep` in
  `en-x-tlh` → try `details/en-x-tlh/spell/sleep.json`, then `details/en/…`. A
  given key has exactly one `source`, so there is never a cross-source decision to
  make. Divergent wording = a different rule with a different key.

### Authoring → publish pipeline

Author the detail **inline in the rule YAML** (pleasant to edit, kept in git for
history); the publish step is what splits it out so the runtime/effect store only
ever sees a key.

**On publish, for each rule with an inline `detail`:**

1. Parse the Markdown body → `Span`/`Line` tree.
2. Write the resulting `ItemDetail` (including `source`) to
   `details/{locale}/{detailKey}.json` in S3.
3. In the **published** rule data, delete the inline `detail` block and set
   `ui.detailKey`.
4. Track the full set of keys written this publish = **desired state**.

**Orphan cleanup (lightweight, no manifest):** after upload, list S3 under
`details/` and **delete any object not in the just-written set**. This is a plain
desired-state sweep — renamed keys, removed details, deleted rules, and dropped
locales all get cleaned up with no extra bookkeeping. Git remains the audit history
of the prose itself.

### Loading strategy: prefetch one detail when its rule enters play

We do **not** load a whole catalog into memory. We fetch **one rule's detail at a
time**, and we do it _early_ — at the moment a rule first enters the loadout — so
the text is already warm by the time the player taps "Rules" (which, for a planned
item, is typically seconds-to-minutes later, while other players take their turns:
the app's core use case). This keeps memory proportional to "items this character
actually has in play" (a handful), never the full rules library, and avoids any
big-JSON parse hitch on a tablet.

**The cache is an optimization layer, never a correctness dependency.** Prefetch
_populates_ a key→detail cache; the Rules UI always reads through `getDetail(key)`,
which serves from cache or, on a miss, does a live fetch behind a brief loading
state. A missed or in-flight prefetch costs one spinner — it never breaks.

**Two prefetch triggers:**

1. **On-add** — when a rule is first added to the plan or as an effect. This is
   already an async, forgiving moment (it touches state/persistence); one more
   background fetch is invisible.
2. **On-rehydrate** — effects/plan persist to DynamoDB and reload next session, so
   "first added" won't fire. When the play screen hydrates from saved state,
   prefetch the detail for each `detailKey` present. This set is exactly the saved
   loadout — small and bounded.

Both triggers just call `prefetchDetail(key)`, which is dedupe-guarded and writes
into the same cache `getDetail` reads.

```ts
// src/lib/details/index.ts
import type { ItemDetail } from './types';
import { get } from 'svelte/store';
import { locale } from '$lib/i18n';

const BASE = '/details'; // CDN/S3 origin prefix for detail objects

/** key -> resolved detail (or null = known-absent). Bounded; see eviction. */
const cache = new Map<string, ItemDetail | null>();
/** key -> in-flight promise, so concurrent asks/prefetches dedupe. */
const inflight = new Map<string, Promise<ItemDetail | null>>();
const MAX_ENTRIES = 60; // LRU cap — a long session can't grow forever

/** Fetch ONE detail object for the active locale, falling back to en. */
async function fetchDetail(key: string): Promise<ItemDetail | null> {
  const loc = get(locale);
  const tryLoad = async (l: string): Promise<ItemDetail | null> => {
    const res = await fetch(`${BASE}/${l}/${key}.json`); // GET S3/CDN object
    if (!res.ok) return null; // 404 → not present in this locale
    return (await res.json()) as ItemDetail; // trusted, first-party JSON
  };
  try {
    return (await tryLoad(loc)) ?? (loc !== 'en' ? await tryLoad('en') : null);
  } catch {
    return null; // network error → caller falls back to a retry on next open
  }
}

function remember(key: string, val: ItemDetail | null) {
  cache.delete(key); // refresh LRU position
  cache.set(key, val);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

/** Fire-and-forget warm-up. Safe to call repeatedly; deduped. */
export function prefetchDetail(key: string): void {
  if (!key || cache.has(key) || inflight.has(key)) return;
  const p = fetchDetail(key).then((d) => {
    remember(key, d);
    inflight.delete(key);
    return d;
  });
  inflight.set(key, p);
}

/** Read path the UI uses. Cache hit → resolved; miss → live fetch + loading state. */
export async function getDetail(key: string): Promise<ItemDetail | null> {
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = fetchDetail(key).then((d) => {
    remember(key, d);
    inflight.delete(key);
    return d;
  });
  inflight.set(key, p);
  return p;
}

/** Synchronous peek for the component: lets it render instantly when warm. */
export function peekDetail(key: string): ItemDetail | null | undefined {
  return cache.get(key); // undefined = not loaded yet, null = known-absent
}
```

> **Offline / caching note:** because tap-time text should not depend on live
> connectivity at the table, precache the loadout's detail objects with the service
> worker (this is a PWA-shaped app). A `fetch` that the SW serves from local cache
> incurs **no** network call; precaching is a disk concern and does not bloat the
> JS heap, which stays bounded by the LRU cap above. Precache on-add / on-rehydrate
> (loadout-scoped) or precache-all if the corpus is modest.

### Why one object per item (and not a catalog or `common.json`)

`en/common.json` is already ~40 KB and loads for the whole app. Reference prose is
(a) long, (b) only needed in play mode, (c) structured, and (d) only ever read a
few items at a time. One small S3 object per `detailKey` means **only the items
actually used are ever fetched or resident** — and the active locale is chosen at
fetch time with a per-item `en` fallback (most locales, e.g. `en-x-tlh`, won't
translate every item).

**Rejected alternatives (and why):**

- _One catalog file per locale_ (`en/spells.json`) — loads **all** prose into memory
  to show one spell, and a multi-MB parse as the library grows. Fine only if tiny.
- _Category split_ (`spells.json` / `features.json`) — load only used categories;
  still loads a whole category to show one item. A reasonable fallback if per-item
  object count ever becomes unwieldy.
- _Fetch only on first "Rules" tap_ — laziest, but puts a round-trip + spinner at
  the exact moment of reading, on possibly-flaky venue wifi. Prefetch-on-add hides
  that latency while staying just as lazy about the long tail.

### Source / provenance

`source` is a plain label on each detail (`srd52` | `srd51` | `custom`) recording
**where the text came from**, so we can audit that we haven't accidentally copied
copyrighted wording. It is deliberately lightweight:

- **Not a key, not a path segment, not a serving/licence switch** — just a field
  inside the object. One detail has exactly one source.
- `custom` = our own original wording for an item whose official text is
  copyrighted (still first-party, in git). It is **not** end-user homebrew.
- No enforcement, manifest, or audit report — git history is the record. Optionally
  surface it as a quiet line in the Rules pane (e.g. "SRD 5.2").
- For SRD content: serve it (CC-BY-4.0 permits redistribution), include the required
  **attribution**, and don't gate it behind auth — auth would only reintroduce
  backend cost to protect content that is free and mirrored by design. Bound cost
  with CDN caching + edge rate-limiting instead.

### Authoring vs. runtime layout

```
# Authoring (git) — detail inline under each rule, Markdown body:
rules/spells.yaml          # rule + inline `detail:` block (see worked example)

# Runtime (S3, written by the publish step):
details/en/spell/sleep.json
details/en/spell/spider-climb.json
details/en/feature/heroic-inspiration.json
details/en-x-tlh/spell/sleep.json   # optional per item; omit → falls back to en
```

### Custom / homebrew rules

The custom-rule editor (`EditCustomRules.svelte` / `ManageRulesMode.svelte`) works
at the **`detailKey` level** — a rule it produces carries a key, not prose. For now:

1. **The editor cannot author detail text.** At most it could _reference_ an existing
   first-party `detailKey` (and probably won't even do that). So **all renderable
   detail content is first-party and trusted** — there is no user-authored prose
   reaching the renderer. This is what keeps the security surface light (see
   _Formatting & safe rendering_).
2. **Authoring details for custom rules is deferred.** When added later, it
   introduces untrusted input and is the trigger to reinstate parse + allowlist
   validation at the trusted boundary before any user span is rendered.
3. **No detail for a key → graceful empty state.** A rule with no `detailKey`, or a
   `detailKey` that resolves to `null` (404 / known-absent), simply shows no toggle.
   Never show an empty Rules pane.

---

## 3. Component work

- **`RulesPane.svelte`** (new, shared): props `{ detail: ItemDetail; returnLabel:
string; onFlip: () => void; switcher?: Snippet }`. Renders the tinted rail
  (`RULES` + `↺ {returnLabel}`), the head (`name` slot + italic `meta`), the field
  row (labels via `t(field.labelKey)`, values from `detail`), and the body via the
  `Line.svelte` renderer (paragraphs + grouped bullet `<ul>`s, no `{@html}`).
  Optionally shows `source` as a quiet provenance line. This is the single source of
  the visual language — both call sites use it so they can't drift.
- **`Line.svelte`** (new): renders one `Line`'s `Span[]` per the safe renderer in
  §2 — `string` → escaped text, `{ strong }` → `<strong>`, `{ em }` → `<em>`,
  unknown kinds ignored. Keep the switch exhaustive so new span kinds are a
  conscious addition.
- **`PlanRow.svelte`**: add a `mode: 'plan' | 'rules'` local state. The verb rail
  becomes the toggle. In `rules` mode render `RulesPane` in place of the plan face.
  Resolve `key = rule.ui?.detailKey ?? rule.id`. Render from `peekDetail(key)` when
  warm (instant — the on-add/rehydrate prefetch will usually have populated it);
  otherwise `await getDetail(key)` with a brief loading state. If it resolves to
  `null` (known-absent), suppress the toggle.
- **Prefetch wiring**: call `prefetchDetail(key)` where a rule is added to the plan
  or as an effect, **and** for every `detailKey` present when the play screen
  hydrates from saved state. Fire-and-forget; it's deduped and bounded.
- **`EffectChip.svelte` / `ActiveStateStrip.svelte`**: tapping a chip sets the strip
  into rules mode for that effect's `detailKey`, rendering the **same** `RulesPane`
  with `returnLabel="Effects"` plus the inline effect switcher (the other standing
  effects). Reuse `getEffectKind` / existing chip data to build the switcher.
- One effect open at a time (matches the prototype and the earlier "only one open"
  decision). Opening a Rules view closes any other.

### Strings to add to `common.json` (all locales)

`rules.field.castingTime`, `rules.field.range`, `rules.field.components`,
`rules.field.duration`, `rules.field.source`; the mode label `rules.mode` ("Rules"),
return labels `rules.return.cast` / `rules.return.effects`, and the empty state
`rules.none`.

---

## 4. Acceptance criteria

- [ ] Adding/committing effects writes **no** detail prose to the effect store —
      diff a saved character before/after opening Rules mode: identical.
- [ ] Detail text is fetched **per item, on demand** — not as a whole catalog.
      Network tab: adding a rule triggers a fetch for _that_ rule's detail only;
      unused items are never fetched. Nothing detail-related is in the initial or
      landing bundle.
- [ ] **Memory is bounded** — opening many different items over a long session does
      not grow resident detail without limit (LRU cap holds).
- [ ] **Warm on tap** — for an item added earlier in the session (or present on
      rehydrate), opening Rules mode shows text with no spinner; the prefetch
      populated the cache.
- [ ] **Cold tap still works** — if prefetch was skipped or in-flight, Rules mode
      shows a brief loading state then the text; a failed prefetch never blocks or
      errors the toggle (it just falls back to a live fetch).
- [ ] Only the **active locale's** object is fetched; a missing per-item translation
      (e.g. under `en-x-tlh`) falls back to the English object for that item, and
      **never** to a different `source`/edition.
- [ ] Body renders with **no `{@html}` / `innerHTML`** anywhere in the detail path;
      `strong`/`em` show correctly and a `text` span containing `"<script>"` renders
      as escaped text. An unknown future span kind is ignored, not thrown on.
- [ ] Each detail object carries a `source` (`srd52`/`srd51`/`custom`); SRD content
      ships with its CC-BY attribution.
- [ ] Publish writes one S3 object per `detailKey`, strips inline `detail` from the
      published rule (leaving only `ui.detailKey`), and **sweeps** S3 objects no
      longer in the published set (no orphans after a rename/removal).
- [ ] Plan-row Rules mode and effect-strip Rules mode are visually identical except
      the rail return word (`Cast` vs `Effects`).
- [ ] Items with no detail show no broken toggle and no empty pane.
- [ ] Tablet landscape: the Rules pane fits without horizontal scroll; long body
      text scrolls within the pane, not the page.
- [ ] Works on touch (tap rail to enter/exit) and is keyboard/AT operable
      (`aria-pressed` on the rail; the chip switcher is a `tablist`).

Visual spec to match: prototype `Detail Disclosure Options v2.html`, artboards
**u19** and **u22**, and the `.rules-*` classes in `shell.css`.

---

## 5. Worked example — Sleep, end to end

### Rule as authored in git (detail inline, Markdown body)

```yaml
- id: spell-sleep
  ui:
    name: rules.spell.sleep.name
  detail:
    source: srd52
    meta: 'Level 1 Enchantment (Bard, Sorcerer, Wizard)'
    fields:
      - { labelKey: rules.field.castingTime, value: 'Action' }
      - { labelKey: rules.field.range, value: '60 feet' }
      - { labelKey: rules.field.components, value: 'V, S, M (a pinch of sand or rose petals)' }
      - { labelKey: rules.field.duration, value: 'Concentration, up to 1 minute' }
    body: |
      Each creature of your choice in a 5-foot-radius Sphere centered on a point
      within range must succeed on a Wisdom saving throw or have the Incapacitated
      condition until the end of its next turn, at which point it must repeat the
      save. If the target fails the second save, the target has the Unconscious
      condition for the duration. The spell ends on a target if it takes damage or
      someone within 5 feet of it takes an action to shake it out of the spell's effect.

      Creatures that don't sleep, such as elves, or that have Immunity to the
      Exhaustion condition automatically succeed on saves against this spell.
```

### Rule as published (inline detail extracted; only the key remains)

```yaml
- id: spell-sleep
  ui:
    name: rules.spell.sleep.name
    detailKey: spell/sleep
```

### The S3 object the publish step writes: `details/en/spell/sleep.json`

```json
{
  "source": "srd52",
  "meta": "Level 1 Enchantment (Bard, Sorcerer, Wizard)",
  "fields": [
    { "labelKey": "rules.field.castingTime", "value": "Action" },
    { "labelKey": "rules.field.range", "value": "60 feet" },
    { "labelKey": "rules.field.components", "value": "V, S, M (a pinch of sand or rose petals)" },
    { "labelKey": "rules.field.duration", "value": "Concentration, up to 1 minute" }
  ],
  "body": [
    {
      "text": [
        "Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Incapacitated condition until the end of its next turn, at which point it must repeat the save. If the target fails the second save, the target has the Unconscious condition for the duration. The spell ends on a target if it takes damage or someone within 5 feet of it takes an action to shake it out of the spell's effect."
      ]
    },
    {
      "text": [
        "Creatures that don't sleep, such as elves, or that have Immunity to the Exhaustion condition automatically succeed on saves against this spell."
      ]
    }
  ]
}
```

### A line exercising spans + bullet (Spider Climb's higher-level rider)

```json
{
  "bullet": true,
  "text": [
    { "strong": "Using a Higher-Level Spell Slot." },
    " You can target one additional creature for each spell slot level above 2."
  ]
}
```

Renders as a bullet: **Using a Higher-Level Spell Slot.** You can target one
additional creature for each spell slot level above 2.

### Field labels in `common.json` (resolved via `t()`)

```json
{
  "rules.field.castingTime": "Casting Time",
  "rules.field.range": "Range",
  "rules.field.components": "Components",
  "rules.field.duration": "Duration",
  "rules.field.source": "Source",
  "rules.mode": "Rules",
  "rules.return.cast": "Cast",
  "rules.return.effects": "Effects",
  "rules.none": "No reference text for this item."
}
```
