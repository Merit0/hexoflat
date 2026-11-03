import type { GazePoint } from './gaze';

export type EmblemExpression = 'none' | 'wonky' | 'wonkyFlip' | 'wink' | 'cross' | 'wow' | 'sleepy';

export const IDLE_EXPRESSIONS: readonly EmblemExpression[] = [
  'wonky',
  'wink',
  'cross',
  'wow',
  'wonkyFlip',
  'sleepy',
];

export interface EyeLook {
  leftScale: number;
  rightScale: number;
  leftClosed: boolean;
  rightClosed: boolean;
  leftDx: number;
  rightDx: number;
}

const NEUTRAL_LOOK: EyeLook = {
  leftScale: 1,
  rightScale: 1,
  leftClosed: false,
  rightClosed: false,
  leftDx: 0,
  rightDx: 0,
};

const LOOKS: Record<EmblemExpression, EyeLook> = {
  none: NEUTRAL_LOOK,
  wonky: { ...NEUTRAL_LOOK, leftScale: 1.55, rightScale: 0.6 },
  wonkyFlip: { ...NEUTRAL_LOOK, leftScale: 0.6, rightScale: 1.55 },
  wink: { ...NEUTRAL_LOOK, rightClosed: true, leftScale: 1.15 },
  cross: { ...NEUTRAL_LOOK, leftDx: 5, rightDx: -5 },
  wow: { ...NEUTRAL_LOOK, leftScale: 1.6, rightScale: 1.6 },
  sleepy: { ...NEUTRAL_LOOK, leftClosed: true, rightClosed: true },
};

export function eyeLookFor(expression: EmblemExpression): EyeLook {
  return LOOKS[expression];
}

export type AuthFocus = '' | 'name' | 'password' | 'newName' | 'newPassword';

export interface EmblemMoodInput {
  focus: AuthFocus;
  show: boolean;
  blink: boolean;
  loading: boolean;
  gaze: GazePoint;
  nameLength: number;
  expression?: EmblemExpression;
}

export interface EmblemMood {
  eyeX: number;
  eyeY: number;
  eyesClosed: boolean;
  heartSeconds: number;
  look: EyeLook;
}

export function deriveEmblemMood(input: EmblemMoodInput): EmblemMood {
  const { focus, show, blink, loading, gaze, nameLength, expression = 'none' } = input;
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
  let heartSeconds = loading ? 0.5 : focus ? 1.5 : 2.4;

  const playful = !focus && !loading && !blink;
  const active = playful ? expression : 'none';
  if (active === 'wow') heartSeconds = 0.9;
  if (active === 'sleepy') heartSeconds = 3.6;

  return { eyeX, eyeY, eyesClosed, heartSeconds, look: eyeLookFor(active) };
}
