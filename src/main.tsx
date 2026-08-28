import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ensureSeeded } from "./storage";
import "./styles.css";

async function bootstrap() {
  await ensureSeeded();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
