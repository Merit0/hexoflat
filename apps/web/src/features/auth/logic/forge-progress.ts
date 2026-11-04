export interface ForgeInput {
  name: string;
  score: number;
  email: string;
}

export const FORGE_STEP_COUNT = 4;

export function isGuardianEmailValid(email: string): boolean {
  return /.+@.+\..+/.test(email);
}

export function forgeSteps({
  name,
  score,
  email,
}: ForgeInput): [boolean, boolean, boolean, boolean] {
  return [!!name.trim(), score >= 2, true, isGuardianEmailValid(email)];
}

export function forgeDone(steps: readonly boolean[]): number {
  return steps.filter(Boolean).length;
}
