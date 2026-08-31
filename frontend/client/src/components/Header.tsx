import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, ChevronDown, Building2, ScanSearch, Calculator,
  Scale, Hospital, ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "motion/react";

/* ============================================================
   SITE HEADER

   The nav used to be absolutely centred on the container while the
   right-hand cluster was 290px wide, which left a 309px void after
   the logo and only 71px before "For advisors". It measured as
   perfectly centred and read as shoved to the right.

   It is now anchored to the logo and left to flow, so the two
   groups balance against the edges of the page instead of against
   an invisible midpoint.
   ============================================================ */

const navLinks = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Why IndSure", href: "/why-indsure" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

/* Each tool carries its own colour and a line saying what it does.
   The audit's note that two of these labels were vague was really a
   symptom of a menu of four bare nouns. */
const toolsItems = [
  {
    label: "Policy check",
    href: "/policychecker",
    desc: "What your policy actually covers",
    icon: ScanSearch,
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
  },
  {
    label: "Cover Calculator",
    href: "/calculator",
    desc: "How much cover your family needs",
    icon: Calculator,
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
  },
  {
    label: "Compare plans",
    href: "/compare",
    desc: "Two wordings, side by side",
    icon: Scale,
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
  },
  {
    label: "Find a network hospital",
    href: "/find-provider",
    desc: "Which insurers cover your hospital",
    icon: Hospital,
    accent: "var(--lob-travel)",
    wash: "var(--lob-travel-wash)",
  },
];

export function Header() {
  const [location, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hooks MUST come before any conditional return
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  /* An open menu that scrolls the page behind it loses the visitor's
     place the moment they close it. */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  // Agent / Admin pages manage their own nav — render nothing here
  if (location.startsWith("/agent") || location.startsWith("/admin")) {
    return null;
  }

  // /start is the reel campaign landing page. Site nav on it is five ways for
  // a cold visitor to not sign up, so it carries its own logo and one CTA.
  if (location === "/start") {
    return null;
  }

  const toolsActive = toolsItems.some((t) => location === t.href);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-[padding,background-color,border-color,box-shadow] duration-300 ${
        isScrolled
          ? "py-2.5 border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--color-cream-main)_88%,transparent)] backdrop-blur-md shadow-[0_1px_20px_-8px_rgba(15,23,42,0.18)]"
          : "py-4 border-transparent bg-[var(--color-cream-main)]"
      }`}
    >
      <div className="container-editorial flex items-center justify-between gap-6">

        {/* ─── LEFT: Logo + Nav ─── */}
        <div className="flex items-center gap-8 xl:gap-11 min-w-0">
          <Link href="/" aria-label="IndSure home" className="shrink-0">
            <img
              src="/logo.png"
              alt="IndSure"
              className={`w-auto transition-[height,transform] duration-300 hover:scale-[1.04] ${isScrolled ? "h-9" : "h-11"}`}
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {navLinks.slice(0, 2).map((item) => (
              <NavLink key={item.href} {...item} active={location === item.href} />
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`group relative flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium outline-none transition-colors ${
                    toolsActive
                      ? "text-[var(--color-teal-600)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]"
                  }`}
                >
                  Tools
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  {toolsActive ? <ActiveRule /> : null}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                sideOffset={14}
                className="w-[340px] rounded-2xl border border-[var(--color-border-light)] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.28)]"
              >
                {toolsItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild className="p-0 focus:bg-transparent">
                    <Link
                      href={item.href}
                      className="group flex w-full cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--color-cream-main)]"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: item.wash, color: item.accent }}
                      >
                        <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-[var(--color-navy-900)]">
                          {item.label}
                        </span>
                        <span className="block text-sm leading-snug text-[var(--color-text-secondary)]">
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.slice(2).map((item) => (
              <NavLink key={item.href} {...item} active={location === item.href} />
            ))}
          </nav>
        </div>

        {/* ─── RIGHT: advisor path, then the consumer CTAs ─── */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {/* Advisors are a different audience, not a fifth nav item. The
              divider is what says so. */}
          <button
            onClick={() => setLocation("/agent")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[15px] font-medium text-[var(--color-text-secondary)] outline-none transition-colors hover:text-[var(--color-teal-600)]"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            For advisors
          </button>

          <span className="h-5 w-px bg-[var(--color-border-medium)]" aria-hidden="true" />

          <Link
            href="/login"
            className="rounded-lg px-2.5 py-2 text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-navy-900)]"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-teal-600)] px-4 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#0F766E] hover:shadow-[0_8px_20px_-6px_rgba(13,148,136,0.65)]"
          >
            Get started free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {/* ─── MOBILE TOGGLE ─── */}
        <button
          className="lg:hidden -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-navy-900)] transition-colors hover:bg-[var(--color-cream-dark)]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* ─── MOBILE NAV ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden border-t border-[var(--color-border-light)] bg-[var(--color-cream-main)] shadow-xl"
            id="mobile-nav"
          >
            <div className="container-editorial max-h-[calc(100vh-5rem)] space-y-1 overflow-y-auto overscroll-contain py-5">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-3 text-base font-semibold transition-colors hover:bg-[var(--color-cream-dark)] ${
                    location === item.href
                      ? "text-[var(--color-teal-600)]"
                      : "text-[var(--color-navy-900)]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              <div className="px-3 pb-1 pt-4">
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  Tools
                </span>
              </div>

              {toolsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-cream-dark)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: item.wash, color: item.accent }}
                  >
                    <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[var(--color-navy-900)]">
                      {item.label}
                    </span>
                    <span className="block text-sm leading-snug text-[var(--color-text-secondary)]">
                      {item.desc}
                    </span>
                  </span>
                </Link>
              ))}

              <div className="my-3 border-t border-[var(--color-border-light)]" />

              <Link
                href="/signup"
                className="block rounded-lg bg-[var(--color-teal-600)] px-3 py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-[#0F766E]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get started free
              </Link>

              <Link
                href="/login"
                className="block rounded-lg border border-[var(--color-border-medium)] px-3 py-3 text-center text-base font-semibold text-[var(--color-navy-900)] transition-colors hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log in
              </Link>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-base font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-cream-dark)]"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setTimeout(() => setLocation("/agent"), 50);
                }}
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                For advisors
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* The active page gets a short teal rule under it rather than only a
   colour change, which was the sole indicator before and failed for
   anyone who cannot separate teal from slate. */
function ActiveRule() {
  return (
    <motion.span
      layoutId="nav-active-rule"
      className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-[var(--color-teal-600)]"
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    />
  );
}

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
        active
          ? "text-[var(--color-teal-600)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {active ? <ActiveRule /> : null}
    </Link>
  );
}
