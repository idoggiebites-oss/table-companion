/*
 * @vitest-environment happy-dom
 *
 * What a crash looks like. Before this, a throw during render emptied the
 * root and left a black screen with no way back — mid-fight, in front of the
 * table, and with nothing anyone could tell me afterwards.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Boundary } from "../Boundary.js";

function Explodes(): never {
  throw new Error("Cannot read properties of undefined (reading 'trim')");
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // React reports the caught error itself; the test is about the screen.
  vi.spyOn(console, "error").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe("a screen that throws", () => {
  it("leaves something on screen, and says what broke", () => {
    act(() => root.render(<Boundary what="Your spells"><Explodes /></Boundary>));
    expect(host.textContent).toContain("Your spells stopped working");
    expect(host.textContent).toContain("reading 'trim'");
  });

  it("says nothing was lost, because nothing was", () => {
    // The log is the state and it lives on the server; a render throwing
    // cannot touch it. Somebody staring at a broken screen does not know that.
    act(() => root.render(<Boundary what="The fight"><Explodes /></Boundary>));
    expect(host.textContent).toContain("Nothing was lost");
  });

  it("offers a way back rather than a reload nobody thought of", () => {
    act(() => root.render(<Boundary what="The fight"><Explodes /></Boundary>));
    const labels = [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["Try again", "Reload", "Copy details"]);
  });

  it("gets out of the way when nothing is wrong", () => {
    act(() => root.render(<Boundary what="The fight"><p>the goblin</p></Boundary>));
    expect(host.textContent).toBe("the goblin");
  });
});
