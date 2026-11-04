import { ref } from 'vue';

export interface RecentHero {
  name: string;
  color: string;
}

const STORAGE_KEY = 'hexoflat:auth:recent-heroes:v1';
const MAX_HEROES = 3;

function isRecentHero(value: unknown): value is RecentHero {
  if (!value || typeof value !== 'object') return false;
  const hero = value as Record<string, unknown>;
  return typeof hero.name === 'string' && typeof hero.color === 'string';
}

function read(): RecentHero[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecentHero).slice(0, MAX_HEROES) : [];
  } catch {
    return [];
  }
}

function write(heroes: RecentHero[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(heroes));
  } catch {
    return;
  }
}

export function useRecentHeroes() {
  const heroes = ref<RecentHero[]>(read());

  const remember = (hero: RecentHero) => {
    const next = [hero, ...heroes.value.filter((item) => item.name !== hero.name)].slice(
      0,
      MAX_HEROES,
    );
    heroes.value = next;
    write(next);
  };

  return { heroes, remember };
}
