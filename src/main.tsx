import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router";
import { Store } from "./app/store.ts";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <Provider store={Store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>,
);
