import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { motion } from "framer-motion";
import { IndSureLogo } from "@/components/IndSureLogo";

export function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "How it works", href: "/#how-it-works" }, // Anchor link support
    { label: "Calculator", href: "/calculator" },
    { label: "Why IndSure", href: "/why-indsure" }, // New page
    { label: "Resources", href: "/blog" },
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] ${isScrolled
        ? "py-3 shadow-sm"
        : "py-6"
        }`}
    >
      <div className="container-editorial flex items-center justify-between">

        {/* LOGO */}
        <Link href="/">
          <div className="flex items-center gap-x-1.5 cursor-pointer group">
            <IndSureLogo
              className="h-8 w-auto text-[var(--color-text-main)]"
              aria-label="IndSure"
            />
            <span className="font-serif text-2xl font-bold text-gray-800 tracking-tight">
              IndSure.
            </span>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-x-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span className={`text-sm font-medium tracking-wide cursor-pointer hover:text-[var(--color-green-primary)] transition-colors ${location === link.href ? "text-[var(--color-green-primary)]" : "text-[var(--color-text-main)]"
                }`}>
                {link.label.toUpperCase()}
              </span>
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/policychecker">
            <span className="text-sm font-medium text-[var(--color-text-main)] hover:text-[var(--color-green-primary)] hover:underline cursor-pointer">
              Check My Coverage
            </span>
          </Link>
          <Link href="/find-provider">
            <button className="px-4 py-2 text-sm font-medium text-[var(--color-text-main)] border border-[var(--color-border-dark)] rounded-md hover:bg-[var(--color-green-primary)] hover:text-white hover:border-[var(--color-green-primary)] transition-all cursor-pointer">
              Find my provider
            </button>
          </Link>
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button
          className="md:hidden text-[var(--color-text-main)]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* MOBILE NAV */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] p-6 space-y-4 shadow-xl">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className="block text-[var(--color-text-main)] font-medium py-2 border-b border-[var(--color-border-light)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.header>
  );
}
