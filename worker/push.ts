/**
 * Web Push, by hand.
 *
 * There is no library here for the same reason there is no framework: the
 * whole of it is three standards and Web Crypto, which the runtime already
 * has, and a dependency that ships its own crypto is a dependency that has to
 * be trusted with the keys.
 *
 *   RFC 8292 (VAPID)  — a signed JWT proving who is asking the push service
 *                       to deliver, so the endpoint is not an open relay.
 *   RFC 8291 (aes128gcm) — the payload is encrypted to a key pair the
 *                       BROWSER generated. The push service carries it and
 *                       cannot read it; nor can this Worker after the fact.
 *   RFC 8188 (content encoding) — the framing those two agree on.
 *
 * The private key lives in a secret. Without it the whole feature is off,
 * which is deliberate: a deployment with no key sends nothing rather than
 * failing at the moment somebody's turn comes round.
 */

export interface PushSubscription {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

const enc = new TextEncoder();

const b64url = (b: ArrayBuffer | Uint8Array): string => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const unb64url = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/*
 * A copy as a plain ArrayBuffer.
 *
 * Uint8Array is generic over its backing buffer now, and Web Crypto's
 * BufferSource wants the plain one — so a view that happens to sit on a
 * SharedArrayBuffer is a type error at every call. One copy, once, rather
 * than a cast at each of them.
 */
const buf = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

/** HKDF, which both halves of this file need and neither owns. */
async function hkdf(
  salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) }, key, length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * The VAPID header: a JWT saying who we are and how long the claim is good
 * for, signed with the key whose public half every subscription was made
 * against.
 */
export async function vapidHeader(
  endpoint: string,
  { publicKey, privateKey, subject }: {
    publicKey: string; privateKey: string; subject: string;
  },
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({
    aud,
    // Twelve hours. The spec's ceiling is 24 and a shorter life is cheaper to
    // be wrong about than a longer one.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })));
  const signing = enc.encode(`${header}.${body}`);

  const jwk = await privateJwk(publicKey, privateKey);
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, buf(signing));
  return `vapid t=${header}.${body}.${b64url(sig)}, k=${publicKey}`;
}

/** The raw keys as a JWK, which is the only shape importKey takes for ECDSA. */
async function privateJwk(publicKey: string, privateKey: string): Promise<JsonWebKey> {
  const pub = unb64url(publicKey);
  // Uncompressed point: 0x04 then x then y.
  return {
    kty: "EC",
    crv: "P-256",
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
}

/**
 * The body: encrypted to the browser's own key, with our ephemeral public key
 * carried in the header so it can do the same maths from the other side.
 */
export async function encrypt(
  sub: PushSubscription, payload: string,
): Promise<Uint8Array> {
  const clientPub = unb64url(sub.p256dh);
  const auth = unb64url(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const local = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  )) as CryptoKeyPair;
  const localPubRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer,
  );
  const theirs = await crypto.subtle.importKey(
    "raw", buf(clientPub), { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const shared = new Uint8Array(
    (await crypto.subtle.deriveBits(
      // Workers' types spell the peer key "$public"; node and the browsers
      // take "public". Both are sent, and the type is asserted rather than
      // named because the two runtimes do not agree on the name of it.
      { name: "ECDH", public: theirs, $public: theirs } as unknown as Parameters<
        typeof crypto.subtle.deriveBits
      >[0],
      local.privateKey,
      256,
    )) as ArrayBuffer,
  );

  // RFC 8291 §3.4: the shared secret is stretched with the subscription's
  // auth secret and BOTH public keys, so a payload cannot be replayed at a
  // different subscriber.
  const prk = await hkdf(
    auth,
    shared,
    concat(enc.encode("WebPush: info\0"), clientPub, localPubRaw),
    32,
  );
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  // The padding delimiter: 0x02 means "last record".
  const body = concat(enc.encode(payload), new Uint8Array([2]));
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: buf(nonce) }, key, buf(body),
  ));

  // RFC 8188 header: salt, record size, key id length, key id.
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw, sealed);
}

export interface PushKeys {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
}

/**
 * Deliver one. Returns whether the subscription is still good — a 404 or 410
 * means the browser threw it away, and so should we.
 */
export async function send(
  sub: PushSubscription, payload: string, keys: PushKeys,
): Promise<{ ok: boolean; gone: boolean }> {
  let res: Response;
  try {
    res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidHeader(sub.endpoint, keys),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        // Four weeks is the spec's maximum; a nudge about a turn is worthless
        // in an hour, let alone four weeks.
        TTL: "120",
        Urgency: "high",
      },
      body: buf(await encrypt(sub, payload)),
    });
  } catch {
    return { ok: false, gone: false };
  }
  return { ok: res.ok, gone: res.status === 404 || res.status === 410 };
}
