import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PackedChoiceGroup from '$lib/components/play/PackedChoiceGroup.svelte';
import type { AvailableRuleEntry } from '$lib/rules-view';

// Mock element.animate for JSDOM (used by Svelte transitions)
beforeAll(() => {
  Element.prototype.animate = vi.fn().mockImplementation(function () {
    const animation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      reverse: vi.fn(),
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null
    };
    // Immediately call onfinish to simulate animation completion
    setTimeout(() => {
      if (animation.onfinish) animation.onfinish();
    }, 0);
    return animation;
  });
});

const createMockEntry = (
  id: string,
  options?: {
    name?: string;
    legal?: boolean;
    applicable?: boolean;
  }
): AvailableRuleEntry => ({
  rule: {
    id,
    activities: [],
    ui: options?.name ? { name: options.name } : undefined
  },
  legal: options?.legal ?? true,
  applicable: options?.applicable ?? true,
  diagnostics: []
});

describe('PackedChoiceGroup', () => {
  const leader = createMockEntry('move-walk', { name: 'Walk' });
  const swim = createMockEntry('move-swim', { name: 'Swim' });
  const fly = createMockEntry('move-fly', { name: 'Fly' });
  const followers = [swim, fly];

  describe('collapsed state (default)', () => {
    it('renders the leader PanelRenderer', () => {
      const { getByText } = render(PackedChoiceGroup, {
        props: { leader, followers, onAddToPlan: vi.fn() }
      });

      expect(getByText('Walk')).toBeTruthy();
    });

    it('renders the CompactRow with follower names', () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers, onAddToPlan: vi.fn() }
      });

      // Should show follower names in the compact row
      const compactNames = container.querySelector('.packed-group__compact-names');
      expect(compactNames).toBeTruthy();
      expect(compactNames!.textContent).toContain('Swim');
      expect(compactNames!.textContent).toContain('Fly');
    });

    it('does not render follower panels when collapsed', () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      // The follower panels should not exist when collapsed
      const followerPanels = container.querySelectorAll('.packed-group__followers .panel-renderer');
      expect(followerPanels).toHaveLength(0);
    });
  });

  describe('expand/collapse behavior', () => {
    it('expands when CompactRow is tapped', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      // Find and click the compact row
      const compactRow = container.querySelector('.packed-group__compact-row');
      expect(compactRow).toBeTruthy();
      await fireEvent.click(compactRow!);

      // Now should show a follower panel for swim
      const followerPanels = container.querySelectorAll('.packed-group__followers .panel-renderer');
      expect(followerPanels).toHaveLength(1);
    });

    it('collapses when CompactRow is tapped again', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');

      // Expand
      await fireEvent.click(compactRow!);
      const followerPanels = container.querySelectorAll('.packed-group__followers .panel-renderer');
      expect(followerPanels).toHaveLength(1);

      // Collapse - need to wait for animation to complete
      await fireEvent.click(compactRow!);
      // Wait for the slide-out animation mock to complete (setTimeout 0)
      await vi.waitFor(() => {
        const panels = container.querySelectorAll('.packed-group__followers .panel-renderer');
        expect(panels).toHaveLength(0);
      });
    });

    it('shows expanded indicator when expanded', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');

      // Check collapsed state
      expect(compactRow!.classList.contains('packed-group__compact-row--expanded')).toBe(false);

      // Expand
      await fireEvent.click(compactRow!);
      expect(compactRow!.classList.contains('packed-group__compact-row--expanded')).toBe(true);
    });
  });

  describe('Follower panel interaction', () => {
    it('calls onAddToPlan with the follower entry when tapped', async () => {
      const onAddToPlan = vi.fn();
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan }
      });

      // Expand first
      const compactRow = container.querySelector('.packed-group__compact-row');
      await fireEvent.click(compactRow!);

      // Click on swim follower panel
      const swimPanel = container.querySelector('.packed-group__followers .panel-renderer');
      expect(swimPanel).toBeTruthy();
      await fireEvent.click(swimPanel!);

      expect(onAddToPlan).toHaveBeenCalledWith(swim);
    });

    it('does NOT collapse the group when follower panel is tapped', async () => {
      const onAddToPlan = vi.fn();
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan }
      });

      // Expand first
      const compactRow = container.querySelector('.packed-group__compact-row');
      await fireEvent.click(compactRow!);

      // Click on swim follower panel
      const swimPanel = container.querySelector('.packed-group__followers .panel-renderer');
      await fireEvent.click(swimPanel!);

      // Group should still be expanded
      expect(compactRow!.classList.contains('packed-group__compact-row--expanded')).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('CompactRow is a button element', () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');
      expect(compactRow!.tagName).toBe('BUTTON');
    });

    it('CompactRow has aria-expanded attribute', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn() }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');
      expect(compactRow!.getAttribute('aria-expanded')).toBe('false');

      // After expansion
      await fireEvent.click(compactRow!);
      expect(compactRow!.getAttribute('aria-expanded')).toBe('true');
    });

    it('CompactRow has aria-label', () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim, fly], onAddToPlan: vi.fn() }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');
      const ariaLabel = compactRow!.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });
  });

  describe('readOnly mode (effects)', () => {
    it('renders leader as non-editable PanelRenderer when readOnly=true', () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn(), readOnly: true }
      });

      // Should render a PanelRenderer for the leader (non-editable, no tap)
      const panelRenderer = container.querySelector('.panel-renderer');
      expect(panelRenderer).toBeTruthy();
      // No --editable class because it's always non-editable in PackedChoiceGroup
      expect(panelRenderer!.classList.contains('panel-renderer--editable')).toBe(false);
    });

    it('renders followers as PanelRenderer when readOnly=true and expanded', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn(), readOnly: true }
      });

      // Expand
      const compactRow = container.querySelector('.packed-group__compact-row');
      await fireEvent.click(compactRow!);

      // Followers should be rendered as PanelRenderer
      const followerPanels = container.querySelectorAll('.packed-group__followers .panel-renderer');
      expect(followerPanels).toHaveLength(1);
    });

    it('still allows expand/collapse when readOnly=true', async () => {
      const { container } = render(PackedChoiceGroup, {
        props: { leader, followers: [swim], onAddToPlan: vi.fn(), readOnly: true }
      });

      const compactRow = container.querySelector('.packed-group__compact-row');

      // Expand
      await fireEvent.click(compactRow!);
      expect(compactRow!.classList.contains('packed-group__compact-row--expanded')).toBe(true);

      // Collapse
      await fireEvent.click(compactRow!);
      await vi.waitFor(() => {
        const panels = container.querySelectorAll('.packed-group__followers .panel-renderer');
        expect(panels).toHaveLength(0);
      });
    });
  });
});
