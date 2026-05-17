export type UiLayout = 'classic' | 'intent';

interface UiPrefsState {
  layout: UiLayout;
}

const STORAGE_KEY = 'dnd-planner-ui-layout';
const DEFAULT_LAYOUT: UiLayout = 'classic';

function readStored(): UiLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'classic' || stored === 'intent') return stored;
  } catch {
    // localStorage unavailable (SSR, test env, etc.)
  }
  return DEFAULT_LAYOUT;
}

let state = $state<UiPrefsState>({ layout: readStored() });

function setLayout(layout: UiLayout): void {
  state = { ...state, layout };
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // localStorage unavailable
  }
}

export const uiPrefsStore = {
  get state() {
    return state;
  },
  setLayout
};
