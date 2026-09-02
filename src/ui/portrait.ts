/**
 * A character's portrait.
 *
 * DEVICE-LOCAL, and deliberately not an event.
 *
 * Everything a table does is an event, the log replays on every device, and
 * every event can be taken back — which is exactly why a picture must not be
 * one. A 200KB image in the log is 200KB on every phone at the table, forever,
 * whether or not that phone ever shows the character; and undo would have to
 * carry it too. This app's own rule already says where it goes: characters,
 * content and seats live on the device, the log lives in the room.
 *
 * The cost is honest and worth saying out loud: a portrait does NOT travel.
 * The player who set it sees it; the DM does not. Making it travel needs
 * somewhere to put bytes that is not the log — see the map question in
 * ROADMAP.md, which is the same question with the same answer missing.
 *
 * Everything here is wrapped: `localStorage` throws in private mode and on
 * quota, and a portrait is not worth failing a sheet over.
 */

const KEY = (id: string) => `portrait:${id}`;

/**
 * 256px square, JPEG.
 *
 * A phone camera hands over three to eight megabytes, and `localStorage` has
 * about five for everything this device owns — so the file is never stored as
 * it arrived. Drawn to a canvas at 256, centre-cropped, which lands at roughly
 * fifteen kilobytes and is four times the pixels the 72px circle can show on a
 * 3x screen.
 */
const SIZE = 256;

export async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("that file is not an image this browser can read"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("this browser will not draw a canvas");
    /* Centre-crop rather than squash: a face stretched to a square is worse
       than a face with its edges trimmed. */
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
      0, 0, SIZE, SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadPortrait(id: string): string | null {
  try {
    return localStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}

/** Returns what went wrong, or null. The caller has somewhere to say it. */
export function savePortrait(id: string, dataUrl: string): string | null {
  try {
    localStorage.setItem(KEY(id), dataUrl);
    return null;
  } catch {
    /* Quota, almost always. Naming the cause beats "could not save". */
    return "there is no room left on this device for another portrait";
  }
}

export function clearPortrait(id: string): void {
  try {
    localStorage.removeItem(KEY(id));
  } catch { /* see loadPortrait */ }
}
