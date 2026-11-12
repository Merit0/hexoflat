const MAX_OFFSET = 24;
const INDEX_LENGTH = 64;
const SAFE_DIGITS = 15;

function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let n = from; n <= to; n += 1) values.push(n);
  return values;
}

function listOf(length: number, term: (n: number) => number): number[] {
  return range(1, length).map(term);
}

function primesList(length: number): number[] {
  const primes: number[] = [];
  for (let candidate = 2; primes.length < length; candidate += 1) {
    if (primes.every((p) => candidate % p !== 0)) primes.push(candidate);
  }
  return primes;
}

function lookAndSay(seed: number): number[] {
  const terms: number[] = [];
  let current = String(seed);
  while (current.length <= SAFE_DIGITS) {
    terms.push(Number(current));
    current = current.replace(/(\d)\1*/g, (run) => `${run.length}${run[0]}`);
  }
  return terms;
}

function buildIndexSequences(): number[][] {
  const sequences: number[][] = [
    listOf(INDEX_LENGTH, (n) => n * n),
    listOf(INDEX_LENGTH, (n) => n * n * n),
    listOf(INDEX_LENGTH, (n) => (n * (n + 1)) / 2),
    listOf(INDEX_LENGTH, (n) => 3 * n * (n - 1) + 1),
    listOf(INDEX_LENGTH, (n) => n * (n + 1)),
    primesList(INDEX_LENGTH),
  ];
  for (const add of range(-10, 10)) {
    sequences.push(listOf(INDEX_LENGTH, (n) => n * n + add));
    sequences.push(listOf(INDEX_LENGTH, (n) => n * n * n + add));
  }
  for (const seed of range(1, 9)) sequences.push(lookAndSay(seed));
  return sequences;
}

const INDEX_SEQUENCES = buildIndexSequences();

function startsWith(sequence: readonly number[], offset: number, prefix: readonly number[]) {
  return prefix.every((value, i) => sequence[offset + i] === value);
}

function indexNexts(prefix: readonly number[]): number[] {
  const nexts: number[] = [];
  for (const sequence of INDEX_SEQUENCES) {
    for (let offset = 0; offset <= MAX_OFFSET; offset += 1) {
      const next = sequence[offset + prefix.length];
      if (next !== undefined && startsWith(sequence, offset, prefix)) nexts.push(next);
    }
  }
  return nexts;
}

function holds(prefix: readonly number[], step: (index: number, value: number) => number): boolean {
  return prefix.every((value, i) => i === 0 || step(i, prefix[i - 1]) === value);
}

function arithNext(prefix: readonly number[]): number | null {
  if (prefix.length < 2) return null;
  const step = prefix[1] - prefix[0];
  return holds(prefix, (_i, v) => v + step) ? prefix[prefix.length - 1] + step : null;
}

function geomNext(prefix: readonly number[]): number | null {
  if (prefix.length < 2 || prefix[0] <= 0 || prefix[1] <= 0) return null;
  const last = prefix[prefix.length - 1];
  if (prefix[1] % prefix[0] === 0 && prefix[1] / prefix[0] >= 2) {
    const ratio = prefix[1] / prefix[0];
    return holds(prefix, (_i, v) => v * ratio) ? last * ratio : null;
  }
  if (prefix[0] % prefix[1] === 0 && prefix[0] / prefix[1] >= 2) {
    const ratio = prefix[0] / prefix[1];
    return holds(prefix, (_i, v) => v / ratio) && last % ratio === 0 ? last / ratio : null;
  }
  return null;
}

function alternatingNext(prefix: readonly number[]): number | null {
  if (prefix.length < 3) return null;
  const steps = [prefix[1] - prefix[0], prefix[2] - prefix[1]];
  if (!holds(prefix, (i, v) => v + steps[(i - 1) % 2])) return null;
  return prefix[prefix.length - 1] + steps[(prefix.length - 1) % 2];
}

function growingNext(prefix: readonly number[]): number | null {
  if (prefix.length < 3) return null;
  const step0 = prefix[1] - prefix[0];
  const inc = prefix[2] - prefix[1] - step0;
  if (!holds(prefix, (i, v) => v + step0 + (i - 1) * inc)) return null;
  return prefix[prefix.length - 1] + step0 + (prefix.length - 1) * inc;
}

function affineNext(prefix: readonly number[]): number | null {
  if (prefix.length < 3) return null;
  const first = prefix[1] - prefix[0];
  const second = prefix[2] - prefix[1];
  if (first === 0 || second % first !== 0) return null;
  const mul = second / first;
  const add = prefix[1] - mul * prefix[0];
  if (!holds(prefix, (_i, v) => v * mul + add)) return null;
  return prefix[prefix.length - 1] * mul + add;
}

function fibonacciNext(prefix: readonly number[]): number | null {
  if (prefix.length < 2) return null;
  const sums = prefix.every((value, i) => i < 2 || value === prefix[i - 1] + prefix[i - 2]);
  return sums ? prefix[prefix.length - 1] + prefix[prefix.length - 2] : null;
}

const FITTERS: ReadonlyArray<(prefix: readonly number[]) => number | null> = [
  arithNext,
  geomNext,
  alternatingNext,
  growingNext,
  affineNext,
  fibonacciNext,
];

export function matchingNexts(prefix: readonly number[]): number[] {
  const nexts: number[] = [];
  for (const fit of FITTERS) {
    const next = fit(prefix);
    if (next !== null) nexts.push(next);
  }
  return [...nexts, ...indexNexts(prefix)].filter((next) => Number.isInteger(next) && next > 0);
}

export function isUnambiguous(prefix: readonly number[], intendedNext: number): boolean {
  return matchingNexts(prefix).every((next) => next === intendedNext);
}

export function hintStepsFor(terms: readonly number[], minHint: number): number | null {
  let hint = minHint;
  for (let at = terms.length - 1; at >= hint; at -= 1) {
    if (!isUnambiguous(terms.slice(0, at), terms[at])) {
      hint = at + 1;
      break;
    }
  }
  return hint <= terms.length - 2 ? hint : null;
}
