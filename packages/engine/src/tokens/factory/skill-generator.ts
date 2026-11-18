import type { SkillId } from '../../skills/skill-content';
import type { ISkillGenerator } from './token-generation';

export class EmptySkillGenerator implements ISkillGenerator {
  generate(): SkillId[] {
    return [];
  }
}
