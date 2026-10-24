import { coordinateKey } from '../../utils/hex-utils';
import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { StageName } from '../../content/boards/recipe-schema';

export interface TraceEntry {
  stage: StageName;
  pieceId: string;
  ruleId?: string;
  note?: string;
}

export interface RuleShortfall {
  ruleId: string;
  wanted: number;
  placed: number;
  reason: string;
  required?: boolean;
}

export interface RuleOutcome {
  ruleId: string;
  outcome: 'placed' | 'skipped' | 'short';
  note: string;
}

export class BoardTrace {
  private readonly byCell = new Map<string, TraceEntry[]>();
  private readonly cellsByRule = new Map<string, string[]>();
  readonly shortfalls: RuleShortfall[] = [];
  readonly ruleOutcomes: RuleOutcome[] = [];

  record(coord: IHexCoordinates, entry: TraceEntry): void {
    const key = coordinateKey(coord);
    const entries = this.byCell.get(key);
    if (entries) entries.push(entry);
    else this.byCell.set(key, [entry]);

    if (entry.ruleId) {
      const ruleCells = this.cellsByRule.get(entry.ruleId);
      if (ruleCells) ruleCells.push(key);
      else this.cellsByRule.set(entry.ruleId, [key]);
    }
  }

  recordShortfall(shortfall: RuleShortfall): void {
    this.shortfalls.push(shortfall);
  }

  recordRule(outcome: RuleOutcome): void {
    this.ruleOutcomes.push(outcome);
  }

  ruleCellKeys(ruleId: string): readonly string[] {
    return this.cellsByRule.get(ruleId) ?? [];
  }

  entriesAt(coord: IHexCoordinates): readonly TraceEntry[] {
    return this.byCell.get(coordinateKey(coord)) ?? [];
  }

  get cellCount(): number {
    return this.byCell.size;
  }
}

export interface RuleSummary {
  ruleId: string;
  outcome: RuleOutcome['outcome'];
  wanted: number;
  placed: number;
  note: string;
}

export function summarizeRules(trace: BoardTrace): RuleSummary[] {
  return trace.ruleOutcomes.map((outcome) => {
    const placed = trace.ruleCellKeys(outcome.ruleId).length;
    const shortfall = trace.shortfalls.find((item) => item.ruleId === outcome.ruleId);
    return {
      ruleId: outcome.ruleId,
      outcome: outcome.outcome,
      wanted: shortfall?.wanted ?? placed,
      placed,
      note: outcome.note,
    };
  });
}
