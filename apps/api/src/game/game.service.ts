import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CreateSaveDto } from './game.dto';

export interface SaveRecord {
  id: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class GameService {
  private readonly saves: SaveRecord[] = [];

  list(): SaveRecord[] {
    return this.saves;
  }

  create(dto: CreateSaveDto): SaveRecord {
    const record: SaveRecord = {
      id: randomUUID(),
      name: dto.name,
      createdAt: new Date().toISOString(),
    };
    this.saves.push(record);
    return record;
  }
}
