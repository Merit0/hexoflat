import { closeSync, openSync, readdirSync, readSync } from 'node:fs';
import path from 'node:path';
import { PNG_HEADER_BYTES, readPngHeader, type SpriteFile } from '@hexoflat/engine';

function readHead(file: string): Uint8Array {
  const handle = openSync(file, 'r');
  try {
    const head = new Uint8Array(PNG_HEADER_BYTES);
    const read = readSync(handle, head, 0, PNG_HEADER_BYTES, 0);
    return head.subarray(0, read);
  } finally {
    closeSync(handle);
  }
}

export function collectSpriteFiles(itemsDir: string): SpriteFile[] {
  return readdirSync(itemsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      const relative = path.relative(itemsDir, file).split(path.sep).join('/');
      return { path: relative, header: readPngHeader(readHead(file)) };
    });
}
