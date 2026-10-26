import type { SkillBranch, SkillId } from '@hexoflat/engine/skills/skill-content';
import type { TIconName } from '@/components/gui/icons/item-icons';

export const SKILL_ICON: Record<SkillId, TIconName> = {
  b_crest: 'human',
  b_strike: 'sword',
  b_guard: 'shield',
  b_heavy: 'anvil',
  b_endure: 'heart',
  b_dash: 'bolt',
  b_aim: 'bow',
  b_cap: 'star',
  d_crest: 'horns',
  d_curse: 'spiral',
  d_blood: 'drop',
  d_fear: 'skull',
  d_shadow: 'moon',
  d_devour: 'flame',
  d_sight: 'eye',
  d_cap: 'horns',
  a_crest: 'wings',
  a_teleport: 'portal',
  a_heal: 'cross',
  a_gate2: 'gate2',
  a_ward: 'ward',
  a_wings: 'feather',
  a_light: 'sun',
  a_cap: 'wings',
};

export const BRANCH_COLOR: Record<SkillBranch, string> = {
  demonic: '#d0588c',
  bionic: '#e2a24f',
  angelic: '#8dcdef',
};
