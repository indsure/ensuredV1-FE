import { Router } from "wouter";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { enableStaticFirstPaint } from "./lib/staticFirstPaint";

// Build-time render of one public route (see scripts/prerender.mjs).
enableStaticFirstPaint();

export function AppForPath({ path }: { path: string }) {
  return (
    <Router ssrPath={path}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </Router>
  );
}
