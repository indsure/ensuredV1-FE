import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, PlayCircle, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { exitPlayground, isPlaygroundMode } from "@/lib/playground/mode";
import { uiLabelVars } from "@/lib/advisorGuide";
import { TOUR_STEPS, endTour, getTourState, onTourChange, setTourState, type TourState } from "@/lib/playground/tour";

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Find the sidebar link for a step and return where it sits on screen. Scoped to
 * the sidebar's <nav> first: the logo also links to /agent/dashboard, and the
 * "Check a Policy" button is the only uploads link and sits outside <nav>.
 * Returns null when the link is not visible (phone drawer closed, rail collapsed
 * with the group shut), and the card then simply shows without a ring.
 */
function findNavRect(href: string): Rect | null {
  const el =
    document.querySelector<HTMLElement>(`aside nav a[href="${href}"]`) ??
    document.querySelector<HTMLElement>(`aside a[href="${href}"]:not([href="/agent/dashboard"])`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const offScreen = r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight;
  if (r.width === 0 || r.height === 0 || offScreen) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * The playground's guided tour. Mounted by AgentLayout on every screen; renders
 * nothing outside playground mode or when no tour is running.
 */
export default function PlaygroundTour({ hidden = false }: { hidden?: boolean }) {
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [state, setState] = useState<TourState>(() => (isPlaygroundMode() ? getTourState() : null));
  const [ring, setRing] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);

  // Any change to the tour, from this card or from a "Take the tour" button
  // elsewhere, moves the visitor to the step's screen. A remount does not:
  // someone who wandered off mid-tour keeps their place and gets a link back.
  useEffect(
    () =>
      onTourChange(() => {
        const next = getTourState();
        const prev = stateRef.current;
        stateRef.current = next;
        setState(next);
        if (typeof next === "number" && next !== prev) {
          const route = TOUR_STEPS[next].route;
          if (window.location.pathname !== route) setLocation(route);
        }
      }),
    [setLocation]
  );

  const step = typeof state === "number" ? TOUR_STEPS[state] : null;

  // Ring the sidebar link. Re-measured on a timer as well as on resize because
  // the rail animates open and the page above it can shift as data loads.
  useEffect(() => {
    if (!step?.navHref) { setRing(null); return; }
    const measure = () => setRing(findNavRect(step.navHref!));
    measure();
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(id); window.removeEventListener("resize", measure); };
  }, [step?.navHref, location]);

  // Move focus to the card when a step appears, so keyboard and screen-reader
  // users land on it rather than somewhere behind it.
  useEffect(() => {
    if (state !== null) cardRef.current?.focus();
  }, [state]);

  // Hidden, not unmounted, while the phone menu is open: the drawer is the
  // thing they are looking at, and the card would sit on top of it.
  if (!isPlaygroundMode() || state === null || hidden) return null;

  const total = TOUR_STEPS.length;

  function signUp() {
    // Sign-up must reach the real backend, so leave demo mode first. A plain
    // navigation would carry the mock client into the signup form.
    endTour();
    exitPlayground();
    window.location.href = "/agent/signup/step1";
  }

  // Above the Sach chat bubble (z-50, bottom-right). On desktop the card sits
  // clear of it so both stay usable; on a phone there is no room for both, and
  // the card wins until the tour is closed. Below the drawer only because the
  // card is hidden while the drawer is open.
  const card = "fixed z-[55] left-3 right-3 bottom-[76px] md:bottom-24 md:left-auto md:right-6 md:w-[400px] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-4 sm:p-5 outline-none";

  if (state === "welcome") {
    return (
      <div ref={cardRef} tabIndex={-1} role="dialog" aria-labelledby="tour-welcome-h" className={card}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0F766E]">
            <PlayCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={endTour}
            aria-label={t("tour.close")}
            className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 id="tour-welcome-h" className="mt-3 text-xl font-bold text-slate-900">{t("tour.welcome_t")}</h2>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t("tour.welcome_d")}</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setTourState(0)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 text-base font-semibold text-white hover:bg-[#0F766E]"
          >
            {t("tour.start")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={endTour}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("tour.explore")}
          </button>
        </div>
      </div>
    );
  }

  const i = state;
  const s = TOUR_STEPS[i];
  const last = i === total - 1;
  const offRoute = location !== s.route;

  return (
    <>
      {ring && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] rounded-xl ring-4 ring-[#5eead4] animate-pulse"
          style={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
        />
      )}
      <div ref={cardRef} tabIndex={-1} role="dialog" aria-labelledby="tour-step-h" className={card}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#0F766E]">
            {t("tour.step_of", { n: i + 1, total })}
          </span>
          <button
            type="button"
            onClick={endTour}
            aria-label={t("tour.close")}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-1.5 rounded-full bg-[#0D9488] transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
        <h2 id="tour-step-h" className="mt-4 text-xl font-bold text-slate-900">{t(`tour.${s.id}_t`)}</h2>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t(`tour.${s.id}_d`, uiLabelVars(t))}</p>

        {offRoute && !last && (
          <button
            type="button"
            onClick={() => setLocation(s.route)}
            className="mt-3 inline-flex min-h-11 items-center text-base font-semibold text-[#0F766E] underline underline-offset-4"
          >
            {t("tour.take_me_there")}
          </button>
        )}

        {last ? (
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={signUp}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 text-base font-semibold text-white hover:bg-[#0F766E]"
            >
              {t("tour.sign_up")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={endTour}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("tour.keep_exploring")}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setTourState(i - 1)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("tour.back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setTourState(i + 1)}
              className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#0D9488] px-5 text-base font-semibold text-white hover:bg-[#0F766E]"
            >
              {t("tour.next")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
