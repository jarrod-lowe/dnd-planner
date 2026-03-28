import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/client', () => ({
  apiPost: vi.fn()
}));

import { apiPost } from '$lib/api/client';
import { ensureCached, seedCache, clearCache } from '$lib/rules/ruleGroupCache.svelte';

const mockApiPost = vi.mocked(apiPost);

describe('ruleGroupCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  describe('ensureCached', () => {
    it('returns cached data without making an API call', async () => {
      seedCache({
        'rg-1': { name: 'Fireball', description: 'A fire spell', requires: [] }
      });

      const result = await ensureCached(['rg-1'], 'en');

      expect(mockApiPost).not.toHaveBeenCalled();
      expect(result.get('rg-1')).toEqual({
        name: 'Fireball',
        description: 'A fire spell',
        requires: []
      });
    });

    it('caches requires field from batch API response', async () => {
      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => ({
          ruleGroups: [
            {
              ruleGroupId: 'paladin-1',
              name: 'Paladin L1',
              description: 'Divine warrior',
              requires: ['spellcasting']
            }
          ]
        })
      } as Response);

      const result = await ensureCached(['paladin-1'], 'en');

      expect(result.get('paladin-1')).toEqual({
        name: 'Paladin L1',
        description: 'Divine warrior',
        requires: ['spellcasting']
      });

      // Should be in cache for future calls
      const cachedResult = await ensureCached(['paladin-1'], 'en');
      expect(mockApiPost).toHaveBeenCalledOnce(); // no additional call
      expect(cachedResult.get('paladin-1')?.requires).toEqual(['spellcasting']);
    });

    it('returns empty requires array for groups without deps', async () => {
      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'base', name: 'Base', description: 'Base rules', requires: [] }
          ]
        })
      } as Response);

      const result = await ensureCached(['base'], 'en');

      expect(result.get('base')?.requires).toEqual([]);
    });

    it('fetches uncached IDs via batch API and merges into cache', async () => {
      seedCache({
        'rg-1': { name: 'Fireball', description: 'A fire spell', requires: [] }
      });

      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'rg-2', name: 'Shield', description: 'A shield spell', requires: [] }
          ]
        })
      } as Response);

      const result = await ensureCached(['rg-1', 'rg-2'], 'en');

      // Only uncached IDs should be fetched
      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith('/api/rule-groups/batch?lang=en', { ids: ['rg-2'] });

      // Both entries should be in the result
      expect(result.get('rg-1')).toEqual({
        name: 'Fireball',
        description: 'A fire spell',
        requires: []
      });
      expect(result.get('rg-2')).toEqual({
        name: 'Shield',
        description: 'A shield spell',
        requires: []
      });

      // rg-2 should now be cached
      const cachedResult = await ensureCached(['rg-2'], 'en');
      expect(mockApiPost).toHaveBeenCalledOnce(); // no additional call
      expect(cachedResult.get('rg-2')).toEqual({
        name: 'Shield',
        description: 'A shield spell',
        requires: []
      });
    });

    it('batches requests when more than 100 uncached IDs', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => `rg-${i}`);

      // First batch: ids 0-99, second batch: ids 100-149
      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ruleGroups: Array.from({ length: 100 }, (_, i) => ({
              ruleGroupId: `rg-${i}`,
              name: `Rule ${i}`,
              description: `Description ${i}`
            }))
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ruleGroups: Array.from({ length: 50 }, (_, i) => ({
              ruleGroupId: `rg-${100 + i}`,
              name: `Rule ${100 + i}`,
              description: `Description ${100 + i}`
            }))
          })
        } as Response);

      const result = await ensureCached(ids, 'en');

      expect(mockApiPost).toHaveBeenCalledTimes(2);
      expect(mockApiPost).toHaveBeenNthCalledWith(1, '/api/rule-groups/batch?lang=en', {
        ids: ids.slice(0, 100)
      });
      expect(mockApiPost).toHaveBeenNthCalledWith(2, '/api/rule-groups/batch?lang=en', {
        ids: ids.slice(100)
      });
      expect(result.size).toBe(150);
    });

    it('returns partial results when API fails', async () => {
      seedCache({
        'rg-1': { name: 'Fireball', description: 'A fire spell', requires: [] }
      });

      mockApiPost.mockResolvedValue({
        ok: false,
        status: 500
      } as Response);

      const result = await ensureCached(['rg-1', 'rg-2'], 'en');

      // Should still return the cached entry
      expect(result.get('rg-1')).toEqual({
        name: 'Fireball',
        description: 'A fire spell',
        requires: []
      });
      // Failed entry should not be in result
      expect(result.get('rg-2')).toBeUndefined();
    });
  });
});
