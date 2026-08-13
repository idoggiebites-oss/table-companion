/**
 * The log's home on disk.
 *
 * IndexedDB rather than localStorage because this is append-only and grows for
 * the life of a campaign, and localStorage's few megabytes plus synchronous
 * writes are the wrong shape for that.
 *
 * Rows carry `serverSeq`, which is null until the server has ordered the
 * event. That single field does three jobs: it is the offline queue (null =
 * not yet sent), it is the ordering key (server order wins), and it is the
 * high-water mark for reconnection.
 */

import type { DomainEvent } from "../domain/events.js";
import type { StoredEvent } from "../sync/protocol.js";

const DB_NAME = "table-companion";
const DB_VERSION = 2;
const LOG = "log";
const META = "meta";
const BY_EVENT_ID = "byEventId";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction!;
      const store = db.objectStoreNames.contains(LOG)
        ? tx.objectStore(LOG)
        : db.createObjectStore(LOG, { keyPath: "rowId", autoIncrement: true });
      if (!store.indexNames.contains(BY_EVENT_ID)) {
        store.createIndex(BY_EVENT_ID, "event.id", { unique: true });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface Row {
  rowId?: number;
  event: DomainEvent;
  /** null until the server has given it a place in the order. */
  serverSeq: number | null;
}

export interface LoadedLog {
  /** Server-ordered, ascending by seq. */
  readonly confirmed: StoredEvent[];
  /** Written locally, not yet ordered. Replayed after the confirmed tail. */
  readonly pending: DomainEvent[];
}

export async function loadLog(): Promise<LoadedLog> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(LOG, "readonly").objectStore(LOG).getAll();
    req.onsuccess = () => {
      const rows = req.result as Row[];
      const confirmed = rows
        .filter((r): r is Row & { serverSeq: number } => r.serverSeq !== null)
        .map((r) => ({ seq: r.serverSeq, event: r.event }))
        .sort((a, b) => a.seq - b.seq);
      const pending = rows.filter((r) => r.serverSeq === null).map((r) => r.event);
      resolve({ confirmed, pending });
    };
    req.onerror = () => reject(req.error);
  });
}

/** Records an event written on this device. Unordered until the server says. */
export async function appendLocal(event: DomainEvent): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOG, "readwrite");
    tx.objectStore(LOG).add({ event, serverSeq: null } satisfies Row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Upserts events the server has ordered. Covers both cases in one path: our
 * own event coming back with a sequence number, and somebody else's arriving
 * for the first time.
 */
export async function recordStored(stored: readonly StoredEvent[]): Promise<void> {
  if (stored.length === 0) return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOG, "readwrite");
    const store = tx.objectStore(LOG);
    const index = store.index(BY_EVENT_ID);
    for (const s of stored) {
      const lookup = index.getKey(s.event.id);
      lookup.onsuccess = () => {
        const key = lookup.result;
        if (key === undefined) {
          store.add({ event: s.event, serverSeq: s.seq } satisfies Row);
        } else {
          store.put({ rowId: key as number, event: s.event, serverSeq: s.seq } satisfies Row);
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(META, "readonly").objectStore(META).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Only for starting over — the log is otherwise never rewritten. */
export async function clearLog(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([LOG, META], "readwrite");
    tx.objectStore(LOG).clear();
    tx.objectStore(META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
