import type { AttributeRegistry } from '../registries';
import { TOOL_ACTIONS } from '../token-content-schema';
import type { AttributeKey, TBaseRealm } from '../token-keys';
import { BASE_REALMS } from '../token-keys';
import type { DescriptionLine, TokenAttribute } from '../token-schema';
import type { BaseTokenSheet, IDescriptionBuilder } from './token-generation';

export const TOKEN_LINE_KEYS = {
  kind: 'content.tokens.line.kind',
  strike: 'content.tokens.line.strike',
  tier: 'content.tokens.line.tier',
} as const;

export function realmTextKey(realm: TBaseRealm): string {
  return `content.tokens.realm.${realm}`;
}

export function attributeTextKey(key: AttributeKey): string {
  return `content.tokens.attr.${key}`;
}

export function toolTextKey(action: (typeof TOOL_ACTIONS)[number]): string {
  return `content.tokens.tool.${action.toLowerCase()}`;
}

export function descriptionLocaleKeys(attributeKeys: readonly AttributeKey[]): string[] {
  return [
    ...Object.values(TOKEN_LINE_KEYS),
    ...BASE_REALMS.map(realmTextKey),
    ...attributeKeys.map(attributeTextKey),
    ...TOOL_ACTIONS.map(toolTextKey),
  ];
}

function halfHeartsToHearts(halfHearts: number): number {
  return halfHearts / 2;
}

export class SpecSheetDescriptionBuilder implements IDescriptionBuilder {
  constructor(private readonly attributes: AttributeRegistry) {}

  build(sheet: BaseTokenSheet): DescriptionLine[] {
    const { type, realm, mapTier } = sheet;
    const lines: DescriptionLine[] = [
      { key: TOKEN_LINE_KEYS.kind, params: { type: type.nounKey, realm: realmTextKey(realm) } },
      { key: TOKEN_LINE_KEYS.strike, params: { strike: halfHeartsToHearts(type.strike) } },
      ...sheet.attributes.map((attribute) => this.attributeLine(attribute)),
    ];
    if (type.tool) lines.push({ key: toolTextKey(type.tool.action), params: {} });
    lines.push({ key: TOKEN_LINE_KEYS.tier, params: { tier: mapTier } });
    return lines;
  }

  private attributeLine(attribute: TokenAttribute): DescriptionLine {
    const unit = this.attributes.get(attribute.key).unit;
    const value = unit === 'half-heart' ? halfHeartsToHearts(attribute.value) : attribute.value;
    return { key: attributeTextKey(attribute.key), params: { value } };
  }
}
