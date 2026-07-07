import { describe, it, expect } from 'vitest';
import { extractPanelDescriptor } from '$lib/components/play/panel-renderer/extractPanelDescriptor';
import type { Rule } from '$lib/rules-view';

describe('extractPanelDescriptor', () => {
  it('extracts name and section from rule.ui', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: { name: 'rule.test.name', section: 'action-attack' }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.name).toBe('rule.test.name');
    expect(desc.section).toBe('action-attack');
  });

  it('returns empty descriptor for rule with no ui', () => {
    const rule: Rule = { id: 'test', activities: [] };
    const desc = extractPanelDescriptor(rule);
    expect(desc.name).toBeUndefined();
    expect(desc.section).toBeUndefined();
    expect(desc.primaryControl).toBeUndefined();
    expect(desc.secondaryControl).toBeUndefined();
    expect(desc.information).toBeUndefined();
    expect(desc.annotationLabels).toBeUndefined();
  });

  it('extracts primaryControl with type', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: {
        name: 'test',
        primaryControl: {
          type: 'slider',
          var: 'distance',
          max: { var: 'maxDistance' }
        }
      }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.primaryControl?.type).toBe('slider');
  });

  it('extracts information array', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: {
        name: 'test',
        information: [
          { type: 'text', label: 'some.key' },
          { type: 'countdown', filled: { var: 'c' }, total: { var: 'd' } }
        ]
      }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.information).toHaveLength(2);
    expect(desc.information?.[0].type).toBe('text');
    expect(desc.information?.[1].type).toBe('countdown');
  });

  it('extracts top-level annotationLabels from ui', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: {
        name: 'test',
        annotationLabels: ['attack.any', 'attack.melee', 'attack.reaction']
      }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.annotationLabels).toEqual(['attack.any', 'attack.melee', 'attack.reaction']);
  });
});
