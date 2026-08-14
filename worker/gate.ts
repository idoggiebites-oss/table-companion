/**
 * Keeping the table private.
 *
 * The deployment lives on a workers.dev subdomain, which is Cloudflare's zone
 * rather than ours — so Cloudflare Access, which needs a hostname you own,
 * is not available without moving to a custom domain. This is the same job
 * done in the Worker: one shared passphrase, held as a secret, exchanged once
 * per device for a long-lived cookie.
 *
 * It is a shared secret, not identity. It stops crawlers, strangers and
 * anyone who guesses the address; it does not distinguish one player from
 * another, and it is not what keeps the DM's monsters hidden — that is the
 * disclosure ladder, and it works on the seat rather than on the door.
 *
 * FAILS OPEN when no passphrase is configured. A half-deployed gate that
 * locks the table out of its own campaign mid-session is worse than an open
 * one, and the absence of a secret is unambiguous.
 */

const COOKIE = "tc_pass";
/** Long, because the alternative is a player retyping it at every session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The cookie holds a hash, never the passphrase. Salted with a constant so
 * the value is useless anywhere else, and so changing the salt invalidates
 * every device at once if it ever needs to.
 */
export async function tokenFor(passphrase: string): Promise<string> {
  const bytes = new TextEncoder().encode(`table-companion:v1:${passphrase}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent compare, so the answer leaks nothing by timing. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

const PAGE = (error: boolean) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Table Companion</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
    background:#0e1210; color:#e8ebe9;
    font:16px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif; }
  form { width:min(320px,86vw); display:flex; flex-direction:column; gap:12px; }
  h1 { font-size:1.05rem; font-weight:600; margin:0 0 4px; letter-spacing:.01em; }
  p { margin:0; color:#8b9691; font-size:.85rem; }
  input, button { font:inherit; padding:11px 12px; border:1px solid #2b3330;
    background:#151a18; color:#e8ebe9; border-radius:0; }
  input:focus-visible, button:focus-visible { outline:2px solid #4b6b5c; outline-offset:1px; }
  button { color:#e8ebe9; cursor:pointer; }
  .err { color:#c98b7f; }
</style></head><body>
<form method="POST" action="/unlock">
  <h1>Table Companion</h1>
  <p>${error ? '<span class="err">That is not it.</span>' : "This table is private."}</p>
  <input type="password" name="passphrase" aria-label="Passphrase"
         placeholder="passphrase" autocomplete="current-password" autofocus required>
  <button type="submit">Open</button>
</form>
</body></html>`;

export interface GateResult {
  /** When set, return this instead of handling the request. */
  readonly response?: Response;
}

/**
 * Returns a response when the request should be stopped, and nothing when it
 * should continue.
 */
export async function guard(request: Request, passphrase: string | undefined): Promise<GateResult> {
  if (!passphrase) return {};

  const url = new URL(request.url);
  const expected = await tokenFor(passphrase);

  if (url.pathname === "/unlock" && request.method === "POST") {
    const form = await request.formData();
    const given = String(form.get("passphrase") ?? "");
    if ((await tokenFor(given)) !== expected) {
      return { response: new Response(PAGE(true), { status: 401, headers: html() }) };
    }
    return {
      response: new Response(null, {
        status: 303,
        headers: {
          location: "/",
          "set-cookie":
            `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      }),
    };
  }

  const held = cookieValue(request.headers.get("cookie"), COOKIE);
  if (held && sameToken(held, expected)) return {};

  // An API or socket request with no cookie gets a status, not a login page:
  // a fetch that receives HTML where it expected JSON fails confusingly.
  if (url.pathname.startsWith("/api/")) {
    return { response: new Response("locked", { status: 401 }) };
  }
  return { response: new Response(PAGE(false), { status: 401, headers: html() }) };
}

const html = () => ({
  "content-type": "text/html; charset=utf-8",
  // Never cached: the service worker must not keep a login page as the shell.
  "cache-control": "no-store",
});
