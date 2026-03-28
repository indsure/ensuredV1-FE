import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// ARCHIVED: import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

const toolsItems = [
  { label: "Calculator", href: "/calculator" },
  { label: "Check My Coverage", href: "/policychecker" },
  { label: "Compare", href: "/compare" },
];

export function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user: any = null; // ARCHIVED: const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] ${
        isScrolled ? "py-3 shadow-sm" : "py-5"
      }`}>
      <div className="container-editorial flex items-center justify-between">
        {/* ─── LEFT: Logo + Nav ─── */}
        <div className="flex items-center gap-8">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 bg-[var(--color-green-primary)] text-[var(--color-white)] flex items-center justify-center rounded-sm font-serif font-bold text-xl group-hover:bg-[var(--color-green-secondary)] transition-colors">
                I
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-[var(--color-text-main)]">
                IndSure.
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#how-it-works">
              <span
                className={`text-xs font-semibold tracking-[0.15em] uppercase cursor-pointer hover:text-[var(--color-green-primary)] transition-colors ${
                  location === "/#how-it-works"
                    ? "text-[var(--color-green-primary)]"
                    : "text-[var(--color-text-main)]"
                }`}>
                How It Works
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-text-main)] hover:text-[var(--color-green-primary)] transition-colors cursor-pointer outline-none">
                  Tools
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={12}
                className="min-w-[180px] bg-white border border-[var(--color-border-light)] rounded-lg shadow-xl p-1">
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
          </nav>
        </div>

        {/* ─── RIGHT: CTA + Login ─── */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/find-provider">
            <button className="px-5 py-2.5 text-sm font-semibold bg-[var(--color-green-primary)] text-white rounded-lg hover:bg-[var(--color-teal-400)] transition-colors cursor-pointer shadow-md shadow-teal-900/10">
              Find My Provider
            </button>
          </Link>

          <Link href={user ? "/account" : "/login"}>
            <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-text-main)] hover:text-[var(--color-green-primary)] transition-colors cursor-pointer">
              {user ? user.username : "Login"}
            </span>
          </Link>
        </div>

        {/* ─── MOBILE TOGGLE ─── */}
        <button
          className="md:hidden text-[var(--color-text-main)] p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu">
          {mobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
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
            className="md:hidden overflow-hidden bg-[var(--color-cream-main)] border-t border-[var(--color-border-light)] shadow-xl">
            <div className="container-editorial py-6 space-y-1">
              <Link href="/#how-it-works">
                <div
                  className="py-3 px-3 rounded-lg text-sm font-semibold tracking-wide uppercase text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}>
                  How It Works
                </div>
              </Link>

              <div className="py-2 px-3">
                <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
                  Tools
                </span>
              </div>
              {toolsItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="py-3 px-6 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}>
                    {item.label}
                  </div>
                </Link>
              ))}

              <div className="border-t border-[var(--color-border-light)] my-3" />

              <Link href="/find-provider">
                <div
                  className="py-3 px-3 text-center rounded-lg text-sm font-semibold bg-[var(--color-green-primary)] text-white hover:bg-[var(--color-teal-400)] transition-colors cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}>
                  Find My Provider
                </div>
              </Link>

              <Link href={user ? "/account" : "/login"}>
                <div
                  className="py-3 px-3 text-center rounded-lg text-sm font-semibold tracking-wide uppercase text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}>
                  {user ? user.username : "Login"}
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
