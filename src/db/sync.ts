/**
 * Hooks that let a host mirror local data somewhere else (the Claude artifact build
 * syncs to the user's Claude account). The plain web app leaves them unset.
 */
import { useSyncExternalStore } from 'react';

export interface SyncListener {
  /** A session or any of its sets changed (or the session was deleted). */
  session(id: number): void;
  settings(): void;
  /** Everything changed at once (import, erase). */
  all(): void;
}

let listener: SyncListener | null = null;

export function setSyncListener(l: SyncListener | null) {
  listener = l;
}

export const notify: SyncListener = {
  session: (id) => listener?.session(id),
  settings: () => listener?.settings(),
  all: () => listener?.all(),
};

export type SyncState = 'local' | 'synced' | 'saving' | 'error';

export interface StorageInfo {
  state: SyncState;
  /** Where data lives, in the user's words. */
  label: string;
  /** Host-provided file save, for hosts where download links are blocked. */
  saveFile?: (filename: string, text: string) => Promise<void>;
}

let info: StorageInfo = { state: 'local', label: 'Stored only on this device' };
const subs = new Set<() => void>();

export function setStorageInfo(patch: Partial<StorageInfo>) {
  info = { ...info, ...patch };
  subs.forEach((f) => f());
}

export function getStorageInfo(): StorageInfo {
  return info;
}

export function useStorageInfo(): StorageInfo {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => info,
  );
}
