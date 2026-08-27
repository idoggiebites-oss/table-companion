/*
 * The encryption, checked from the other side.
 *
 * There is no library here to trust, so the test does what the browser does:
 * generates a subscription key pair, takes the body this file produces, and
 * decrypts it. If the derivation is wrong at either end the plaintext does
 * not come back.
 */
import { describe, expect, it } from "vitest";
import { encrypt, vapidHeader, type PushSubscription } from "../push.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (b: Uint8Array): string =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A subscription, as a browser would hand one over. */
async function subscriber(): Promise<{
  sub: PushSubscription; privateKey: CryptoKey; auth: Uint8Array;
}> {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    sub: {
      endpoint: "https://push.example/abc",
      p256dh: b64url(raw),
      auth: b64url(auth),
    },
    privateKey: pair.privateKey,
    auth,
  };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) }, key, n * 8),
  );
}

const buf = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

const concat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of p) { out.set(x, at); at += x.length; }
  return out;
};

/** What a browser does with the body it is handed. */
async function receive(
  body: Uint8Array, privateKey: CryptoKey, auth: Uint8Array, ownPublic: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16);
  const idLen = body[20]!;
  const senderPub = body.slice(21, 21 + idLen);
  const sealed = body.slice(21 + idLen);

  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: await crypto.subtle.importKey(
        "raw", buf(senderPub), { name: "ECDH", namedCurve: "P-256" }, false, [],
      ),
    },
    privateKey,
    256,
  ));
  const prk = await hkdf(
    auth, shared, concat(enc.encode("WebPush: info\0"), ownPublic, senderPub), 32,
  );
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, sealed),
  );
  // The last byte is the padding delimiter, not content.
  return dec.decode(plain.slice(0, -1));
}

describe("a push body", () => {
  it("comes back out the other side", async () => {
    const { sub, privateKey, auth } = await subscriber();
    const own = Uint8Array.from(
      Buffer.from(sub.p256dh.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
    );
    const said = JSON.stringify({ title: "Your turn", body: "Kira is up · round 3." });
    const out = await receive(await encrypt(sub, said), privateKey, auth, own);
    expect(out).toBe(said);
  });

  it("is framed the way RFC 8188 says", async () => {
    const { sub } = await subscriber();
    const body = await encrypt(sub, "hello");
    // salt(16) | record size(4) | key id length(1) | key id(65) | ciphertext
    expect(body.length).toBeGreaterThan(86);
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    // Uncompressed point, which is what a P-256 public key is on the wire.
    expect(body[21]).toBe(0x04);
    // "hello" plus the delimiter byte, plus the AES-GCM tag.
    expect(body.length - 86).toBe(5 + 1 + 16);
  });

  it("never repeats itself, because the salt and the key are per message", async () => {
    const { sub } = await subscriber();
    const a = await encrypt(sub, "same");
    const b = await encrypt(sub, "same");
    expect(b64url(a)).not.toBe(b64url(b));
  });
});

describe("the VAPID header", () => {
  /*
   * Generated here rather than pasted in: an invented base64 string is not a
   * point on the curve, and the first version of this test proved only that
   * importKey rejects nonsense.
   */
  const made = (async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"],
    )) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    return {
      publicKey: b64url(raw),
      privateKey: jwk.d!,
      subject: "mailto:dm@example.com",
    };
  })();

  it("names the endpoint's origin and nothing more of it", async () => {
    const h = await vapidHeader("https://fcm.googleapis.com/fcm/send/abc123", await made);
    const claim = JSON.parse(
      Buffer.from(h.split(" ")[1]!.replace("t=", "").split(".")[1]!, "base64url").toString(),
    );
    expect(claim.aud).toBe("https://fcm.googleapis.com");
    expect(claim.sub).toBe("mailto:dm@example.com");
  });

  it("expires, and within the day the spec allows", async () => {
    const h = await vapidHeader("https://push.example/x", await made);
    const claim = JSON.parse(
      Buffer.from(h.split(" ")[1]!.replace("t=", "").split(".")[1]!, "base64url").toString(),
    );
    const hours = (claim.exp - Math.floor(Date.now() / 1000)) / 3600;
    expect(hours).toBeGreaterThan(1);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it("carries the public key the subscription was made against", async () => {
    const keys = await made;
    const h = await vapidHeader("https://push.example/x", keys);
    expect(h.endsWith(`k=${keys.publicKey}`)).toBe(true);
  });

  it("and the signature verifies against it", async () => {
    /* The whole point of the header: a push service can check that whoever
       asked for delivery holds the key the subscription was made against. */
    const keys = await made;
    const h = await vapidHeader("https://push.example/x", keys);
    const [token, sig] = [
      h.slice(h.indexOf("t=") + 2, h.indexOf(",")),
      "",
    ];
    const [head, body, signature] = token.split(".");
    const raw = Uint8Array.from(
      Buffer.from(keys.publicKey.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
    );
    const pub = await crypto.subtle.importKey(
      "raw", buf(raw), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      buf(Uint8Array.from(Buffer.from(signature!, "base64url"))),
      buf(new TextEncoder().encode(`${head}.${body}`)),
    );
    expect(sig).toBe("");
    expect(ok).toBe(true);
  });
});
