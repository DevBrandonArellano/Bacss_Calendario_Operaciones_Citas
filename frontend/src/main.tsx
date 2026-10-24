import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/App";
import "@/index.css";
import { findPublicPage } from "@/seo/pages";

const container = document.getElementById("root") as HTMLElement;

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Las páginas públicas llegan pre-renderizadas (SEO): se hidratan en vez de repintarse.
// El resto de rutas no tiene HTML previo (o el host sirvió otro HTML): se monta desde cero.
if (container.firstElementChild && findPublicPage(window.location.pathname)) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
