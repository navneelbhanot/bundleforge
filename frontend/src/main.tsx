import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@shopify/polaris/build/esm/styles.css";
// Side-effect import: patches window.fetch to attach the App Bridge
// session token to /api/* calls. Must run before App renders.
import "./lib/authFetch";

import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
