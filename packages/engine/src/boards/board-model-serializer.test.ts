import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOARD_MODELS } from '../content/boards/models';
import { RecipeSchema } from '../content/boards/recipe-schema';
import { boardModelConstName, serializeBoardModel } from './board-model-serializer';

const MODELS_DIR = path.resolve(__dirname, '../content/boards/models');

describe('serializeBoardModel', () => {
  it.each(Object.entries(BOARD_MODELS))(
    'serialize(%s) is byte-identical to its file on disk (round trip)',
    (id, model) => {
      const onDisk = readFileSync(path.join(MODELS_DIR, `${id}.ts`), 'utf8');
      expect(serializeBoardModel(model)).toBe(onDisk);
    },
  );

  it('names the constant after the recipe id', () => {
    expect(boardModelConstName('deep-cave')).toBe('DEEP_CAVE_MODEL');
  });

  it('emits a file that still parses back to the same recipe after an edit', () => {
    const edited = structuredClone(BOARD_MODELS.cave);
    const stage = edited.stages.objects?.[0] as unknown as { rules: { count: unknown }[] };
    stage.rules[0].count = [5, 9];

    const source = serializeBoardModel(edited);

    expect(source).toContain('count: [5, 9]');
    expect(source).toContain('satisfies BoardRecipeInput');
    expect(RecipeSchema.safeParse(edited).success).toBe(true);
  });

  it('breaks long values over several lines and quotes only when needed', () => {
    const source = serializeBoardModel({
      ...BOARD_MODELS.cave,
      background: "it's a path",
      params: { 'odd-key': 1 },
    });

    expect(source).toContain(`background: "it's a path"`);
    expect(source).toContain("'odd-key': 1");
    expect(source).toContain('rules: [\n');
  });
});
