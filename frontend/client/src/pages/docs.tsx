import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, FileText, Info, Lightbulb, Link2, Menu,
  MessageCircle, PlayCircle, Rocket, Search, TrendingUp, UserCog, Users, Wrench, X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { useLanguage } from "@/i18n/LanguageContext";
import { teamWaLink } from "@/components/app/portfolio-utils";
import NotFound from "@/pages/not-found";
import {
  DOC_PAGES, DOC_SECTIONS, DOCS_UPDATED, docPath, docPlainText, type DocBlock, type DocPage,
} from "@/docs/content";

/**
 * /docs and /docs/:slug, the advisor help centre.
 *
 * The words live in docs/content.ts so the prerender can write them into static
 * HTML as well. This file only lays them out. Built for advisors reading on a
 * phone: 18px body text, big tap targets, and screenshots that open full size.
 */

const PHONE_SHOT = { w: 390, h: 844 };
const DESKTOP_SHOT = { w: 1280, h: 800 };

function updatedLabel(): string {
  const d = new Date(`${DOCS_UPDATED}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// **bold** and [label](href), nothing else. Internal paths use the router so a
// click does not reload the page.
function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(<strong key={i++} className="font-semibold text-[var(--color-navy-900)]">{m[1]}</strong>);
    } else {
      const href = m[3];
      const cls = "font-semibold text-[var(--color-teal-700)] underline underline-offset-4 decoration-[var(--color-teal-600)]/40 hover:decoration-[var(--color-teal-600)]";
      parts.push(
        href.startsWith("/") ? (
          <Link key={i++} href={href} className={cls}>{m[2]}</Link>
        ) : (
          <a key={i++} href={href} className={cls}>{m[2]}</a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Shot({ block, eager }: { block: Extract<DocBlock, { t: "img" }>; eager: boolean }) {
  const size = block.phone ? PHONE_SHOT : DESKTOP_SHOT;
  const src = `/docs/screens/${block.name}.webp`;
  const src2x = `/docs/screens/${block.name}@2x.webp`;
  return (
    <figure className={`my-8 ${block.phone ? "max-w-[300px]" : ""}`}>
      {/* A link to the full-size image: on a phone a screenshot shrinks to a
          few pixels per letter, and pinching a page is harder than one tap. */}
      <a
        href={src2x}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-white shadow-sm"
        aria-label={`${block.alt} Opens the full-size picture.`}
      >
        <img
          src={src}
          srcSet={`${src} ${size.w}w, ${src2x} ${size.w * 2}w`}
          sizes={block.phone ? "300px" : "(min-width: 1024px) 760px, 100vw"}
          width={size.w}
          height={size.h}
          alt={block.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="block h-auto w-full"
        />
        <span className="absolute bottom-2 right-2 rounded-full bg-[var(--color-navy-900)]/80 px-2.5 py-1 text-sm font-semibold text-white">
          Sample data
        </span>
      </a>
      {block.caption && (
        <figcaption className="mt-2.5 text-base text-[var(--color-text-secondary)]">
          {block.caption} <span className="print:hidden">Tap the picture to see it full size.</span>
        </figcaption>
      )}
    </figure>
  );
}

const NOTE_STYLE = {
  tip: { box: "bg-[#F0FDFA] border-[#99F6E4]", icon: Lightbulb, iconCls: "text-[#0F766E]", label: "Tip" },
  note: { box: "bg-[#EFF6FF] border-[#BFDBFE]", icon: Info, iconCls: "text-[#1D4ED8]", label: "Good to know" },
  warn: { box: "bg-[#FFFBEB] border-[#FDE68A]", icon: AlertTriangle, iconCls: "text-[#B45309]", label: "Careful" },
};

function Block({ block, firstImage }: { block: DocBlock; firstImage: boolean }) {
  switch (block.t) {
    case "p":
      return <p className="my-5 text-lg leading-relaxed text-[var(--color-text-main)]"><Inline text={block.text} /></p>;
    case "h2":
      return (
        <h2 id={block.id} className="group mt-12 mb-4 scroll-mt-28 font-serif text-2xl sm:text-3xl font-bold text-[var(--color-navy-900)]">
          <a href={`#${block.id}`} className="hover:underline underline-offset-4">{block.text}</a>
        </h2>
      );
    case "steps":
      return (
        <ol className="my-6 flex flex-col gap-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal-600)] text-base font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1 text-lg leading-relaxed text-[var(--color-text-main)]"><Inline text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="my-6 flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-lg leading-relaxed text-[var(--color-text-main)]">
              <span aria-hidden="true" className="mt-[0.7em] h-2 w-2 shrink-0 rounded-full bg-[var(--color-teal-600)]" />
              <span><Inline text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case "img":
      return <Shot block={block} eager={firstImage} />;
    case "note": {
      const s = NOTE_STYLE[block.tone];
      const Icon = s.icon;
      return (
        <aside className={`my-6 flex gap-3 rounded-xl border p-4 sm:p-5 ${s.box}`}>
          <Icon className={`mt-1 h-5 w-5 shrink-0 ${s.iconCls}`} aria-hidden="true" />
          <p className="text-lg leading-relaxed text-[var(--color-text-main)]">
            <span className="font-semibold">{s.label}: </span>
            <Inline text={block.text} />
          </p>
        </aside>
      );
    }
    case "faq":
      return (
        <div className="my-6 flex flex-col gap-3">
          {block.items.map((f, i) => (
            <details key={i} className="group rounded-xl border border-[var(--color-border-light)] bg-white open:shadow-sm">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-lg font-semibold text-[var(--color-navy-900)]">
                <span>{f.q}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)] transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-lg leading-relaxed text-[var(--color-text-main)]"><Inline text={f.a} /></p>
            </details>
          ))}
        </div>
      );
    case "cards":
      return (
        <div className="my-8 grid gap-3 sm:grid-cols-2">
          {block.slugs.map((slug) => {
            const p = DOC_PAGES.find((d) => d.slug === slug);
            if (!p) return null;
            return (
              <Link
                key={slug}
                href={docPath(slug)}
                className="group flex flex-col gap-1.5 rounded-xl border border-[var(--color-border-light)] bg-white p-5 transition-colors hover:border-[var(--color-teal-600)]"
              >
                <span className="flex items-center justify-between gap-2 text-lg font-bold text-[var(--color-navy-900)]">
                  {p.title}
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-teal-600)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="text-base leading-relaxed text-[var(--color-text-secondary)]">{p.lead}</span>
              </Link>
            );
          })}
        </div>
      );
    case "cta":
      return <Cta kind={block.kind} />;
  }
}

function Cta({ kind }: { kind: "demo" | "signup" | "contact" }) {
  const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold";
  if (kind === "contact") {
    return (
      <div className="my-8 flex flex-col gap-4 rounded-2xl bg-[var(--color-navy-900)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-semibold">Still need help?</p>
          <p className="text-base text-white/80">Message our team on WhatsApp. A person will reply.</p>
        </div>
        <a
          href={teamWaLink("Hi, I am an IndSure advisor and I need help with the portal.")}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} shrink-0 bg-[#25D366] text-[#0B1120] hover:bg-[#20bd5a]`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          Message us on WhatsApp
        </a>
      </div>
    );
  }
  return (
    <div className="my-8 flex flex-col gap-4 rounded-2xl bg-[var(--color-navy-900)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xl font-semibold">See it for yourself</p>
        {/* claim-source: /agent/playground runs the whole portal on the in-memory mock
            (lib/playground/mode.ts, lib/supabase.ts); no sign-in exists on that path. Verified 2026-09-24. */}
        <p className="text-base text-white/80">Try the portal with sample data. No account needed.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/agent/playground?tour=1" className={`${btn} bg-[var(--color-cta)] text-white hover:bg-[var(--color-cta-hover)]`}>
          <PlayCircle className="h-5 w-5" aria-hidden="true" />
          Take the tour
        </Link>
        <Link href="/agent/signup/step1" className={`${btn} border border-white/30 text-white hover:bg-white/10`}>
          Start free
        </Link>
      </div>
    </div>
  );
}

// One colour and icon per section, in DOC_SECTIONS order, so 27 rows read as six
// groups instead of one list. A section with no entry here falls back to the last.
const SECTION_STYLE: { icon: typeof BookOpen; tint: string }[] = [
  { icon: Rocket, tint: "bg-[#E6F7F4] text-[#0F766E]" },
  { icon: Users, tint: "bg-[#EFF6FF] text-[#1D4ED8]" },
  { icon: FileText, tint: "bg-[#F5F3FF] text-[#6D28D9]" },
  { icon: Wrench, tint: "bg-[#FFFBEB] text-[#B45309]" },
  { icon: TrendingUp, tint: "bg-[#FDF2F8] text-[#BE185D]" },
  { icon: UserCog, tint: "bg-[#F1F5F9] text-[#334155]" },
];

function Nav({ current, onNavigate, searchRef }: { current: string; onNavigate?: () => void; searchRef?: RefObject<HTMLInputElement | null> }) {
  const [query, setQuery] = useState("");
  const currentSection = DOC_SECTIONS.findIndex((s) => s.pages.some((p) => p.slug === current));
  // Only the section you are reading starts open: six headings fit on one
  // screen, twenty-seven links do not.
  const [open, setOpen] = useState<Set<number>>(() => new Set([currentSection]));
  useEffect(() => {
    setOpen((prev) => (prev.has(currentSection) ? prev : new Set(prev).add(currentSection)));
  }, [currentSection]);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return [];
    return DOC_PAGES.filter((p) => {
      const hay = `${p.title} ${docPlainText(p)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <nav aria-label="Docs" className="flex flex-col gap-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs"
          aria-label="Search the docs"
          className="h-11 w-full rounded-lg border border-transparent bg-[#F4F4F2] pl-9 pr-9 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-500 focus:border-[var(--color-teal-600)] focus:bg-white"
        />
        {searchRef && (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 text-sm text-slate-500 lg:block">/</kbd>
        )}
      </div>

      {words.length > 0 ? (
        <div>
          <p className="mb-2 px-1 text-sm font-semibold text-slate-600">
            {results.length === 0 ? "Nothing found. Try another word." : `${results.length} ${results.length === 1 ? "page" : "pages"} found`}
          </p>
          <ul className="flex flex-col gap-0.5">
            {results.map((p) => (
              <li key={p.slug}>
                <Link href={docPath(p.slug)} onClick={() => { setQuery(""); onNavigate?.(); }} className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-slate-800 hover:bg-slate-100 lg:min-h-10">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {DOC_SECTIONS.map((section, i) => {
            const style = SECTION_STYLE[i] ?? SECTION_STYLE[SECTION_STYLE.length - 1];
            const Icon = style.icon;
            const isOpen = open.has(i);
            const listId = `docs-section-${i}`;
            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1.5 text-left text-[15px] font-semibold text-[var(--color-navy-900)] hover:bg-slate-50 lg:min-h-10"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${style.tint}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{section.title}</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <ul id={listId} className="mb-2 ml-[19px] mt-0.5 border-l border-slate-200">
                    {section.pages.map((p) => {
                      const active = p.slug === current;
                      return (
                        <li key={p.slug}>
                          <Link
                            href={docPath(p.slug)}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={`-ml-px flex min-h-11 items-center gap-2 border-l-2 py-1.5 pl-4 pr-2 text-[15px] transition-colors lg:min-h-9 ${
                              active
                                ? "border-[var(--color-teal-600)] bg-[#F0FDFA] font-semibold text-[var(--color-navy-900)]"
                                : "border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-900"
                            }`}
                          >
                            <span className="flex-1">{p.nav ?? p.title}</span>
                            {p.badge && (
                              <span className="shrink-0 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-sm font-medium leading-none text-[#92400E]">{p.badge}</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar still has the link.
      window.prompt("Copy this link:", window.location.href.split("#")[0]);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border-medium)] bg-white px-4 text-base font-semibold text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] print:hidden"
    >
      {copied ? <Check className="h-4 w-4 text-[var(--color-teal-600)]" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Link copied" : "Copy link to this page"}
    </button>
  );
}

export default function Docs({ slug = "" }: { slug?: string }) {
  const { t, locale } = useLanguage();
  const page = DOC_PAGES.find((p) => p.slug === slug);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // "/" jumps to search, as on most docs sites, unless you are already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useSEO({
    title: page ? (page.slug ? `${page.title} | IndSure Docs` : "IndSure Docs for Advisors") : "Page not found | IndSure",
    description: page?.description ?? "",
    canonical: `https://indsure.in${docPath(slug)}`,
    noindex: !page,
  });

  // A new page starts at the top, unless the link points at a heading.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [slug]);

  if (!page) return <NotFound />;

  const index = DOC_PAGES.indexOf(page);
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;
  const section = DOC_SECTIONS.find((s) => s.pages.includes(page));
  const headings = page.blocks.filter((b): b is Extract<DocBlock, { t: "h2" }> => b.t === "h2");
  const firstImage = page.blocks.findIndex((b) => b.t === "img");

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      {/* Phone: the page list lives behind one button, under the header. */}
      <div className="sticky top-16 z-30 mt-16 border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)]/95 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-base font-semibold text-[var(--color-navy-900)]"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          Docs menu
          <span className="ml-auto truncate text-sm font-medium text-[var(--color-text-secondary)]">{section?.title}</span>
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Docs menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[88vw] max-w-sm overflow-y-auto bg-white p-4 pb-12 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-navy-900)] text-[#5eead4]">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-bold text-[var(--color-navy-900)]">IndSure Docs</span>
                  <span className="text-sm text-slate-500">For advisors</span>
                </span>
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--color-cream-dark)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav current={page.slug} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:pt-24 xl:grid-cols-[280px_minmax(0,1fr)_220px]">
        <aside className="hidden lg:block print:hidden">
          {/* A white panel, so the menu reads as its own thing against the cream
              page, and a scrollbar that only shows while the pointer is on it. */}
          <div className="sticky top-24 mb-10 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:#cbd5e1_transparent]">
            <Link href="/docs" className="mb-4 flex items-center gap-3 rounded-lg px-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-navy-900)] text-[#5eead4]">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-base font-bold text-[var(--color-navy-900)]">IndSure Docs</span>
                <span className="text-sm text-slate-500">For advisors</span>
              </span>
            </Link>
            <Nav current={page.slug} searchRef={searchRef} />
          </div>
        </aside>

        <main id="main-content" className="min-w-0 max-w-[780px] pb-28 pt-6 lg:pb-16 lg:pt-2">
          {locale === "hi" && (
            <p className="mb-6 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-base text-[var(--color-text-main)]">
              {t("docs.hindi_note")}
            </p>
          )}
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-base text-[var(--color-text-secondary)]">
            <Link href="/docs" className="inline-flex min-h-11 items-center hover:underline">Docs</Link>
            {page.slug && section && (
              <>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span>{section.title}</span>
              </>
            )}
          </nav>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-[var(--color-navy-900)]">{page.title}</h1>
          <p className="mt-4 text-xl leading-relaxed text-[var(--color-text-secondary)]">{page.lead}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CopyLink />
            <span className="text-base text-[var(--color-text-secondary)]">Updated {updatedLabel()}</span>
          </div>

          {/* On this page, for phones and tablets where there is no side column. */}
          {headings.length > 2 && (
            <nav aria-label="On this page" className="mt-8 rounded-xl border border-[var(--color-border-light)] bg-white p-5 xl:hidden print:hidden">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">On this page</p>
              <ul className="flex flex-col gap-1">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="flex min-h-11 items-center text-base font-medium text-[var(--color-teal-700)] hover:underline">{h.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <article className="mt-6">
            {page.blocks.map((b, i) => (
              <Fragment key={i}>
                <Block block={b} firstImage={i === firstImage} />
              </Fragment>
            ))}
          </article>

          <nav aria-label="Previous and next page" className="mt-14 grid gap-3 border-t border-[var(--color-border-light)] pt-8 sm:grid-cols-2 print:hidden">
            {prev ? (
              <Link href={docPath(prev.slug)} className="flex min-h-16 flex-col justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-3 hover:border-[var(--color-teal-600)]">
                <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous</span>
                <span className="text-lg font-semibold text-[var(--color-navy-900)]">{prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link href={docPath(next.slug)} className="flex min-h-16 flex-col items-end justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-3 text-right hover:border-[var(--color-teal-600)]">
                <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)]">Next <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                <span className="text-lg font-semibold text-[var(--color-navy-900)]">{next.title}</span>
              </Link>
            )}
          </nav>
        </main>

        {headings.length > 0 && (
          <aside className="hidden xl:block print:hidden">
            <div className="sticky top-24 pb-10">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">On this page</p>
              <ul className="flex flex-col gap-1 border-l border-[var(--color-border-light)]">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-base text-[var(--color-text-secondary)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-navy-900)]">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <div className="print:hidden"><Footer /></div>
    </div>
  );
}
