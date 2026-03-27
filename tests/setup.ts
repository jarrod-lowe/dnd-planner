import { vi } from 'vitest';

// Mock Web Animations API for Svelte transitions in jsdom
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    reverse: vi.fn(),
    finish: vi.fn()
  });
}

// Mock sveltekit-i18n to prevent actual loader calls during tests
vi.mock('sveltekit-i18n', () => ({
  default: class MockI18n {
    t = {
      subscribe: vi.fn((fn: (value: (key: string) => string) => void) => {
        fn((key: string) => key);
        return { unsubscribe: vi.fn() };
      })
    };
    locale = {
      subscribe: vi.fn((fn: (value: string) => void) => {
        fn('en');
        return { unsubscribe: vi.fn() };
      }),
      set: vi.fn()
    };
    loading = {
      subscribe: vi.fn((fn: (value: boolean) => void) => {
        fn(false);
        return { unsubscribe: vi.fn() };
      })
    };
    initialized = {
      subscribe: vi.fn((fn: (value: boolean) => void) => {
        fn(true);
        return { unsubscribe: vi.fn() };
      })
    };
  }
}));
