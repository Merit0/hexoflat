export type Grade = 2 | 3 | 4 | 5;

export const GRADES: readonly Grade[] = [2, 3, 4, 5];

export const DEFAULT_GRADE: Grade = 4;

export const GRADE_COLORS: Record<Grade, string> = {
  2: '#8fd3b6',
  3: '#f2c46d',
  4: '#8ba2b8',
  5: '#c9a7f0',
};

export function heroColorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADE_COLORS[GRADES[hash % GRADES.length]];
}
