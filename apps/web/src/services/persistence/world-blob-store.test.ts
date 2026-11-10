import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blobKeys,
  clearBlobs,
  onBlobsChanged,
  readBlob,
  removeBlob,
  replaceBlobs,
  writeBlob,
} from './world-blob-store';

describe('world blob store', () => {
  beforeEach(() => {
    clearBlobs();
    onBlobsChanged(null);
  });

  it('reads back what was written, synchronously, and forgets what was removed', () => {
    writeBlob('map:a', '{"x":1}');
    expect(readBlob('map:a')).toBe('{"x":1}');
    removeBlob('map:a');
    expect(readBlob('map:a')).toBeNull();
  });

  it('announces writes and removals, but not a removal of something that is not there', () => {
    const heard = vi.fn();
    onBlobsChanged(heard);
    writeBlob('nav', '1');
    removeBlob('nav');
    removeBlob('nav');
    expect(heard.mock.calls).toEqual([
      [{ put: ['nav'], removed: [] }],
      [{ put: [], removed: ['nav'] }],
    ]);
  });

  it('replaces everything silently when the server sends its copy', () => {
    writeBlob('old', '1');
    const heard = vi.fn();
    onBlobsChanged(heard);
    replaceBlobs({ index: '{}', 'map:b': '2' });
    expect(blobKeys().sort()).toEqual(['index', 'map:b']);
    expect(blobKeys('map:')).toEqual(['map:b']);
    expect(heard).not.toHaveBeenCalled();
  });
});
