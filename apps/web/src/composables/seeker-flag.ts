export function seekerQuestsEnabled(): boolean {
  const flag = import.meta.env.VITE_SEEKER_QUESTS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return !import.meta.env.PROD;
}
