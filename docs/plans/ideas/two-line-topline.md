# Two line top line

In the topline, almost all displays are slit across two lines - titles on top, values on the bottom. However, very simple ones (like AC and SPD) are all on one line. This wastes space. Lets make those 2-lines too.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Execute each task in a fresh subagent; main agent only coordinates + talks to human.

**Goal:** every stacked topline chip (HP, value, conc) is two-line — label over value, centered; value chips (AC/SPD, player + steed) shrink to natural narrow width.

**Approach:** one shared modifier `intent-top-bar__chip--stack { column, center, gap 2px }` on HP/value/conc chips. `--hp` keeps only `min-width: 5rem`; hp-bar spans via `align-self: stretch`; HP label left-pin rule deleted (centers now); `--conc` CSS rule deleted (class kept in markup as identity hook — tests query it). Abilities chip unchanged (row of two-line columns). Markup class additions are the unit-test seam.

**Decisions (grilled):** center everything; single declaration of stacking, no duplication; RED = unit test on `--stack` class; Playwright = final eyeball only.

**Notes:** no i18n changes (labels/aria unchanged, no new strings). A11y: aria-labels + DOM order unchanged. CSS Law: no new colours, tokens only. No rules/backend changes → no `make sync-rule-groups`, no `make deploy-test`.

### Task 0: branch

- [ ] `git checkout -b two-line-topline` (never commit to main)

### Task 1: RED — failing tests

**Files:** `tests/unit/lib/components/play/IntentTopBar.test.ts` (insert after `renders multiple value chips`, ~line 170)

- [ ] Add:

```ts
it('stacks value chips two-line via --stack modifier', () => {
  renderComponent(
    [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' } satisfies UiEntry],
    { 'ac.value': 16 }
  );
  const chip = container.querySelector('.intent-top-bar__chip');
  expect(chip?.classList.contains('intent-top-bar__chip--stack')).toBe(true);
});

it('stacks hp and conc chips; abilities chip stays unstacked', () => {
  renderComponent(
    [
      { type: 'usedMax', label: 'play.topBar.hp', total: 'hp.max', remaining: 'hp.current' },
      {
        type: 'concentration',
        label: 'play.topBar.conc',
        activeLabel: 'play.topBar.concActive',
        noneLabel: 'play.topBar.concNone'
      },
      {
        type: 'ability',
        label: 'play.topBar.abilities',
        abilities: [{ name: 'play.stats.str', fact: 'str.modifier' }]
      }
    ] satisfies TopBarEntry[],
    { 'hp.current': 28, 'hp.max': 35, 'str.modifier': 3 }
  );
  expect(
    container
      .querySelector('.intent-top-bar__chip--hp')
      ?.classList.contains('intent-top-bar__chip--stack')
  ).toBe(true);
  expect(
    container
      .querySelector('.intent-top-bar__chip--conc')
      ?.classList.contains('intent-top-bar__chip--stack')
  ).toBe(true);
  expect(
    container
      .querySelector('.intent-top-bar__chip--abilities')
      ?.classList.contains('intent-top-bar__chip--stack')
  ).toBe(false);
});
```

- [ ] Run: `pnpm exec vitest run tests/unit/lib/components/play/IntentTopBar.test.ts`
- [ ] Expect: 2 new tests FAIL (`expected true, got false`), all existing PASS. Compile error/panic = fix first.

### Task 2: GREEN — markup

**Files:** `src/lib/components/play/IntentTopBar.svelte`

- [ ] HP chip (line 147): `class="intent-top-bar__chip intent-top-bar__chip--stack intent-top-bar__chip--hp"`
- [ ] Value chip (line 172): `class="intent-top-bar__chip intent-top-bar__chip--stack"`
- [ ] Conc chip (line 182): `class="intent-top-bar__chip intent-top-bar__chip--stack intent-top-bar__chip--conc"`
- [ ] Run: `pnpm exec vitest run tests/unit/lib/components/play/IntentTopBar.test.ts` → ALL PASS
- [ ] Commit: `Stack all topline chips via shared modifier` (tests + markup)

### Task 3: CSS consolidation

**Files:** `src/lib/components/play/IntentTopBar.svelte` `<style>`

- [ ] Add after `__chip-value` rule (~line 374):

```css
.intent-top-bar__chip--stack {
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
```

- [ ] `--hp` rule → only `min-width: 5rem;`
- [ ] Delete `.intent-top-bar__chip--hp .intent-top-bar__chip-label { align-self: flex-start; }`
- [ ] `__hp-bar` rule: add `align-self: stretch;`
- [ ] Delete `--conc` rule block (column/flex-start/gap)
- [ ] `make test-unit` → PASS
- [ ] Commit: `Centre stacked topline chips, dedupe layout CSS`

### Task 4: verify

- [ ] `make test` → PASS (full gate — never commit while tests fail)
- [ ] `make lint` → PASS
- [ ] Eyeball: `pgrep -f vite.js` (if dead: `make dev`); playwright on <http://localhost:5173>, play mode, light + dark: AC/SPD label-over-value, centered, narrow; HP centered, bar full chip width; conc centered; abilities unchanged; steed view too
- [ ] superpowers:finishing-a-development-branch → PR
