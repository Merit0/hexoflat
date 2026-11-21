import { LEGACY_ATTRIBUTE_LINE_KEYS } from '../attribute-display';
import { TOOL_ACTIONS } from '../token-content-schema';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import type { DescriptionLine } from '../token-schema';
import type { IDescriptionBuilder, TokenSheet } from './token-generation';

export const TOKEN_LINE_KEYS = {
  kind: 'content.tokens.line.kind',
  strike: 'content.tokens.line.strike',
  tier: 'content.tokens.line.tier',
} as const;

export function realmTextKey(realm: ERarityKind): string {
  return `content.tokens.realm.${realm}`;
}

export function toolTextKey(action: (typeof TOOL_ACTIONS)[number]): string {
  return `content.tokens.tool.${action.toLowerCase()}`;
}

export function descriptionLocaleKeys(): string[] {
  return [
    ...Object.values(TOKEN_LINE_KEYS),
    ...Object.values(ERarityKind).map(realmTextKey),
    ...LEGACY_ATTRIBUTE_LINE_KEYS,
    ...TOOL_ACTIONS.map(toolTextKey),
  ];
}

function halfHeartsToHearts(halfHearts: number): number {
  return halfHearts / 2;
}

export class SpecSheetDescriptionBuilder implements IDescriptionBuilder {
  build(sheet: TokenSheet): DescriptionLine[] {
    const { type, realm, mapTier } = sheet;
    const lines: DescriptionLine[] = [
      ...(sheet.descriptionKey ? [{ key: sheet.descriptionKey, params: {} }] : []),
      { key: TOKEN_LINE_KEYS.kind, params: { type: type.nounKey, realm: realmTextKey(realm) } },
      { key: TOKEN_LINE_KEYS.strike, params: { strike: halfHeartsToHearts(type.strike) } },
    ];
    if (type.tool) lines.push({ key: toolTextKey(type.tool.action), params: {} });
    lines.push({ key: TOKEN_LINE_KEYS.tier, params: { tier: mapTier } });
    return lines;
  }
}
