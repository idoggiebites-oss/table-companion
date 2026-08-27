/**
 * Getting a phone to buzz.
 *
 * Three moments earn it — see domain/nudge.ts — and this is the plumbing that
 * carries them to a device that is asleep in somebody's pocket.
 *
 * It is off until asked for, and asking is a real prompt from the operating
 * system that cannot be un-asked. So there is one button, it says exactly
 * what will happen, and it is nowhere near anything else a thumb might hit.
 *
 * What it needs, in order: a service worker (the app has one), a VAPID public
 * key from this deployment (absent means the feature is off and the button
 * does not appear), permission, and a subscription. Any of them missing is a
 * reason, not an error — `state()` says which.
 */

import type { PushSub } from "../sync/protocol.js";

export type PushState =
  | "unsupported"
  /** An iPhone that has not installed the app. Apple's rule, not ours. */
  | "needs-install"
  | "unconfigured"
  | "blocked"
  | "off"
  | "on";

const b64url = (b: ArrayBuffer | null): string => {
  if (!b) return "";
  let s = "";
  for (const byte of new Uint8Array(b)) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** The base64url key the Push API wants as bytes. */
const keyBytes = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function supported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Whether this is an Apple device that has not been installed.
 *
 * Apple exposes Web Push only to a web app on the Home Screen: in a Safari
 * tab, `PushManager` and `Notification` do not exist at all. Every check for
 * support therefore fails, the button disappears, and the player is told
 * nothing — which is the state a notification setting must never be in.
 *
 * iPadOS reports itself as a Mac, so a touch count is what separates it from
 * a desktop. Read alongside a failed support check, never on its own: if some
 * future iOS exposes push to tabs, `supported()` becomes true and this stops
 * being consulted, which is the right way round.
 */
function appleUninstalled(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const apple = /iPad|iPhone|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!apple) return false;
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return !installed;
}

let cachedKey: string | null | undefined;

/** The deployment's public key, or null when push is not configured here. */
export async function serverKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const res = await fetch("/api/push/key");
    cachedKey = res.ok ? ((await res.json()) as { key: string }).key : null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

export async function state(): Promise<PushState> {
  /*
   * The key first, so a deployment with push switched off says so rather
   * than telling an iPhone to install an app that would still not buzz.
   */
  if ((await serverKey()) === null) return "unconfigured";
  if (!supported()) return appleUninstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** The current subscription in the shape the room stores. */
export async function current(): Promise<PushSub | null> {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? shape(sub) : null;
}

function shape(sub: PushSubscription): PushSub {
  return {
    endpoint: sub.endpoint,
    p256dh: b64url(sub.getKey("p256dh")),
    auth: b64url(sub.getKey("auth")),
  };
}

/**
 * Ask, and subscribe if allowed.
 *
 * Must be called from a real press: every browser refuses the permission
 * prompt otherwise, and a refused prompt counts as a denial that cannot be
 * asked again.
 */
export async function turnOn(): Promise<PushSub | null> {
  if (!supported()) return null;
  const key = await serverKey();
  if (!key) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return shape(existing);
  const sub = await reg.pushManager.subscribe({
    // Every browser requires this to be true, and says so plainly: a push
    // that shows nothing is a push that can be used to track people.
    userVisibleOnly: true,
    applicationServerKey: keyBytes(key) as BufferSource,
  });
  return shape(sub);
}

/** Give it up on this device. The room forgets it separately. */
export async function turnOff(): Promise<string | null> {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}
