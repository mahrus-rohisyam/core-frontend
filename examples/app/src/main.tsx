import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createCoreApp } from "@mahrus-rohisyam/core-shell";
import "@mahrus-rohisyam/core-ui/tokens.css";
import "@mahrus-rohisyam/core-ui/styles.css";
import "@mahrus-rohisyam/core-shell/styles.css";
import "./theme.css";

const { App } = createCoreApp({
  appName: "Notes",
  nav: [{ to: "notes", label: "Notes", permission: "notes.read" }],
  routes: (orgRoute) => [
    createRoute({
      getParentRoute: () => orgRoute,
      path: "notes",
      component: lazyRouteComponent(() => import("./notes.js"), "NotesPage"),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
