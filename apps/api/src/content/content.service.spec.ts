import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';

describe('ContentService', () => {
  it('lists known Hexobject keys with the content version', () => {
    const service = new ContentService();
    const result = service.listKeys();
    expect(result.keys).toContain('tree');
    expect(result.version).toBeDefined();
  });

  it('returns prototype and meta for a known key', () => {
    const service = new ContentService();
    const result = service.getByKey('tree');
    expect(result.prototype).toBeDefined();
    expect(result.meta).toBeDefined();
  });

  it('throws NotFoundException for an unknown key', () => {
    const service = new ContentService();
    expect(() => service.getByKey('not-a-real-key')).toThrow(NotFoundException);
  });
});
