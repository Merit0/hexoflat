import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { CONTENT } from './content-map';

export function isSquadKey(key: string): key is THexobjectKey {
  const content = CONTENT[key as THexobjectKey];
  return content?.groupType === EHexobjectGroup.CREATURE && !!content.creature.squad;
}

export function walledForBoardWalk(key: string): boolean {
  return CONTENT[key as THexobjectKey]?.collision === EHexCollision.SOLID && !isSquadKey(key);
}
