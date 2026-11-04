export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export const MIN_PASSWORD_SCORE = 2;

export const STRENGTH_COLORS = ['#4a4a4f', '#E5484D', '#f5a524', '#8ba2b8', '#5fd4a0'] as const;

export function passwordScore(password: string): PasswordScore {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++;
  if (password.length > 0 && password.length < 8) score = Math.min(score, 1);
  return score as PasswordScore;
}

export function isPasswordStrongEnough(password: string): boolean {
  return passwordScore(password) >= MIN_PASSWORD_SCORE;
}
