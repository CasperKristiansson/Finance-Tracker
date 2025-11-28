import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Store } from "./app/store.ts";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <Provider store={Store}>
    <ThemeProvider>
      <BrowserRouter>
        <Toaster />
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </Provider>,
);
