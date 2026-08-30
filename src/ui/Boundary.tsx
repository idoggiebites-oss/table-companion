/**
 * What the app does when it breaks.
 *
 * Until now: nothing. React unmounts the whole tree on a render error, which
 * leaves an empty root over a dark page — a black screen, mid-fight, with no
 * way back except knowing to reload. At a table that is the worst possible
 * failure: it happens in front of five people, it destroys the turn, and it
 * tells whoever hit it nothing they could repeat to me.
 *
 * So a crash is caught, named, and contained to the tab it happened on. The
 * seat bar and the other tabs keep working — a broken Spells tab should not
 * cost you the fight you are in the middle of — and the message is on screen
 * with a button that copies it, because "it went black" is not a bug report
 * and the person holding the phone should not have to be the one to know that.
 *
 * Nothing is lost either way: the log is the state, it lives on the server and
 * in this device's storage, and neither is touched by a render throwing.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  /** Names the part that broke, for the message and the report. */
  readonly what: string;
}

interface State {
  readonly error: Error | null;
  readonly stack: string;
  readonly copied: boolean;
}

export class Boundary extends Component<Props, State> {
  override state: State = { error: null, stack: "", copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The component stack says WHERE far better than the message does.
    this.setState({ stack: info.componentStack ?? "" });
    console.error(`[${this.props.what}]`, error, info.componentStack);
  }

  private report(): string {
    const { error, stack } = this.state;
    return [
      `Table Companion — ${this.props.what} crashed`,
      `${error?.name ?? "Error"}: ${error?.message ?? "unknown"}`,
      error?.stack ?? "",
      stack,
      navigator.userAgent,
    ].join("\n");
  }

  override render(): ReactNode {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="card crash">
        <div className="card-hd">
          <span className="label">{this.props.what} stopped working</span>
        </div>
        <div className="card-body">
          <p className="crash-say">
            Nothing was lost — everything that happened is in the log, on the
            server. The other tabs still work.
          </p>
          <p className="crash-msg">{error.message || String(error)}</p>
          <div className="row">
            <button onClick={() => this.setState({ error: null, stack: "", copied: false })}>
              Try again
            </button>
            <button onClick={() => window.location.reload()}>Reload</button>
            <button
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(this.report())
                  .then(() => this.setState({ copied: true }), () => {});
              }}
            >
              {copied ? "Copied" : "Copy details"}
            </button>
          </div>
          <p className="faint note">
            Copying the details and sending them on is what makes this fixable.
          </p>
        </div>
      </section>
    );
  }
}
