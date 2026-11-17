import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const IS_DEMO = import.meta.env.MODE === "demo";

async function boot() {
  let banner: React.ReactNode = null;
  if (IS_DEMO) {
    // Demo web: popula o banco em memória com dados fictícios antes da primeira tela.
    const [{ prepararDemo }, { DemoBanner }] = await Promise.all([
      import("./demo/seed"),
      import("./demo/DemoBanner"),
    ]);
    await prepararDemo();
    banner = <DemoBanner />;
  }

  // Num site estático não há reescrita de rotas, então a demo usa rotas com "#".
  const Router = IS_DEMO ? HashRouter : BrowserRouter;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Router>
        <App />
      </Router>
      {banner}
    </React.StrictMode>,
  );
}

boot();
