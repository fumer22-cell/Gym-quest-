/**
 * Claude artifact host: keeps the local Dexie database mirrored to the viewer's private
 * `db` subtree (data/users/<id>/profile, sessions in its `sessions` subcollection).
 * The cloud copy is the source of truth on load; every local change is pushed back.
 */
import { db } from '../db/db';
import { setStorageInfo, setSyncListener } from '../db/sync';
import type { LoggedSet, Session, Settings } from '../types';

/* Minimal shapes of the platform namespaces this file uses (see the runtime contract). */
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): CollRef;
}
interface CollRef { doc(id: string): DocRef; limit(n: number): { get(): Promise<{ docs: DocSnap[] }> } }
interface CloudDb { doc(path: string): DocRef }
interface UserNs { id(): Promise<string | null> }
interface DownloadsNs { save(file: { filename: string; data: string | Blob }): Promise<unknown> }
interface ClaudeHost { use(name: string): Promise<unknown> }

interface SessionDoc {
  session: Session;
  sets: Omit<LoggedSet, 'id'>[];
  updatedAt: number;
}

const CLOUD_LABEL = 'Saved to your Claude account';

function host(): ClaudeHost | undefined {
  return (window as unknown as { claude?: ClaudeHost }).claude;
}

/** Retry once on a transient error, as the store contract recommends. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if ((e as { code?: string })?.code !== 'unavailable') throw e;
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    return fn();
  }
}

export async function setupDownloads() {
  const h = host();
  if (!h) return;
  const downloads = (await h.use('downloads').catch(() => null)) as DownloadsNs | null;
  if (downloads) {
    setStorageInfo({
      saveFile: async (filename, text) => {
        await downloads.save({ filename, data: new Blob([text], { type: 'application/json' }) });
      },
    });
  }
}

/** Resolves once local data reflects the cloud copy (or we know there is no cloud). */
export async function connectCloud(): Promise<void> {
  const h = host();
  if (!h) return;
  const [cloud, user] = (await Promise.all([
    h.use('db').catch(() => null),
    h.use('user').catch(() => null),
  ])) as [CloudDb | null, UserNs | null];
  const uid = user ? await user.id() : null;
  if (!cloud || !uid) {
    setStorageInfo({ state: 'local', label: 'Stored only in this browser. Sign in to Claude to keep it safe.' });
    return;
  }

  const profile = cloud.doc(`data/users/${uid}/profile`);
  const sessions = profile.collection('sessions');

  try {
    const [p, list] = await Promise.all([withRetry(() => profile.get()), withRetry(() => sessions.limit(1000).get())]);
    const docs = list.docs.filter((d) => d.exists).map((d) => d.data() as unknown as SessionDoc);
    if (p.exists || docs.length > 0) {
      await replaceLocal((p.data()?.settings as Settings | undefined) ?? null, docs);
    } else {
      // First run in the cloud: upload whatever this browser already has.
      await pushSettings();
      for (const s of await db.sessions.toArray()) await pushSession(s.id!);
    }
  } catch {
    setStorageInfo({ state: 'error', label: 'Could not reach your Claude account. Changes stay in this browser for now.' });
    return;
  }

  setStorageInfo({ state: 'synced', label: CLOUD_LABEL });

  // One write at a time per document, coalescing bursts of changes.
  const pending = new Map<string, () => Promise<void>>();
  const running = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function schedule(key: string, job: () => Promise<void>) {
    pending.set(key, job);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => run(key), 400));
    setStorageInfo({ state: 'saving', label: 'Saving…' });
  }

  async function run(key: string) {
    if (running.has(key)) return; // finishes, then picks up the newest job
    const job = pending.get(key);
    if (!job) return;
    pending.delete(key);
    running.add(key);
    try {
      await withRetry(job);
      if (pending.size === 0 && running.size === 1) setStorageInfo({ state: 'synced', label: CLOUD_LABEL });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setStorageInfo({
        state: 'error',
        label:
          code === 'quota_exceeded'
            ? 'Your Claude storage is full. Export a backup, then delete old workouts.'
            : 'Not saved to your Claude account yet. It retries on your next change.',
      });
    } finally {
      running.delete(key);
      if (pending.has(key)) run(key);
    }
  }

  async function pushSession(id: number) {
    const ref = sessions.doc(String(id));
    const s = await db.sessions.get(id);
    if (!s) return ref.delete();
    const sets = (await db.sets.where('sessionId').equals(id).sortBy('loggedAt')).map(({ id: _id, ...rest }) => rest);
    const doc: SessionDoc = { session: s, sets, updatedAt: Date.now() };
    await ref.set(JSON.parse(JSON.stringify(doc)));
  }

  async function pushSettings() {
    const settings = await db.settings.get('main');
    await profile.set({ settings: settings ? JSON.parse(JSON.stringify(settings)) : null, updatedAt: Date.now() });
  }

  async function pushAll() {
    await pushSettings();
    const local = new Set((await db.sessions.toArray()).map((s) => String(s.id)));
    const remote = await sessions.limit(1000).get();
    for (const d of remote.docs) if (!local.has(d.id)) await sessions.doc(d.id).delete();
    for (const id of local) await pushSession(Number(id));
  }

  setSyncListener({
    session: (id) => schedule(`s:${id}`, () => pushSession(id)),
    settings: () => schedule('settings', pushSettings),
    all: () => schedule('all', pushAll),
  });
}

async function replaceLocal(settings: Settings | null, docs: SessionDoc[]) {
  await db.transaction('rw', db.sessions, db.sets, db.settings, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.settings.clear()]);
    if (settings) await db.settings.put({ ...settings, key: 'main' });
    for (const d of docs) {
      if (!d?.session?.id) continue;
      await db.sessions.put(d.session);
      if (d.sets?.length) await db.sets.bulkAdd(d.sets.map((s) => ({ ...s, sessionId: d.session.id! })));
    }
  });
}
