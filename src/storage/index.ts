import { SqliteStorage } from './sqlite-storage.js';
import type { StorageBackend } from './interface.js';
import type { StorageConfig } from '../types/index.js';

export { SqliteStorage } from './sqlite-storage.js';
export type { StorageBackend, ProposalFilter, StorageStats } from './interface.js';

export function createStorage(config: StorageConfig): StorageBackend {
  if (config.backend === 'sqlite') {
    const storage = new SqliteStorage(config.stateFile);
    storage.initialize();
    return storage;
  }
  throw new Error(`Unsupported storage backend: ${config.backend}`);
}
