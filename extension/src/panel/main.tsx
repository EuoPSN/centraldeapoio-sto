import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cinzel/500.css";
import "@fontsource-variable/montserrat";
import "./estilo.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
