import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * True below the `md` breakpoint.
 *
 * Reads the media query itself rather than `window.innerWidth`: innerWidth
 * counts the scrollbar, so at the boundary it can disagree with CSS by ~15px
 * and leave the JS-chosen view and the CSS-driven one contradicting each other.
 *
 * Listens to `resize` alongside the media query's `change`. `change` alone is
 * correct in principle but does not fire in every embedded/automated browser
 * context, which strands the layout in whichever mode it first rendered.
 */
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  )

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const sync = () => setIsMobile(mql.matches)

    sync()
    mql.addEventListener("change", sync)
    window.addEventListener("resize", sync)
    window.addEventListener("orientationchange", sync)

    return () => {
      mql.removeEventListener("change", sync)
      window.removeEventListener("resize", sync)
      window.removeEventListener("orientationchange", sync)
    }
  }, [query])

  return isMobile
}
