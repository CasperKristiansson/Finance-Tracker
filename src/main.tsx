import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import { Provider } from "react-redux";
import { Store } from "./app/store.ts";

createRoot(document.getElementById("root")!).render(
  <Provider store={Store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>,
);
