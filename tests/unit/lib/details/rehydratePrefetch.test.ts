import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock i18n
vi.mock('$lib/i18n', () => ({
  t: {
    subscribe: (cb: (v: (k: string) => string) => void) => {
      cb((k: string) => k);
      return { unsubscribe: () => {} };
    }
  },
  locale: {
    subscribe: (cb: (v: string) => void) => {
      cb('en');
      return { unsubscribe: () => {} };
    },
    get: () => 'en'
  }
}));

// Mock api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

// Mock rules engine
vi.mock('$lib/rules-view', () => ({
  evaluate: vi.fn(() => ({
    facts: {},
    effects: [],
    offers: [],
    annotations: []
  }))
}));

// Mock detail service to track prefetch calls
vi.mock('$lib/details/index', () => ({
  prefetchDetail: vi.fn(),
  getDetail: vi.fn(),
  peekDetail: vi.fn(),
  clearCache: vi.fn()
}));

import { prefetchDetailsForEffects } from '$lib/details/rehydrate';
import { prefetchDetail } from '$lib/details/index';

const mockPrefetchDetail = vi.mocked(prefetchDetail);

describe('prefetchDetailsForEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prefetchDetail for each effect with a detailKey', () => {
    const effects = [
      { id: 'spell-bless', activities: [], ui: { detailKey: 'spell/bless' } },
      { id: 'spell-sleep', activities: [], ui: { detailKey: 'spell/sleep' } },
      { id: 'no-detail', activities: [] }
    ];

    prefetchDetailsForEffects(effects as import('$lib/rules-view').Rule[]);

    expect(mockPrefetchDetail).toHaveBeenCalledTimes(2);
    expect(mockPrefetchDetail).toHaveBeenCalledWith('spell/bless');
    expect(mockPrefetchDetail).toHaveBeenCalledWith('spell/sleep');
  });

  it('skips effects with no ui field', () => {
    const effects = [
      { id: 'bare', activities: [] },
      { id: 'with-key', activities: [], ui: { detailKey: 'feature/test' } }
    ];

    prefetchDetailsForEffects(effects as import('$lib/rules-view').Rule[]);

    expect(mockPrefetchDetail).toHaveBeenCalledTimes(1);
    expect(mockPrefetchDetail).toHaveBeenCalledWith('feature/test');
  });

  it('handles empty array', () => {
    prefetchDetailsForEffects([]);
    expect(mockPrefetchDetail).not.toHaveBeenCalled();
  });
});
