import { useEffect } from "react";
import { useLocation } from "wouter";

export function usePageTransition() {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location]);

  return location;
}

