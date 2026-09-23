import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { readable } from 'svelte/store';

const translations: Record<string, string> = {
  'play.rollLog.title': 'Roll Log',
  'play.rollLog.close': 'Close roll log',
  'play.rollLog.empty': 'No rolls this turn yet'
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: readable('en'),
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en']
}));

import RollLogPanel from '$lib/components/play/RollLogPanel.svelte';
import { rollLog } from '$lib/play/rollLogStore.svelte';
import type { RollLogEntry } from '$lib/play/rollLogStore.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

/** A logged roll, as the toast funnel (showDiceRollToast) would log it. */
function logRoll(overrides: Partial<Omit<RollLogEntry, 'id' | 'replaced'>> = {}): void {
  const result: RollResult = { total: 11, natural: 8, bonus: 3, sides: 12 };
  rollLog.logRoll({
    title: 'Greataxe',
    rollType: 'Damage',
    result,
    ...overrides
  });
}

describe('RollLogPanel', () => {
  let container: HTMLElement;
  let app: Record<string, unknown> | undefined;

  beforeEach(() => {
    rollLog.clearRollLog();
    rollLog.close();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    container.remove();
  });

  function mountPanel(): void {
    app = mount(RollLogPanel, { target: container });
    flushSync();
  }

  it('renders nothing while the log is closed', () => {
    mountPanel();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders entries latest-first, each through the shared DiceRollToast body', () => {
    logRoll({ title: 'First roll' });
    logRoll({ title: 'Second roll' });
    rollLog.open();
    mountPanel();

    const entries = container.querySelectorAll('.roll-log__entry');
    expect(entries.length).toBe(2);
    // Latest first: the top entry is the roll that just happened.
    expect(entries[0].textContent).toContain('Second roll');
    expect(entries[1].textContent).toContain('First roll');
    // Each entry is the toast component reused, not a re-implementation.
    expect(container.querySelectorAll('.dice-toast').length).toBe(2);
    // The toast payload rides along: roll type renders next to the title.
    expect(entries[0].textContent).toContain('Damage');
  });

  it('shows the i18n empty state when no rolls are logged', () => {
    rollLog.open();
    mountPanel();

    const empty = container.querySelector('.roll-log__empty');
    expect(empty?.textContent).toContain('No rolls this turn yet');
    expect(container.querySelector('.roll-log__entry')).toBeNull();
  });

  it('wraps replaced entries in the muted variant class, at chronological position', () => {
    logRoll({ title: 'Original', key: 'item:ctrl:0' });
    logRoll({ title: 'Re-roll', key: 'item:ctrl:0' });
    rollLog.open();
    mountPanel();

    const entries = container.querySelectorAll('.roll-log__entry');
    expect(entries.length).toBe(2);
    // The re-roll is the newest entry (top) and is NOT replaced...
    expect(entries[0].classList.contains('roll-log__entry--replaced')).toBe(false);
    // ...the roll it superseded keeps its position and wears the class.
    expect(entries[1].classList.contains('roll-log__entry--replaced')).toBe(true);
  });

  it('closes via the header X button', () => {
    rollLog.open();
    mountPanel();

    (container.querySelector('.roll-log__close') as HTMLButtonElement).click();
    flushSync();

    expect(rollLog.isOpen).toBe(false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes via the scrim', () => {
    rollLog.open();
    mountPanel();

    (container.querySelector('.roll-log__scrim') as HTMLElement).click();
    flushSync();

    expect(rollLog.isOpen).toBe(false);
  });

  it('closes via Escape', () => {
    rollLog.open();
    mountPanel();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();

    expect(rollLog.isOpen).toBe(false);
  });

  it('is a labelled modal dialog', () => {
    rollLog.open();
    mountPanel();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Roll Log');
  });

  it('moves focus into the panel on open and back to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    rollLog.open();
    mountPanel();

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(document.activeElement).toBe(dialog);

    (container.querySelector('.roll-log__close') as HTMLButtonElement).click();
    flushSync();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keeps list semantics under Safari/VoiceOver (role=list on the ol)', () => {
    logRoll({ title: 'Only roll' });
    rollLog.open();
    mountPanel();

    // list-style: none makes WebKit drop the list from the accessibility
    // tree; role="list" restores it so VoiceOver announces list + position.
    const list = container.querySelector('.roll-log__list');
    expect(list?.tagName).toBe('OL');
    expect(list?.getAttribute('role')).toBe('list');
  });

  it('traps Tab within the dialog: focus never leaves the panel', () => {
    rollLog.open();
    mountPanel();

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const close = container.querySelector('.roll-log__close') as HTMLButtonElement;
    // Focus starts on the dialog itself (tabindex="-1") — Tab must move to
    // the first focusable INSIDE the panel, not the play screen behind it.
    dialog.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(close);

    // Tab from the last focusable wraps to the first, and the native Tab
    // default (which would walk out of the modal) is suppressed.
    close.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(tab);
    flushSync();
    expect(tab.defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first focusable wraps to the last, likewise trapped.
    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(shiftTab);
    flushSync();
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
