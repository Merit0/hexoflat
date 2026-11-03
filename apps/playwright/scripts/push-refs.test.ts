import { describe, expect, it } from 'vitest';
import { diffRanges, parsePushRefs, type GitProbe } from './push-refs';

const ZERO = '0'.repeat(40);
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const BASE = 'c'.repeat(40);

const git = (overrides: Partial<GitProbe> = {}): GitProbe => ({
  hasCommit: () => true,
  mergeBase: () => BASE,
  ...overrides,
});

const line = (localSha: string, remoteSha: string, ref = 'refs/heads/x') =>
  `${ref} ${localSha} ${ref} ${remoteSha}`;

describe('parsePushRefs', () => {
  it('reads one ref per line and ignores blanks', () => {
    const refs = parsePushRefs(`${line(A, B)}\n\n${line(B, A, 'refs/heads/y')}\n`);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ localSha: A, remoteSha: B });
  });

  it('returns nothing for empty stdin', () => {
    expect(parsePushRefs('')).toEqual([]);
  });
});

describe('diffRanges', () => {
  it('diffs an existing branch against the remote commit', () => {
    const plan = diffRanges(parsePushRefs(line(A, B)), git());
    expect(plan).toEqual({ ranges: [`${B}..${A}`], fullSuiteBecause: null });
  });

  it('diffs a new branch against the merge-base with origin/main', () => {
    const plan = diffRanges(parsePushRefs(line(A, ZERO)), git());
    expect(plan.ranges).toEqual([`${BASE}..${A}`]);
  });

  it('runs the whole suite for a new branch when origin/main is missing', () => {
    const plan = diffRanges(parsePushRefs(line(A, ZERO)), git({ mergeBase: () => null }));
    expect(plan.fullSuiteBecause).toMatch(/no origin\/main/);
  });

  it('runs nothing for a branch deletion', () => {
    const plan = diffRanges(parsePushRefs(line(ZERO, B)), git());
    expect(plan).toEqual({ ranges: [], fullSuiteBecause: null });
  });

  it('combines the ranges of every pushed ref', () => {
    const stdin = `${line(A, B)}\n${line(B, ZERO, 'refs/heads/y')}\n${line(ZERO, A, 'refs/heads/z')}`;
    expect(diffRanges(parsePushRefs(stdin), git()).ranges).toEqual([`${B}..${A}`, `${BASE}..${B}`]);
  });

  it('runs the whole suite when the remote commit is unknown locally', () => {
    const plan = diffRanges(parsePushRefs(line(A, B)), git({ hasCommit: () => false }));
    expect(plan.fullSuiteBecause).toMatch(/not known locally/);
  });
});
