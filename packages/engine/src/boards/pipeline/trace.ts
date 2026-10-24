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
}

export interface RuleOutcome {
  ruleId: string;
  outcome: 'placed' | 'skipped' | 'short';
  note: string;
}

export class BoardTrace {
  private readonly byCell = new Map<string, TraceEntry[]>();
  readonly shortfalls: RuleShortfall[] = [];
  readonly ruleOutcomes: RuleOutcome[] = [];

  record(coord: IHexCoordinates, entry: TraceEntry): void {
    const key = coordinateKey(coord);
    const entries = this.byCell.get(key);
    if (entries) entries.push(entry);
    else this.byCell.set(key, [entry]);
  }

  recordShortfall(shortfall: RuleShortfall): void {
    this.shortfalls.push(shortfall);
  }

  recordRule(outcome: RuleOutcome): void {
    this.ruleOutcomes.push(outcome);
  }

  entriesAt(coord: IHexCoordinates): readonly TraceEntry[] {
    return this.byCell.get(coordinateKey(coord)) ?? [];
  }

  get cellCount(): number {
    return this.byCell.size;
  }
}
