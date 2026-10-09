import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { endStaticFirstPaint } from "@/lib/staticFirstPaint";

export function usePageTransition() {
  const [location] = useLocation();
  const firstLocation = useRef(location);

  // The first client-side navigation ends the prerendered first paint, so pages
  // from here on get their entrance animations back. Done during render, not in
  // the effect: App calls this hook before rendering the route, so the next
  // page's components read the flag already switched off when they mount.
  // Idempotent, so a re-render is harmless.
  if (location !== firstLocation.current) endStaticFirstPaint();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location]);

  return location;
}

