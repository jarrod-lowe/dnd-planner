import { defineRule, type RuleModule } from '../builder';

/**
 * Human species: base movement constants (speed 30, swim at double cost, no fly).
 *
 * The other v1 rule, `human-hi-long-rest` ("regain Heroic Inspiration on a long
 * rest, without duplicating"), is deferred: it needs a passive module to create a
 * *persistent* HI effect triggered by a transient long-rest event, which doesn't
 * fit the offer/effect model cleanly yet (its two scenarios are skip-listed).
 * Foundational, so no search meta.
 */
const speciesHuman: RuleModule = {
  id: 'species-human',
  derive: () => [
    { fact: 'character.movement.total', value: () => 30 },
    { fact: 'character.movement.swim.can', value: () => 1 },
    { fact: 'character.movement.swim.cost', value: () => 2 },
    { fact: 'character.movement.fly.can', value: () => 0 }
  ]
};

export default defineRule(speciesHuman);
