import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

const createEntryWithSecondary = (
  _conditionMet = true,
  secondaryType: 'dice-line' | 'slider' | 'select' = 'dice-line'
): AvailableRuleEntry => {
  void _conditionMet;
  const secondaryControlBase = {
    enabled: {
      condition: { fact: 'attack.greataxe.mastery', operator: 'equals', value: 1 },
      button: 'rule.attacks.greataxe-cleave.button'
    }
  };

  let secondaryControl;
  if (secondaryType === 'dice-line') {
    secondaryControl = {
      ...secondaryControlBase,
      type: 'dice-line' as const,
      dice: [
        { sides: 20, bonus: { var: 'hitBonus' } },
        { sides: { var: 'damageDie' }, bonus: { var: 'damageBonus' } }
      ]
    };
  } else if (secondaryType === 'slider') {
    secondaryControl = {
      ...secondaryControlBase,
      type: 'slider' as const,
      var: 'secondarySlider'
    };
  } else {
    secondaryControl = {
      ...secondaryControlBase,
      type: 'select' as const,
      var: 'secondarySelect',
      options: { array: ['a', 'b'] }
    };
  }

  return {
    rule: {
      id: 'greataxe',
      description: 'Greataxe',
      activities: [],
      ui: {
        name: 'rule.attacks.greataxe.name',
        primaryControl: {
          type: 'dice-line',
          dice: [
            { sides: 20, bonus: { var: 'hitBonus' } },
            { sides: { var: 'damageDie' }, bonus: { var: 'damageBonus' } }
          ]
        },
        secondaryControl,
        vars: {
          hitBonus: { default: { number: 5 } },
          damageDie: { default: { number: 12 } },
          damageBonus: { default: { number: 3 } }
        }
      }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  };
};

const createEntryWithSecondaryNoEnabled = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe-noenabled',
    description: 'Greataxe No Enabled',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: {
        type: 'dice-line',
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' } },
          { sides: { var: 'damageDie' }, bonus: { var: 'damageBonus' } }
        ]
      },
      vars: {
        hitBonus: { default: { number: 5 } },
        damageDie: { default: { number: 12 } },
        damageBonus: { default: { number: 3 } }
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - secondary control', () => {
  describe('enabled condition', () => {
    it('does not render secondary when condition is false', () => {
      const entry = createEntryWithSecondary(false);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {} }
      });
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(0);
    });

    it('renders enable button when condition is true but not activated', () => {
      const entry = createEntryWithSecondary(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });
      expect(container.textContent).toContain('rule.attacks.greataxe-cleave.button');
      // Should NOT have the actual secondary control content rendered yet
      // (only the enable button, not the dice-line/slider/select inside the secondary area)
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      for (const secondary of secondaries) {
        expect(secondary.querySelector('.panel-renderer__dice-line')).toBeNull();
        expect(secondary.querySelector('.panel-renderer__slider')).toBeNull();
        expect(secondary.querySelector('.panel-renderer__select')).toBeNull();
      }
    });

    it('renders full secondary control after enable button is clicked', async () => {
      const entry = createEntryWithSecondary(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });

      // Find and click the enable button
      const enableButton = container.querySelector('.panel-renderer__enable-button');
      expect(enableButton).toBeTruthy();
      await fireEvent.click(enableButton!);

      // Now the secondary control should be rendered
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(1);
    });

    it('hides enable button after activation', async () => {
      const entry = createEntryWithSecondary(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });

      const enableButton = container.querySelector('.panel-renderer__enable-button');
      await fireEvent.click(enableButton!);

      // Enable button should be gone
      expect(container.querySelector('.panel-renderer__enable-button')).toBeNull();
    });

    it('renders secondary dice-line content after activation', async () => {
      const entry = createEntryWithSecondary(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });

      const enableButton = container.querySelector('.panel-renderer__enable-button');
      await fireEvent.click(enableButton!);

      // The secondary control should contain dice-line content
      const secondary = container.querySelector('.panel-renderer__control--secondary');
      expect(secondary).toBeTruthy();
      const diceLine = secondary!.querySelector('.panel-renderer__dice-line');
      expect(diceLine).toBeTruthy();
    });
  });

  describe('no enabled condition', () => {
    it('renders secondary control always when enabled is absent', () => {
      const entry = createEntryWithSecondaryNoEnabled();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {} }
      });

      // Should have the secondary control rendered directly, no enable button
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(1);
      expect(container.querySelector('.panel-renderer__enable-button')).toBeNull();
    });
  });

  describe('no secondary control', () => {
    it('renders nothing when secondaryControl is absent', () => {
      const entry: AvailableRuleEntry = {
        rule: {
          id: 'simple',
          description: 'Simple',
          activities: [],
          ui: {
            name: 'rule.simple.name',
            primaryControl: {
              type: 'dice-line',
              dice: [{ sides: 20 }]
            }
          }
        } as Rule,
        legal: true,
        applicable: true,
        diagnostics: []
      };

      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {} }
      });

      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(0);
      expect(container.querySelector('.panel-renderer__enable-button')).toBeNull();
    });
  });

  describe('secondary control types', () => {
    it('renders secondary slider after activation', async () => {
      const entry = createEntryWithSecondary(true, 'slider');
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });

      const enableButton = container.querySelector('.panel-renderer__enable-button');
      await fireEvent.click(enableButton!);

      const secondary = container.querySelector('.panel-renderer__control--secondary');
      expect(secondary).toBeTruthy();
      const slider = secondary!.querySelector('.panel-renderer__slider');
      expect(slider).toBeTruthy();
    });

    it('renders secondary select after activation', async () => {
      const entry = createEntryWithSecondary(true, 'select');
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
      });

      const enableButton = container.querySelector('.panel-renderer__enable-button');
      await fireEvent.click(enableButton!);

      const secondary = container.querySelector('.panel-renderer__control--secondary');
      expect(secondary).toBeTruthy();
      const select = secondary!.querySelector('.panel-renderer__select');
      expect(select).toBeTruthy();
    });
  });

  describe('read-only mode', () => {
    it('renders enable button in read-only mode when condition is true', () => {
      const entry = createEntryWithSecondary(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: false, facts: { 'attack.greataxe.mastery': 1 } }
      });
      expect(container.querySelector('.panel-renderer__enable-button')).toBeTruthy();
    });

    it('does not render secondary in read-only mode when condition is false', () => {
      const entry = createEntryWithSecondary(false);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: false, facts: {} }
      });
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(0);
    });
  });

  describe('label without button', () => {
    const createEntryWithLabel = (conditionMet = true): AvailableRuleEntry => {
      void conditionMet;
      return {
        rule: {
          id: 'labeled-secondary',
          description: 'Labeled Secondary',
          activities: [],
          ui: {
            name: 'rule.test.name',
            primaryControl: {
              type: 'dice-line',
              dice: [{ sides: 20, bonus: { var: 'primaryBonus' } }]
            },
            secondaryControl: {
              type: 'dice-line',
              enabled: {
                condition: { fact: 'feat.active', operator: 'equals', value: 1 }
              },
              label: 'rule.test.secondary-label',
              dice: [{ sides: 20, bonus: { var: 'secondaryBonus' } }]
            },
            vars: {
              primaryBonus: { default: { number: 3 } },
              secondaryBonus: { default: { number: 2 } }
            }
          }
        } as Rule,
        legal: true,
        applicable: true,
        diagnostics: []
      };
    };

    it('does not render secondary when condition is false', () => {
      const entry = createEntryWithLabel(false);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {} }
      });
      expect(container.querySelector('.panel-renderer__control--secondary')).toBeNull();
    });

    it('renders control directly when condition is true, no button needed', () => {
      const entry = createEntryWithLabel(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'feat.active': 1 } }
      });
      expect(container.querySelector('.panel-renderer__enable-button')).toBeNull();
      const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
      expect(secondaries.length).toBe(1);
    });

    it('renders label text inline on the dice line when condition is true', () => {
      const entry = createEntryWithLabel(true);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: { 'feat.active': 1 } }
      });
      const secondary = container.querySelector('.panel-renderer__control--secondary');
      expect(secondary).toBeTruthy();
      const range = secondary!.querySelector('.panel-renderer__range');
      expect(range).toBeTruthy();
      expect(range!.textContent).toContain('rule.test.secondary-label');
    });
  });
});
