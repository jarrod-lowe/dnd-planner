type CompanionView = string; // 'player' for player view, or any subject string

let activeView: CompanionView = $state('player');

export function getCompanionView(): CompanionView {
  return activeView;
}

export function setCompanionView(view: CompanionView): void {
  activeView = view;
}

export function isSteedView(): boolean {
  return activeView === 'steed';
}

export function resetCompanionView(): void {
  activeView = 'player';
}
