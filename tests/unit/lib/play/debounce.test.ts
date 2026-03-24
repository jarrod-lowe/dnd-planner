import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function after the specified delay', async () => {
    const { debounce } = await import('$lib/play/debounce');
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('does not call the function before the delay', async () => {
    const { debounce } = await import('$lib/play/debounce');
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();

    vi.advanceTimersByTime(299);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('batches multiple rapid calls into a single call', async () => {
    const { debounce } = await import('$lib/play/debounce');
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    vi.advanceTimersByTime(300);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('resets the delay on each call', async () => {
    const { debounce } = await import('$lib/play/debounce');
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn();
    vi.advanceTimersByTime(200);

    debouncedFn(); // Reset timer
    vi.advanceTimersByTime(200);

    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100); // Total 300 from last call

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the debounced function', async () => {
    const { debounce } = await import('$lib/play/debounce');
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn('arg1', 'arg2');

    vi.advanceTimersByTime(300);

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
