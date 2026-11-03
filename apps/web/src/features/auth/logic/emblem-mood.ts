import type { GazePoint } from './gaze';

export type AuthFocus = '' | 'name' | 'password' | 'newName' | 'newPassword';

export interface EmblemMoodInput {
  focus: AuthFocus;
  show: boolean;
  blink: boolean;
  loading: boolean;
  gaze: GazePoint;
  nameLength: number;
}

export interface EmblemMood {
  eyeX: number;
  eyeY: number;
  eyesClosed: boolean;
  heartSeconds: number;
}

export function deriveEmblemMood(input: EmblemMoodInput): EmblemMood {
  const { focus, show, blink, loading, gaze, nameLength } = input;
  let eyeX = gaze.x;
  let eyeY = gaze.y;

  if (focus === 'name' || focus === 'newName') {
    eyeX = -4 + (Math.min(nameLength, 18) / 18) * 8;
    eyeY = 3;
  }
  if (focus === 'password' && show) {
    eyeX = 4.5;
    eyeY = 2;
  }

  const eyesClosed = blink || (focus === 'password' && !show) || focus === 'newPassword';
  const heartSeconds = loading ? 0.5 : focus ? 1.5 : 2.4;

  return { eyeX, eyeY, eyesClosed, heartSeconds };
}
