import type { TTokenSourceKind } from './token-keys';

function sourcePart(value: string): string {
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  return `_u${Array.from(value, (char) => char.codePointAt(0)!.toString(16)).join('-')}`;
}

/** Segments are encoded independently; neither separators nor case can alias another source. */
export function tokenSourceIdOf(kind: TTokenSourceKind, ...parts: string[]): string {
  return `${kind}:${parts.map(sourcePart).join('.')}`;
}

export function decodedSourceId(sourceId: string): string {
  return sourceId.replace(/_u([0-9a-f]+(?:-[0-9a-f]+)*)/g, (original, encoded: string) => {
    const points = encoded.split('-').map((point) => Number.parseInt(point, 16));
    if (points.some((point) => point > 0x10ffff)) return original;
    return points.map((point) => String.fromCodePoint(point)).join('');
  });
}
