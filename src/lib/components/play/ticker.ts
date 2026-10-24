import type { Action } from 'svelte/action';

/**
 * Constant tape speed in px/s. The loop duration is content-length
 * proportional (duration = measured width / speed) so every tape reads at the
 * same pace however long its label — a fixed duration would make long labels
 * race and short ones crawl.
 */
const PX_PER_SECOND = 60;

/**
 * Ticker-tape marquee for a clamped label line. Applied by Ticker.svelte;
 * the layout it drives lives in the `.ticker` utility in base.css.
 *
 * The action owns exactly one decision — "does this line overflow its
 * clamp?" — and publishes it as the `[data-ticker]` attribute plus a
 * content-proportional `--ticker-duration` CSS variable. Everything else
 * (hiding the scrollbar, showing the duplicate copy, running and pausing the
 * animation, and standing down under prefers-reduced-motion) is CSS, so a
 * preference change takes effect without re-measuring.
 *
 * With no `[data-ticker]` the duplicate copy is display:none, so a cold
 * scrollWidth is the single copy's width and clientWidth the clamp: their
 * difference is the overflow question. jsdom does no layout (both are 0), so
 * in unit tests the tape never engages — the action's own tests stub the two
 * metrics instead.
 */
export const ticker: Action<HTMLElement> = (node) => {
  function refresh(): void {
    node.removeAttribute('data-ticker');
    node.style.removeProperty('--ticker-duration');
    // Fits: static, centred, manually swipeable — no tape.
    if (node.scrollWidth - node.clientWidth <= 0) return;
    node.style.setProperty(
      '--ticker-duration',
      `${(node.scrollWidth / PX_PER_SECOND).toFixed(2)}s`
    );
    node.setAttribute('data-ticker', '');
  }

  const observer = new ResizeObserver(refresh);
  observer.observe(node);
  // The original copy only, never the duplicate: toggling `[data-ticker]`
  // resizes the duplicate (display:none ↔ flex item), and observing it would
  // ping-pong refresh() forever. The original resizes only when the text,
  // locale, or font actually changes — exactly when the tape must re-time.
  for (const copy of node.querySelectorAll(':scope > .ticker__copy:not(.ticker__copy--dup)')) {
    observer.observe(copy);
  }
  refresh();

  return {
    destroy() {
      observer.disconnect();
    }
  };
};
