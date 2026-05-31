import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ItemDetail } from '$lib/details/types';

// We'll test the service module which uses fetch internally.
// Mock the locale store.
vi.mock('$lib/i18n', () => {
  let current = 'en';
  const subscribers = new Set<(v: string) => void>();
  return {
    locale: {
      subscribe: (cb: (v: string) => void) => {
        subscribers.add(cb);
        cb(current);
        return { unsubscribe: () => subscribers.delete(cb) };
      },
      get: () => current,
      set: (v: string) => {
        current = v;
        subscribers.forEach((cb) => cb(v));
      }
    }
  };
});

// Import after mocks are set up
import {
  getDetail,
  prefetchDetail,
  peekDetail,
  clearCache,
  _cache,
  _inflight
} from '$lib/details/index';

// Helper: create a detail fixture
function makeDetail(overrides?: Partial<ItemDetail>): ItemDetail {
  return {
    source: 'srd52',
    meta: 'Level 1 Enchantment',
    body: [{ text: ['Some rules text.'] }],
    ...overrides
  };
}

describe('detail service', () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  describe('peekDetail', () => {
    it('returns undefined for unseen key', () => {
      expect(peekDetail('spell/sleep')).toBeUndefined();
    });

    it('returns cached detail after fetch', async () => {
      const detail = makeDetail();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(detail), { status: 200 })
      );

      await getDetail('spell/sleep');
      expect(peekDetail('spell/sleep')).toEqual(detail);
    });

    it('returns null for known-absent key', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

      await getDetail('spell/missing');
      expect(peekDetail('spell/missing')).toBeNull();
    });
  });

  describe('getDetail', () => {
    it('fetches detail for active locale', async () => {
      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

      const result = await getDetail('spell/sleep');

      expect(result).toEqual(detail);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain('/en/spell/sleep.json');
    });

    it('falls back to en when locale has no detail', async () => {
      const { locale } = await import('$lib/i18n');
      locale.set('en-x-tlh');

      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

      const result = await getDetail('spell/sleep');

      expect(result).toEqual(detail);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toContain('/en-x-tlh/spell/sleep.json');
      expect(fetchSpy.mock.calls[1][0]).toContain('/en/spell/sleep.json');

      locale.set('en'); // restore
    });

    it('returns null when both locales 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

      const result = await getDetail('spell/nonexistent');
      expect(result).toBeNull();
    });

    it('returns null on network error without caching', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network fail'));

      const result = await getDetail('spell/sleep');
      expect(result).toBeNull();
      // Transient errors must NOT be cached — peekDetail should be undefined,
      // not null, so the UI allows retry instead of permanently hiding rules mode
      expect(peekDetail('spell/sleep')).toBeUndefined();
    });

    it('retries fetch after transient network error', async () => {
      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

      // First call fails
      const result1 = await getDetail('spell/sleep');
      expect(result1).toBeNull();

      // Second call retries and succeeds
      const result2 = await getDetail('spell/sleep');
      expect(result2).toEqual(detail);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns null on HTTP 500 without caching', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

      const result = await getDetail('spell/sleep');
      expect(result).toBeNull();
      // Server errors must NOT be cached — peekDetail should be undefined,
      // not null, so the UI allows retry instead of permanently hiding rules mode
      expect(peekDetail('spell/sleep')).toBeUndefined();
    });

    it('retries fetch after HTTP 500', async () => {
      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

      // First call hits 500
      const result1 = await getDetail('spell/sleep');
      expect(result1).toBeNull();

      // Second call retries and succeeds
      const result2 = await getDetail('spell/sleep');
      expect(result2).toEqual(detail);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('falls back to en and caches when locale returns 500 but en returns 200', async () => {
      const { locale } = await import('$lib/i18n');
      locale.set('fr');

      const detail = makeDetail({ meta: 'English fallback' });
      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | Request | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/fr/')) {
          return Promise.resolve(new Response(null, { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify(detail), { status: 200 }));
      });

      const result = await getDetail('spell/sleep');
      expect(result).toEqual(detail);
      // Should be cached (successful fallback)
      expect(peekDetail('spell/sleep')).toEqual(detail);

      locale.set('en'); // restore
    });

    it('does not cache when locale returns 500 and en returns 404', async () => {
      const { locale } = await import('$lib/i18n');
      locale.set('fr');

      vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | Request | URL) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u.includes('/fr/')) {
          return Promise.resolve(new Response(null, { status: 500 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const result = await getDetail('spell/sleep');
      expect(result).toBeNull();
      // Must NOT be cached — the 500 means we don't know if the file exists
      expect(peekDetail('spell/sleep')).toBeUndefined();

      locale.set('en'); // restore
    });

    it('serves from cache on second call', async () => {
      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

      await getDetail('spell/sleep');
      await getDetail('spell/sleep');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('re-fetches when locale changes after cache', async () => {
      const { locale } = await import('$lib/i18n');
      const enDetail = makeDetail({ meta: 'English' });
      const tlhDetail = makeDetail({ meta: 'Klingon' });

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url: string | Request | URL) => {
          const u = typeof url === 'string' ? url : url.toString();
          if (u.includes('/en-x-tlh/')) {
            return Promise.resolve(new Response(JSON.stringify(tlhDetail), { status: 200 }));
          }
          return Promise.resolve(new Response(JSON.stringify(enDetail), { status: 200 }));
        });

      // Fetch in English
      const result1 = await getDetail('spell/sleep');
      expect(result1!.meta).toBe('English');

      // Switch locale
      locale.set('en-x-tlh');

      // Should re-fetch for the new locale, not return the cached English version
      const result2 = await getDetail('spell/sleep');
      expect(result2!.meta).toBe('Klingon');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      locale.set('en'); // restore
    });
  });

  describe('prefetchDetail', () => {
    it('populates cache without returning', async () => {
      const detail = makeDetail();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(detail), { status: 200 })
      );

      prefetchDetail('spell/sleep');
      // Not in cache yet (async)
      expect(peekDetail('spell/sleep')).toBeUndefined();

      // Wait for inflight
      await getDetail('spell/sleep');
      expect(peekDetail('spell/sleep')).toEqual(detail);
    });

    it('dedupes concurrent prefetches', async () => {
      const detail = makeDetail();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

      prefetchDetail('spell/sleep');
      prefetchDetail('spell/sleep');
      prefetchDetail('spell/sleep');

      await getDetail('spell/sleep');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('skips empty key', () => {
      prefetchDetail('');
      expect(_inflight.size).toBe(0);
    });

    it('skips already-cached key', async () => {
      const detail = makeDetail();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(detail), { status: 200 })
      );

      await getDetail('spell/sleep');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      prefetchDetail('spell/sleep');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when cache exceeds max', async () => {
      const detail = makeDetail();
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(detail), { status: 200 }))
      );

      // Fill 60 entries (default MAX_ENTRIES)
      for (let i = 0; i < 60; i++) {
        await getDetail(`spell/spell-${i}`);
      }
      expect(_cache.size).toBe(60);

      // Add one more - should evict the oldest
      await getDetail('spell/spell-60');
      expect(_cache.size).toBe(60);
      expect(_cache.has('en:spell/spell-0')).toBe(false);
      expect(_cache.has('en:spell/spell-60')).toBe(true);
    });
  });
});
