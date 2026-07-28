export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj as Readonly<T>;

  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object') deepFreeze(value);
  }

  return Object.freeze(obj) as Readonly<T>;
}
