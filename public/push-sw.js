/*
 * The push half of the service worker.
 *
 * Imported into the generated one rather than replacing it: workbox writes
 * the precache and the routing, and this adds the two handlers it has no
 * opinion about. Kept in public/ so it ships as-is — there is nothing here
 * worth a build step.
 *
 * A push MUST show something. Every browser enforces it (userVisibleOnly),
 * and a silent push is how tracking works, so there is no branch here that
 * ends without a notification.
 */

self.addEventListener("push", (event) => {
  let said = { title: "Table Companion", body: "Something wants you." };
  try {
    if (event.data) said = { ...said, ...event.data.json() };
  } catch {
    // A payload we cannot read still has to show something.
  }
  event.waitUntil(
    self.registration.showNotification(said.title, {
      body: said.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // A turn is one thing at a time: a second nudge replaces the first
      // rather than stacking, so an unlocked phone shows what is true now.
      tag: "table-companion-turn",
      renotify: true,
      vibrate: [90, 60, 90],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  /*
   * Focus the tab that is already open before opening another. A table with
   * four Table Companion tabs is a table where three of them are stale.
   */
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
