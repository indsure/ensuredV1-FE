import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";

// #region agent log
try {
  // Keep hooks, but avoid noisy dev-proxy network calls.
  const send = (_payload: any) => {};

  window.addEventListener("error", (e) => {
    send({
      hypothesisId: "A",
      message: "window.error",
      data: {
        message: (e as any)?.message,
        filename: (e as any)?.filename,
        lineno: (e as any)?.lineno,
        colno: (e as any)?.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = (e as any)?.reason;
    send({
      hypothesisId: "B",
      message: "window.unhandledrejection",
      data: {
        reasonName: reason?.name,
        reasonMessage: reason?.message,
      },
    });
  });
} catch {}
// #endregion

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
