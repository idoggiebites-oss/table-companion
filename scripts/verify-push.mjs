/* Notifications, end to end, without a push service.

   Everything but the last hop can be tested here: a subscription whose
   endpoint is a server this script owns, a nudge sent through the room, and
   the body that comes out the other side — decrypted with the same key a
   browser would have used. If the encryption or the VAPID header were wrong
   this would fail; if the room forgot who watches whom, nothing would arrive
   at all.

   What is NOT tested: that Apple and Google deliver it. Nobody can test that
   from here. */
import { createServer } from "node:http";
import { webcrypto as crypto } from "node:crypto";
import { WebSocket } from "ws";

const URL_BASE = process.env.URL ?? "http://127.0.0.1:8787";
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) =>
  Uint8Array.from(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
const concat = (...p) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of p) { out.set(x, at); at += x.length; }
  return out;
};
const buf = (u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
const enc = new TextEncoder();

async function hkdf(salt, ikm, info, n) {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) }, key, n * 8,
  ));
}

// --- a subscriber, as a browser would be --------------------------------
const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const ownPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));

const arrived = [];
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    arrived.push({ headers: req.headers, body: Buffer.concat(chunks) });
    res.writeHead(201).end();
  });
});
await new Promise((r) => server.listen(8799, "127.0.0.1", r));
const endpoint = "http://127.0.0.1:8799/push/one";

// --- a room, and a device that asks to be told --------------------------
const made = await fetch(`${URL_BASE}/api/rooms`, { method: "POST" }).then((r) => r.json());
const code = made.code ?? made.room?.code;
const token = made.token ?? made.room?.token;
ok("a room to test in", typeof code === "string" && code.length > 0, true);

const ws = new WebSocket(
  `${URL_BASE.replace("http", "ws")}/api/rooms/${code}/ws?token=${token}`,
);
await new Promise((r) => ws.once("open", r));
ws.send(JSON.stringify({ t: "sync", since: 0 }));
await new Promise((r) => setTimeout(r, 300));

ws.send(JSON.stringify({
  t: "watch",
  sub: { endpoint, p256dh: b64url(ownPublic), auth: b64url(auth) },
  characters: ["b1"],
}));
await new Promise((r) => setTimeout(r, 300));

// --- and somebody is waited for -----------------------------------------
ws.send(JSON.stringify({
  t: "nudge",
  nudges: [{ to: "b1", title: "Your turn", body: "Kira is up · round 3." }],
}));
await new Promise((r) => setTimeout(r, 1200));

ok("the phone was rung", arrived.length, 1);
const got = arrived[0];
if (got) {
  ok("with a VAPID signature", /^vapid t=/.test(got.headers.authorization ?? ""), true);
  ok("and the encoding the standard names", got.headers["content-encoding"], "aes128gcm");
  ok("and a short life, because a turn is worthless in an hour", got.headers.ttl, "120");

  // Decrypt it the way the service worker's browser would.
  const body = new Uint8Array(got.body);
  const salt = body.slice(0, 16);
  const senderPub = body.slice(21, 21 + body[20]);
  const sealed = body.slice(21 + body[20]);
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: await crypto.subtle.importKey(
        "raw", buf(senderPub), { name: "ECDH", namedCurve: "P-256" }, false, [],
      ),
    },
    pair.privateKey,
    256,
  ));
  const prk = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), ownPublic, senderPub), 32);
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf(nonce) }, key, buf(sealed),
  ));
  const said = JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
  ok("carrying what the phone should show", said, { title: "Your turn", body: "Kira is up · round 3." });
}

// --- and nobody else -----------------------------------------------------
arrived.length = 0;
ws.send(JSON.stringify({
  t: "nudge",
  nudges: [{ to: "somebody-else", title: "Your turn", body: "Not yours." }],
}));
await new Promise((r) => setTimeout(r, 900));
ok("a nudge for another character rings nothing here", arrived.length, 0);

// --- and it can be given up ---------------------------------------------
ws.send(JSON.stringify({ t: "unwatch", endpoint }));
await new Promise((r) => setTimeout(r, 300));
ws.send(JSON.stringify({
  t: "nudge",
  nudges: [{ to: "b1", title: "Your turn", body: "Should not arrive." }],
}));
await new Promise((r) => setTimeout(r, 900));
ok("and once given up, it stays quiet", arrived.length, 0);

ws.close();
server.close();
console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
