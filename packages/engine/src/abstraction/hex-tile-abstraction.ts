import type { TokenOrigin } from '../tokens/token-origin';
import { EHexActionType } from '../enums/hex-action-type';
import { THexobjectKey } from '../registry/hexobjects-registry';

export interface IPendingTileAction {
  type: EHexActionType;
  startedAt: number;
  endsAt: number;
  hexobjectKey: THexobjectKey;

  cancelled?: boolean;
  harvestBonus?: number;
  tokenOrigin?: TokenOrigin;
  cancelReason?: 'ESC' | 'HIDE' | 'MOVE';

  meta?: Record<string, any>;
}
