/**
 * The log's home on disk.
 *
 * IndexedDB rather than localStorage because this is append-only and grows
 * for the life of a campaign — a two-year game is tens of thousands of
 * events, and localStorage's few megabytes plus synchronous writes are the
 * wrong shape for that. The store is keyed by an autoincrementing sequence so
 * insertion order is the read order, which is all a replay needs.
 */

import type { DomainEvent } from "../domain/events.js";

const DB_NAME = "table-companion";
const DB_VERSION = 1;
const STORE = "log";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface Row {
  seq?: number;
  event: DomainEvent;
}

export async function loadLog(): Promise<DomainEvent[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Row[]).map((r) => r.event));
    req.onerror = () => reject(req.error);
  });
}

/** Appends in one transaction so a batch either lands whole or not at all. */
export async function appendEvents(events: readonly DomainEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const event of events) store.add({ event } satisfies Row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Only for starting over — the log is otherwise never rewritten. */
export async function clearLog(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
