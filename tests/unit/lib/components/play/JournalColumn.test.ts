import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import JournalColumn from '$lib/components/play/JournalColumn.svelte';

describe('JournalColumn', () => {
  it('renders TODO placeholder', () => {
    const { getByText } = render(JournalColumn);

    expect(getByText('play.journal.todo')).toBeTruthy();
  });

  it('has proper container structure', () => {
    const { container } = render(JournalColumn);

    expect(container.querySelector('.journal-column')).toBeTruthy();
  });
});
