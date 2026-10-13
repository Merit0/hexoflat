export type WillZone = 'free' | 'paid';

export interface WillZoneContext {
  willZone: WillZone;
  combatActive: boolean;
}

export function willZoneCharges(ctx: WillZoneContext): boolean {
  return ctx.willZone !== 'free' && !ctx.combatActive;
}
