export function assertNever(x: never, msg?: string): never {
  throw new Error(msg ?? `Unexpected object: ${String(x)}`);
}
