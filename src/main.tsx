import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.js";
import { Boundary } from "./ui/Boundary.js";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* The backstop. A crash outside the tabs — the seat bar, the room bar —
        still has to leave something on screen other than black. */}
    <Boundary what="Table Companion">
      <App />
    </Boundary>
  </StrictMode>,
);
