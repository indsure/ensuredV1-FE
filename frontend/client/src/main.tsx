import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { apiFetch } from "@/lib/api";

// #region agent log
try {
  const send = (payload: any) =>
    apiFetch("/api/__agent-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

  send({
    hypothesisId: "A",
    message: "Global error hooks installed",
    data: { href: typeof location !== "undefined" ? location.href : undefined },
  });

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

createRoot(document.getElementById("root")!).render(<App />);
