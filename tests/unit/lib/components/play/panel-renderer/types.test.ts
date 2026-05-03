// tests/unit/lib/components/play/panel-renderer/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  DiceLineControl,
  SliderControl,
  SelectControl,
  TextInformation,
  CountdownInformation,
  PanelDescriptor,
  ValueSource,
} from '$lib/components/play/panel-renderer/types';

describe('Panel renderer types', () => {
  it('ValueSource can be a fact reference', () => {
    const vs: ValueSource = { fact: 'character.movement.remaining' };
    expect(vs.fact).toBe('character.movement.remaining');
  });

  it('ValueSource can be a var reference', () => {
    const vs: ValueSource = { var: 'distance' };
    expect(vs['var']).toBe('distance');
  });

  it('ValueSource can be a literal number', () => {
    const vs: ValueSource = { number: 5 };
    expect(vs.number).toBe(5);
  });

  it('ValueSource can be a literal string', () => {
    const vs: ValueSource = { string: 'melee' };
    expect(vs.string).toBe('melee');
  });

  it('DiceLineControl has required fields', () => {
    const control: DiceLineControl = {
      type: 'dice-line',
      dice: [{ expression: 'd20', bonus: { var: 'hitBonus' } }],
    };
    expect(control.type).toBe('dice-line');
    expect(control.dice).toHaveLength(1);
  });

  it('SliderControl has required fields', () => {
    const control: SliderControl = {
      type: 'slider',
      var: 'distance',
      max: { var: 'maxDistance' },
    };
    expect(control.type).toBe('slider');
    expect(control['var']).toBe('distance');
  });

  it('SelectControl has required fields', () => {
    const control: SelectControl = {
      type: 'select',
      var: 'level',
      options: { var: 'levels' },
    };
    expect(control.type).toBe('select');
  });

  it('TextInformation with labelValues', () => {
    const info: TextInformation = {
      type: 'text',
      label: 'play.information.saveDc',
      labelValues: {
        saveType: { fact: 'spellcasting.saveType' },
        dc: { fact: 'spellcasting.saveDC' },
      },
    };
    expect(info.type).toBe('text');
    expect(info.labelValues?.dc).toBeTruthy();
  });

  it('CountdownInformation with filled and total', () => {
    const info: CountdownInformation = {
      type: 'countdown',
      filled: { var: 'countDown' },
      total: { var: 'duration' },
    };
    expect(info.type).toBe('countdown');
    expect(info.filled).toBeTruthy();
  });

  it('PanelDescriptor with all optional fields', () => {
    const descriptor: PanelDescriptor = {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ expression: 'd20', bonus: { var: 'hitBonus' } }],
      },
      information: [{ type: 'text', label: 'some.key' }],
    };
    expect(descriptor.secondaryControl).toBeUndefined();
    expect(descriptor.primaryControl?.type).toBe('dice-line');
  });
});
