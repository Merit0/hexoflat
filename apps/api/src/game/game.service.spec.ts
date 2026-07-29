import { describe, expect, it } from 'vitest';
import { GameService } from './game.service';

describe('GameService', () => {
  it('creates and lists saves', () => {
    const service = new GameService();
    expect(service.list()).toEqual([]);

    const created = service.create({ name: 'campaign-1' });
    expect(created).toMatchObject({ name: 'campaign-1' });
    expect(service.list()).toEqual([created]);
  });
});
