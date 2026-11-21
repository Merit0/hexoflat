import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import type { EquipmentAttributeDefinition } from './equipment/equipment-attribute-schema';
import { ATTRIBUTE_FORMATS, type TAttributeFormat } from './equipment/equipment-keys';
import { WORD_KEY_ROOT } from './token-keys';
import type { ItemToken } from './token-schema';

export const LEGACY_ATTRIBUTE_LINE_KEYS = [
  'heart',
  'shield',
  'force',
  'mass',
  'will',
  'fog',
  'bag',
].map((key) => `${WORD_KEY_ROOT}.attr.${key}`);

const HALF_HEARTS_PER_HEART = 2;

export function attributeFormatKey(format: TAttributeFormat): string {
  return `${WORD_KEY_ROOT}.attrFormat.${format}`;
}

export function attributeFormatKeys(): string[] {
  return ATTRIBUTE_FORMATS.map(attributeFormatKey);
}

export function hasBakedAttributeLines(token: Pick<ItemToken, 'description'>): boolean {
  return token.description.some((line) => LEGACY_ATTRIBUTE_LINE_KEYS.includes(line.key));
}

export interface AttributeRowData {
  key: string;
  labelKey: string;
  icon: string;
  formatKey: string;
  value: number;
}

function displayValue(format: TAttributeFormat, value: number): number {
  return format === 'hearts' ? value / HALF_HEARTS_PER_HEART : value;
}

export function attributeRowsOf(
  token: Pick<ItemToken, 'attributes' | 'description'>,
  attributes: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES,
): AttributeRowData[] {
  if (hasBakedAttributeLines(token)) return [];
  return token.attributes.flatMap((attribute) => {
    const definition = attributes.find((candidate) => candidate.key === attribute.key);
    if (!definition) return [];
    const { labelKey, icon, format } = definition.display;
    return [
      {
        key: attribute.key,
        labelKey,
        icon,
        formatKey: attributeFormatKey(format),
        value: displayValue(format, attribute.value),
      },
    ];
  });
}
