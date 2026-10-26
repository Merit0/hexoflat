import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { PortalLink } from '../portal/portal-state';

export interface HeroState {
  id: string;
  controlledBy: string | null;
  coordinates: IHexCoordinates;
  heroSteps: number;
  portal?: PortalLink | null;
}
