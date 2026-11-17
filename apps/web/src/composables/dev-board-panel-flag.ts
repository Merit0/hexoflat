export function devBoardPanelEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_BOARD_PANEL === 'true';
}
