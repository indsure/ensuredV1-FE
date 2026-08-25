import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

const navLinksLeft = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Why IndSure", href: "/why-indsure" },
];

const navLinksRight = [
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

/* The mobile menu shows one flat list; only the desktop bar splits around Tools. */
const navLinks = [...navLinksLeft, ...navLinksRight];

const toolsItems = [
  { label: "What We Check", href: "/policychecker" },
  { label: "Calculator", href: "/calculator" },
  { label: "Compare", href: "/compare" },
  { label: "Find My Provider", href: "/find-provider" },
];

export function Header() {
  const [location, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hooks MUST come before any conditional return
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Agent / Admin pages manage their own nav — render nothing here
  if (location.startsWith("/agent") || location.startsWith("/admin")) {
    return null;
  }

  // /start is the reel campaign landing page. Site nav on it is five ways for
  // a cold visitor to not sign up, so it carries its own logo and one CTA.
  if (location === "/start") {
    return null;
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[var(--color-cream-main)] border-b ${isScrolled ? "py-3 border-[var(--color-border-light)]" : "py-5 border-transparent"}`}
    >
      <div className="container-editorial relative flex items-center justify-between">

        {/* ─── LEFT: Logo + Nav ─── */}
        <div className="flex items-center">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img
                src="/logo.png"
                alt="IndSure"
                className="h-10 w-auto group-hover:opacity-80 transition-opacity"
              />
            </div>
          </Link>

          <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-6">
            {navLinksLeft.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={`text-sm font-medium cursor-pointer hover:text-[var(--color-text-main)] transition-colors ${
                    location === item.href
                      ? "text-[var(--color-green-primary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer outline-none">
                  Tools
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={12}
                className="min-w-[180px] bg-white border border-[var(--color-border-light)] rounded-lg shadow-xl p-1"
              >
                {toolsItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>
                      <span className="block w-full px-3 py-2 text-sm font-medium text-[var(--color-text-main)] hover:text-[var(--color-green-primary)] cursor-pointer rounded-md">
                        {item.label}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinksRight.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={`text-sm font-medium cursor-pointer hover:text-[var(--color-text-main)] transition-colors ${
                    location === item.href
                      ? "text-[var(--color-green-primary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* ─── RIGHT: CTAs + Log in + Advisor Login ─── */}
        <div className="hidden lg:flex items-center gap-4">
          <button
            onClick={() => setLocation("/agent")}
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer outline-none"
          >
            For advisors
          </button>

          <Link href="/login">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer">
              Log in
            </span>
          </Link>

          <Link href="/signup">
            <button className="h-9 px-3.5 text-sm font-semibold bg-[var(--color-green-primary)] text-white rounded-lg hover:bg-[var(--color-teal-400)] transition-colors cursor-pointer">
              Get started free
            </button>
          </Link>
        </div>

        {/* ─── MOBILE TOGGLE ─── */}
        <button
          className="lg:hidden -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* ─── MOBILE NAV ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:hidden overflow-hidden bg-[var(--color-cream-main)] border-t border-[var(--color-border-light)] shadow-xl"
            id="mobile-nav"
          >
            <div className="container-editorial py-6 space-y-1 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain">
              {navLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="py-3 px-3 rounded-lg text-sm font-semibold tracking-wide uppercase text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </div>
                </Link>
              ))}

              <div className="py-2 px-3">
                <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
                  Tools
                </span>
              </div>
              {toolsItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="py-3 px-6 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </div>
                </Link>
              ))}

              <div className="border-t border-[var(--color-border-light)] my-3" />

              <Link href="/login">
                <div
                  className="py-3 px-3 text-center rounded-lg text-sm font-semibold border border-[var(--color-border-main)] text-[var(--color-text-main)] hover:border-[var(--color-green-primary)] hover:text-[var(--color-green-primary)] transition-colors cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log in
                </div>
              </Link>

              <Link href="/signup">
                <div
                  className="py-3 px-3 text-center rounded-lg text-sm font-semibold bg-[var(--color-green-primary)] text-white hover:bg-[var(--color-teal-400)] transition-colors cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get started free
                </div>
              </Link>

              <div
                className="py-3 px-3 text-center rounded-lg text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-cream-dark)] transition-colors cursor-pointer flex items-center justify-center gap-2"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setTimeout(() => setLocation("/agent"), 50);
                }}
              >
                <Building2 className="w-4 h-4" />
                For advisors
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
