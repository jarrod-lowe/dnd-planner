import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Tests that weapon expansion profiles define explicit intents
 * instead of relying on section-based fallback.
 */
describe('weapon profile intents', () => {
  const yamlPath = path.resolve(process.cwd(), 'data/rule-sources/weapons.yaml');
  let profiles: { id: string; ui?: Record<string, unknown> }[];

  beforeAll(() => {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    const data = yaml.load(content) as {
      profiles: { id: string; ui?: Record<string, unknown> }[];
    };
    profiles = data.profiles;
  });

  function getProfile(id: string) {
    return profiles.find((p) => p.id === id);
  }

  it('use-action profile has ATTACK:weapons intent', () => {
    const profile = getProfile('use-action');
    expect(profile?.ui?.intents).toEqual({ ATTACK: 'weapons' });
  });

  it('use-reaction-weapon profile has DEFEND:weapons intent', () => {
    const profile = getProfile('use-reaction-weapon');
    expect(profile?.ui?.intents).toEqual({ DEFEND: 'weapons' });
  });

  it('use-bonus-followup-light profile has ATTACK:weapons intent', () => {
    const profile = getProfile('use-bonus-followup-light');
    expect(profile?.ui?.intents).toEqual({ ATTACK: 'weapons' });
  });
});
