import Dexie, { type EntityTable } from 'dexie';
import type { LoggedSet, Session, Settings } from '../types';

export class GymQuestDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<LoggedSet, 'id'>;
  settings!: EntityTable<Settings, 'key'>;

  constructor(name = 'gym-quest') {
    super(name);
    this.version(1).stores({
      sessions: '++id, startedAt, endedAt',
      sets: '++id, sessionId, exerciseId, loggedAt, [exerciseId+loggedAt]',
      settings: 'key',
    });
  }
}

export let db = new GymQuestDB();

/** Tests swap in a fresh database. */
export function setDatabase(next: GymQuestDB) {
  db = next;
}
