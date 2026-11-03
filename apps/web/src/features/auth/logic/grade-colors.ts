export type Grade = 2 | 3 | 4 | 5;

export const GRADES: readonly Grade[] = [2, 3, 4, 5];

export const DEFAULT_GRADE: Grade = 4;

export const GRADE_COLORS: Record<Grade, string> = {
  2: '#8FD3B6',
  3: '#F2C46D',
  4: '#7FB8E6',
  5: '#C9A7F0',
};

export function heroColorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADE_COLORS[GRADES[hash % GRADES.length]];
}
