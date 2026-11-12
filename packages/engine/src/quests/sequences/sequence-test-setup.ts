import { RULES, termsOf, type SequenceRule } from './rules';

const LENGTH = 14;

function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let n = from; n <= to; n += 1) values.push(n);
  return values;
}

function fromRule(rule: SequenceRule | null): number[][] {
  return rule ? [termsOf(rule, LENGTH)] : [];
}

function recurrent(kind: string, values: Record<string, number>): number[][] {
  return fromRule(RULES[kind].build(values));
}

function recurrentTables(): number[][] {
  const tables: number[][] = [];
  for (const start of range(0, 110)) {
    for (const step of range(-10, 10)) tables.push(...recurrent('arith', { start, step }));
  }
  for (const start of range(1, 10)) {
    for (const ratio of range(2, 4)) tables.push(...recurrent('geom', { start, ratio }));
  }
  for (const start of range(1, 8)) {
    for (const stepA of range(-6, 6)) {
      for (const stepB of range(-6, 6)) {
        tables.push(...recurrent('alternating', { start, stepA, stepB }));
      }
    }
    for (const step0 of range(1, 5)) {
      for (const inc of range(1, 4))
        tables.push(...recurrent('growingStep', { start, step0, inc }));
    }
  }
  return tables;
}

function fibonacciTables(): number[][] {
  const tables: number[][] = [];
  for (const a of range(1, 5)) {
    for (const b of range(1, 5)) {
      const terms = [a, b];
      while (terms.length < LENGTH) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
      tables.push(terms);
    }
  }
  return tables;
}

function indexTables(): number[][] {
  const tables: number[][] = [];
  const formulas: Array<(n: number) => number> = [
    (n) => n * n,
    (n) => n * n * n,
    (n) => (n * (n + 1)) / 2,
    (n) => 3 * n * (n - 1) + 1,
  ];
  for (const formula of formulas) {
    for (const offset of range(0, 10)) {
      tables.push(range(1, LENGTH).map((n) => formula(n + offset)));
    }
  }
  for (const add of range(-5, 5)) {
    for (const offset of range(0, 10)) {
      tables.push(range(1, LENGTH).map((n) => (n + offset) ** 2 + add));
    }
  }
  return tables;
}

const TABLES = [...recurrentTables(), ...fibonacciTables(), ...indexTables()];

export function bruteNexts(prefix: readonly number[]): number[] {
  const nexts: number[] = [];
  for (const table of TABLES) {
    if (prefix.every((value, i) => table[i] === value) && table[prefix.length] > 0) {
      nexts.push(table[prefix.length]);
    }
  }
  return nexts;
}
