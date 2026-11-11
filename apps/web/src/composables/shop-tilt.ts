import { randomTokenRotationDeg } from '@/render/token-utils';

const tilts = new Map<string, number>();

export function shopTiltOf(list: string, index: number, key: string): number {
  const id = `${list}:${index}:${key}`;
  const known = tilts.get(id);
  if (known !== undefined) return known;
  const fresh = randomTokenRotationDeg();
  tilts.set(id, fresh);
  return fresh;
}
