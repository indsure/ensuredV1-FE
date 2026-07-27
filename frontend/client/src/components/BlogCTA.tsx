import { Link } from "wouter";
import { ArrowRight, Lock, Scale } from "lucide-react";
import type { BlogPost } from "@/pages/blog/blog-data";

/**
 * Topic-aware funnel CTA for blog articles. Health/audit topics point at the
 * free policy analysis (/signup); comparison-shaped topics point at the free
 * catalog compare (/compare). Always carries the no-spam promise — that IS
 * the brand. Replaces the old hardcoded /policychecker boxes and the fake
 * newsletter form (which discarded emails while saying "Subscribed!").
 */

type Target = { href: string; label: string; blurb: string };

export function ctaTargetFor(post: Pick<BlogPost, "title" | "category" | "insuranceType">): Target {
  const t = post.title.toLowerCase();
  const comparish = t.includes(" vs ") || t.includes("compare") || t.includes("which is better");
  const healthish = post.insuranceType === "Health" || post.category === "Health Insurance";

  if (comparish && healthish) {
    return {
      href: "/compare",
      label: "Compare real policies — free",
      blurb: "Pick up to 4 real health plans and compare the actual policy wordings side by side. No upload, no signup.",
    };
  }
  return {
    href: "/signup",
    label: "Analyze my policy — free",
    blurb: "Upload the policy you actually own and get an unbiased 50-point audit in about a minute — saved to your private portfolio.",
  };
}

const PROMISE = "No spam. No cold calls. An advisor reaches out only if you ask.";

/** Inline cream box — sits at the end of the article body. */
export function BlogInlineCTA({ post }: { post: Pick<BlogPost, "title" | "category" | "insuranceType"> }) {
  const target = ctaTargetFor(post);
  return (
    <div className="bg-[var(--color-cream-dark)] rounded-xl p-6 border-l-4 border-[var(--color-teal-600)]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold font-serif text-[var(--color-navy-900)] mb-1.5">
            Reading about it is step one.
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{target.blurb}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[var(--color-teal-600)]" /> {PROMISE}
          </p>
        </div>
        <Link href={target.href}>
          <span className="inline-flex items-center gap-2 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white font-semibold h-11 px-6 rounded-xl whitespace-nowrap transition-colors cursor-pointer">
            {target.label} <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/** Dark closing band — end of the article page. */
export function BlogClosingCTA({ post }: { post: Pick<BlogPost, "title" | "category" | "insuranceType"> }) {
  const target = ctaTargetFor(post);
  return (
    <div className="bg-[var(--color-navy-900)] rounded-2xl p-8 md:p-10 text-center text-white shadow-lg">
      <h3 className="text-2xl font-bold mb-2 font-serif text-white">
        Now see what <span className="italic text-[var(--color-teal-400)]">your</span> cover actually says.
      </h3>
      <p className="text-sm text-white/70 max-w-md mx-auto mb-6">{target.blurb}</p>
      <Link href={target.href}>
        <span className="inline-flex items-center gap-2 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white font-bold h-12 px-8 rounded-xl transition-colors cursor-pointer">
          {target.label} <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
      <p className="mt-4 text-xs text-white/50 flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5" /> {PROMISE}
      </p>
    </div>
  );
}

/** Compact sidebar card — replaces the fake newsletter form. */
export function BlogSidebarCTA() {
  return (
    <div className="bg-white border border-[var(--color-border-light)] rounded-xl p-5 shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-[var(--color-teal-600)]/10 flex items-center justify-center mb-3">
        <Scale className="w-5 h-5 text-[var(--color-teal-600)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-navy-900)] mb-1.5">
        Stop reading generic advice
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
        Get a free 50-point audit of the policy you actually own.
      </p>
      <Link href="/signup">
        <span className="inline-flex w-full items-center justify-center gap-1.5 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white text-sm font-semibold h-9 px-4 rounded-lg transition-colors cursor-pointer">
          Analyze my policy <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-2.5 flex items-center gap-1">
        <Lock className="w-3 h-3 text-[var(--color-teal-600)]" /> {PROMISE}
      </p>
    </div>
  );
}

/** Wide funnel band for the blog listing page — replaces the fake newsletter hero. */
export function BlogListingCTA() {
  return (
    <div className="bg-[var(--color-navy-900)] rounded-2xl p-10 md:p-14 text-center text-white max-w-3xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold font-serif text-white mb-3">
        Enough theory. Check <span className="italic text-[var(--color-teal-400)]">your</span> policy.
      </h2>
      <p className="text-sm md:text-base text-white/70 mb-7 max-w-lg mx-auto leading-relaxed">
        Every article here describes a gap someone found out about at claim time.
        A free account shows you yours in about a minute.
      </p>
      <Link href="/signup">
        <span className="inline-flex items-center gap-2 bg-[var(--color-teal-600)] hover:bg-[var(--color-teal-400)] text-white font-bold h-12 px-8 rounded-xl transition-colors cursor-pointer">
          Analyze my policy — free <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
      <p className="mt-4 text-xs text-white/50 flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5" /> {PROMISE}
      </p>
    </div>
  );
}
