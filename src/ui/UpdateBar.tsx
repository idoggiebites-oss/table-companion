/**
 * The in-app reload control.
 *
 * An installed home-screen app has no address bar and no reload button, so
 * without this there is no way to take an update — or to recover from
 * anything that wants a fresh page. It also lets updates be a PROMPT rather
 * than an automatic reload, which matters because the one moment you must not
 * reload someone's screen is mid-fight.
 *
 * "Ready to work offline" appears once, on first install, because that is the
 * one thing worth telling a player before they carry the app to a basement.
 */

import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdateBar() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="updatebar" role="status">
      <span className="ub-text">
        {needRefresh ? "A new version is ready." : "Ready to work offline."}
      </span>
      <span className="row">
        {needRefresh && (
          <button onClick={() => void updateServiceWorker(true)}>Reload</button>
        )}
        <button
          className="ub-dismiss"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          Dismiss
        </button>
      </span>
    </div>
  );
}
