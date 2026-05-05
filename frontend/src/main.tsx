import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@shopify/polaris/build/esm/styles.css";

import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
