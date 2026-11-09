import { describe, expect, it } from 'vitest';
import { corsOptions } from './cors';

describe('cors options', () => {
  it('lets the browser call every verb the client uses, including the world PUT', () => {
    expect(corsOptions().methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH']));
  });

  it('allows the player session header on those calls', () => {
    expect(corsOptions().allowedHeaders).toContain('X-Player-Session');
  });
});
