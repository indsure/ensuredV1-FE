import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, Lock, IndianRupee, ShieldCheck, ListChecks, Users,
  CalendarClock, Scale, FileText, MessageSquare, Bell, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";

/* Every rupee figure inside a product panel on this page is illustrative and is
   labelled as such inside the panel border. Nothing here is a product output. */

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const wrap = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/* The chrome every product panel shares: traffic lights, a route, and the
   Illustrative label INSIDE the border — the old homepage put that label
   outside the card it qualified, so it read as a real capability. */
function PanelBar({ route }: { route: string }) {
  return (
    <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center gap-3 px-3.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
      </div>
      <div className="flex-1 flex justify-center">
        <span className="px-3 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-medium text-[var(--color-text-muted)]">
          {route}
        </span>
      </div>
      <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
        Illustrative
      </span>
    </div>
  );
}

const panelShadow =
  "0 0 0 1px rgba(0,0,0,0.07), 0 2px 2px -1px rgba(0,0,0,0.02), 0 6px 6px -3px rgba(0,0,0,0.02), 0 14px 14px -7px rgba(0,0,0,0.018), 0 28px 28px -14px rgba(0,0,0,0.018), 0 56px 56px -28px rgba(0,0,0,0.02)";

/* ─────────────── HERO ─────────────── */

function Hero() {
  return (
    <section className="bg-[var(--color-cream-main)] pb-4">
      <div className="container-editorial px-6">
        <motion.div variants={wrap} initial="hidden" animate="visible" className="flex flex-col gap-6 pt-10 lg:pt-16">
          <motion.h1
            variants={rise}
            className="font-serif font-bold tracking-[-0.035em] leading-[1.04] text-4xl sm:text-6xl lg:text-7xl max-w-4xl text-[var(--color-navy-900)]"
          >
            Your insurance, <span className="text-[var(--color-teal-600)]">finally</span>
            <br className="hidden sm:block" /> under control.
          </motion.h1>

          <motion.p variants={rise} className="text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
            Health, term life, car, travel — every policy your family owns in one place. See what
            each one really covers, what it will not pay, and what renews next.
          </motion.p>

          <motion.div variants={rise} className="flex flex-col sm:flex-row gap-3">
            <Link href="/signup" className="w-full sm:w-auto">
              <button className="w-full h-[52px] px-6 rounded-lg bg-[var(--color-teal-600)] text-white text-base font-semibold hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2">
                Check my policy — free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-[52px] px-6 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                See everything we check
              </button>
            </Link>
          </motion.div>

          <motion.div variants={rise} className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2 text-sm sm:text-base text-[var(--color-text-secondary)]">
              <Lock className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
              No spam. No cold calls. We sell zero leads.
            </span>
            <span className="flex items-center gap-2 text-sm sm:text-base text-[var(--color-text-secondary)]">
              <IndianRupee className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
              ₹0 commission earned, ever.
            </span>
          </motion.div>
        </motion.div>
      </div>

      <HeroPanels />
    </section>
  );
}

/* The fold used to carry a headline, four unsourced numbers and a marquee — no
   picture of the product at all. This is the product: everything you own, a
   second tool answering a question analysis cannot, and Sach. */
function HeroPanels() {
  return (
    <div className="container-editorial px-6 pt-10 lg:pt-14">
      <div className="rounded-3xl bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] p-4 sm:p-8 lg:p-12">
        <div className="grid lg:grid-cols-5 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-3 rounded-xl bg-white overflow-hidden"
            style={{ boxShadow: panelShadow }}
          >
            <PanelBar route="indsure.in / app" />
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Everything the Sharmas own
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--color-navy-900)]">₹1.6 Cr</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">across 5 policies · 3 insurers</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { k: "Health", v: "₹10 L", m: "Star Health · family" },
                  { k: "Term life", v: "₹1 Cr", m: "HDFC Life · to 2049" },
                  { k: "Car", v: "₹6.4 L", m: "ICICI · own damage" },
                  { k: "Two-wheeler", v: "₹84 K", m: "Bajaj Allianz" },
                  { k: "Travel", v: "₹42 L", m: "Expires 14 Sep" },
                ].map((p) => (
                  <div key={p.k} className="rounded-xl border border-[var(--color-border-light)] p-3 flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-[var(--color-text-secondary)]">{p.k}</span>
                    <span className="text-base font-extrabold tracking-tight text-[var(--color-navy-900)]">{p.v}</span>
                    <span className="text-sm text-[var(--color-text-muted)] leading-snug">{p.m}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-[var(--color-border-medium)] bg-[var(--color-cream-main)] p-3 flex flex-col gap-1.5 justify-center">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-gold-500)]">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Missing
                  </span>
                  <span className="text-sm font-bold text-[var(--color-gold-500)] leading-snug">Personal accident</span>
                </div>
              </div>

              <div className="rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] px-3.5 py-3 flex items-center gap-2.5">
                <IndianRupee className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
                <span className="text-sm leading-relaxed text-[#115E59]">
                  You pay <strong className="font-bold">₹98,400 a year</strong> across all five. Two of them overlap.
                </span>
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="rounded-xl bg-white overflow-hidden"
              style={{ boxShadow: panelShadow }}
            >
              <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center justify-between px-3.5">
                <span className="text-sm font-bold text-[var(--color-navy-900)]">How much cover</span>
                <span className="text-sm text-[var(--color-text-muted)]">Cover Calculator</span>
              </div>
              <div className="p-4 flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                    For a 38-year-old, two children, home loan
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">₹1.9 Cr</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">is what you need</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)] font-semibold">You have</span>
                    <span className="font-bold text-[var(--color-navy-900)]">₹1 Cr</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--color-cream-dark)] overflow-hidden flex">
                    <span className="h-full bg-[var(--color-teal-600)]" style={{ width: "53%" }} />
                    <span className="h-full flex-1 bg-[#FECACA]" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#B91C1C]">Short by ₹90 L</span>
                    <span className="text-[var(--color-text-muted)]">about ₹1,100 a month</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="rounded-xl bg-white p-4 flex flex-col gap-3"
              style={{ boxShadow: panelShadow }}
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[var(--color-teal-600)] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </span>
                <span className="text-sm font-bold text-[var(--color-navy-900)]">Sach</span>
                <span className="text-sm text-[var(--color-text-muted)]">· answers in Hindi too</span>
              </div>
              <div className="self-end max-w-[85%] rounded-xl rounded-br-sm bg-[var(--color-cream-dark)] px-3 py-2">
                <span className="text-sm leading-relaxed text-[var(--color-text-main)]">
                  Papa is 63. Can I add him to my health policy?
                </span>
              </div>
              <div className="self-start max-w-[92%] rounded-xl rounded-bl-sm bg-[#F0FDFA] border border-[#CCFBF1] px-3 py-2">
                <span className="text-sm leading-relaxed text-[#115E59]">
                  Your plan allows it, but everyone on the policy then pays 20% of each claim. A
                  separate senior plan usually works out cheaper — shall I compare three?
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── PRODUCT — two portals ─────────────── */

const ADVISOR_TABS = [
  { id: "queue", label: "Queue", icon: ListChecks, title: "My Queue", route: "/agent/my-queue", chip: "6 items",
    blurb: "What needs you this morning, in the order it needs you. Not a wall of tiles." },
  { id: "leads", label: "Leads", icon: Users, title: "Leads", route: "/agent/leads", chip: "16 open",
    blurb: "New, contacted, interested, won, lost — and who you promised to call back today." },
  { id: "renewals", label: "Renewals", icon: CalendarClock, title: "Renewals", route: "/agent/renewals", chip: "6 in 30 days",
    blurb: "Every policy coming up in the next 30 days, with the draft already written." },
  { id: "compare", label: "Compare", icon: Scale, title: "Compare", route: "/agent/compare", chip: "Uses 1 check",
    blurb: "Two policies side by side, in the words a customer actually asks about." },
  { id: "claims", label: "Claims", icon: FileText, title: "Claims desk", route: "/agent/claims", chip: "3 open",
    blurb: "Where a claim is stuck, what the insurer asked for, and who is waiting on you." },
];

function Chip({ tone, children }: { tone: "red" | "amber" | "teal" | "slate"; children: React.ReactNode }) {
  const map = {
    red: "bg-[#FEF2F2] text-[#DC2626]",
    amber: "bg-[#FFFBEB] text-[var(--color-gold-500)]",
    teal: "bg-[#F0FDFA] text-[#0F766E]",
    slate: "bg-[var(--color-cream-dark)] text-[var(--color-text-secondary)]",
  } as const;
  return <span className={`px-2 py-1 rounded-md text-sm font-bold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

function Score({ n, tone }: { n: number; tone: "red" | "amber" | "teal" }) {
  const map = {
    red: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    amber: "bg-[#FEF3C7] text-[var(--color-gold-500)] border-[#FDE68A]",
    teal: "bg-[#F0FDFA] text-[#0F766E] border-[#CCFBF1]",
  } as const;
  return (
    <span className={`min-w-9 px-2 py-1 rounded-md border text-base font-extrabold text-center ${map[tone]}`}>{n}</span>
  );
}

const QUEUE_ROWS = [
  { name: "Vikram Singh", meta: "Star Health · ₹42,000", due: "Renews in 3 days", tone: "red" as const, score: 49, s: "red" as const },
  { name: "Meena Patel", meta: "HDFC Ergo · ₹28,500", due: "Renews in 6 days", tone: "amber" as const, score: 63, s: "amber" as const },
  { name: "Imran Qureshi", meta: "Niva Bupa · ₹19,200", due: "Renews in 11 days", tone: "slate" as const, score: 78, s: "teal" as const },
];

function AdvisorPanel() {
  const [tab, setTab] = useState("queue");
  const active = ADVISOR_TABS.find((t) => t.id === tab) ?? ADVISOR_TABS[0];

  return (
    <div className="rounded-xl bg-white overflow-hidden grid grid-cols-[76px_1fr]" style={{ boxShadow: panelShadow }}>
      <div className="bg-[var(--color-cream-dark)] border-r border-[var(--color-border-light)] py-5 flex flex-col items-center gap-4">
        {ADVISOR_TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={on}
              className="w-16 flex flex-col items-center gap-1.5 outline-none"
            >
              <span
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                  on
                    ? "bg-[var(--color-teal-600)] border-[var(--color-teal-600)]"
                    : "bg-white border-[var(--color-border-light)] hover:bg-[var(--color-cream-main)]"
                }`}
              >
                <Icon className={`w-5 h-5 ${on ? "text-white" : "text-[var(--color-text-muted)]"}`} />
              </span>
              <span className={`text-sm font-semibold ${on ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col min-h-[520px]">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-light)] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold tracking-tight text-[var(--color-navy-900)]">{active.title}</h3>
            <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
              Illustrative
            </span>
          </div>
          <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{active.blurb}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-cream-main)] text-sm font-semibold text-[var(--color-text-secondary)]">
              {active.route}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#F0FDFA] border border-[#CCFBF1] text-sm font-bold text-[#0F766E]">
              {active.chip}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3.5">
          {tab === "queue" && (
            <>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {QUEUE_ROWS.map((r, i) => (
                  <div
                    key={r.name}
                    className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{r.name}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{r.meta}</span>
                    </div>
                    <Chip tone={r.tone}>{r.due}</Chip>
                    <Score n={r.score} tone={r.s} />
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#0F766E]">Draft ready — English</span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-teal-600)] text-white text-sm font-bold">EN</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">हिंदी</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">Hinglish</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[#115E59]">
                  Namaste Vikram ji, your Star Health policy renews on 4 September. Shall I send you
                  the check before you pay?
                </p>
              </div>
            </>
          )}

          {tab === "leads" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Chip tone="slate">New 4</Chip>
                <Chip tone="slate">Contacted 7</Chip>
                <Chip tone="amber">Interested 3</Chip>
                <Chip tone="teal">Won 2</Chip>
              </div>
              <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-3 flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[var(--color-gold-500)] shrink-0" />
                <span className="text-base font-bold text-[#78350F]">Call today (2)</span>
              </div>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  { n: "Sunita Rao", m: "Referral · Pune · wants family floater", d: "Call 25 Aug", t: "amber" as const },
                  { n: "Arjun Mehta", m: "WhatsApp · Mumbai · term life, ₹1 Cr", d: "Overdue 2d", t: "red" as const },
                  { n: "Fatima Sheikh", m: "Walk-in · Hyderabad · motor renewal", d: "Contacted", t: "slate" as const },
                ].map((l, i) => (
                  <div key={l.n} className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{l.n}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{l.m}</span>
                    </div>
                    <Chip tone={l.t}>{l.d}</Chip>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "renewals" && (
            <>
              <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
                <strong className="font-bold text-[var(--color-navy-900)]">6 policies</strong> due in
                the next 30 days. Reach out before they renew.
              </p>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  { n: "Vikram Singh", m: "Star Health · Family floater ₹10 L", d: "in 3d", p: "₹42,000", c: "text-[#DC2626]" },
                  { n: "Meena Patel", m: "HDFC Ergo · Individual ₹5 L", d: "in 6d", p: "₹28,500", c: "text-[var(--color-gold-500)]" },
                  { n: "Imran Qureshi", m: "Niva Bupa · Individual ₹7.5 L", d: "in 11d", p: "₹19,200", c: "text-[var(--color-gold-500)]" },
                  { n: "Kavita Nair", m: "ICICI Lombard · Motor, own damage", d: "in 24d", p: "₹8,400", c: "text-[var(--color-text-secondary)]" },
                ].map((r, i) => (
                  <div key={r.n} className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 3 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{r.n}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{r.m}</span>
                    </div>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className={`text-sm font-extrabold ${r.c}`}>{r.d}</span>
                      <span className="text-sm text-[var(--color-text-muted)]">{r.p}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "compare" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#CCFBF1] bg-[#F0FDFA] p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Star Health</span>
                    <Score n={78} tone="teal" />
                  </div>
                  <span className="text-sm font-semibold text-[#0F766E]">₹10 L · ₹42,000</span>
                </div>
                <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Niva Bupa</span>
                    <Score n={63} tone="amber" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)]">₹10 L · ₹38,700</span>
                </div>
              </div>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  ["Room rent cap", "No cap", "₹5,000 / day"],
                  ["Co-pay", "None", "20% over 60"],
                  ["Knee / hip waiting", "2 years", "4 years"],
                ].map(([k, a, b], i) => (
                  <div key={k} className={`grid grid-cols-3 gap-2 px-3.5 py-3 items-center ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <span className="text-base font-semibold text-[var(--color-navy-900)]">{k}</span>
                    <span className="text-sm font-bold text-[#0F766E]">{a}</span>
                    <span className="text-sm font-bold text-[#DC2626]">{b}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                ₹3,300 cheaper, and it will cost more at the first hospital bill. Side by side, in
                front of the customer.
              </p>
            </>
          )}

          {tab === "claims" && (
            <>
              <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Meena Patel · HDFC Ergo</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">Cashless · Apollo, Navi Mumbai</span>
                  </div>
                  <Chip tone="amber">Query raised</Chip>
                </div>
                <div className="flex items-center gap-2">
                  {["Filed", "Documents", "Query", "Settled"].map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                      <span
                        className={`w-full h-1 rounded-full ${
                          i < 2 ? "bg-[var(--color-teal-600)]" : i === 2 ? "bg-[var(--color-gold-500)]" : "bg-[var(--color-border-light)]"
                        }`}
                      />
                      <span className={`text-sm font-semibold ${i <= 2 ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3.5 flex flex-col gap-1">
                <span className="text-sm font-bold text-[#78350F]">Insurer asked, 2 days ago</span>
                <span className="text-sm leading-relaxed text-[#92400E]">
                  Discharge summary and the treating doctor's note for the 14 August admission.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <section id="product" className="scroll-mt-28 bg-[var(--color-cream-main)] py-14 sm:py-20 lg:py-24">
      <div className="container-editorial px-6 flex flex-col items-center gap-3 text-center">
        <span className="px-3 py-1 rounded-full bg-[var(--color-teal-600)]/10 border border-[var(--color-teal-600)]/20 text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-teal-600)]">
          The product
        </span>
        <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl lg:text-5xl text-[var(--color-navy-900)]">
          One engine. Two ways in.
        </h2>
        <p className="text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-xl">
          The same policy check runs underneath both. What changes is whose book it is — an
          advisor's, or your own.
        </p>
      </div>

      {/* Band 1 — Advisor Portal */}
      <div className="container-editorial px-6 mt-12 lg:mt-16 grid lg:grid-cols-[minmax(0,400px)_1fr] gap-10 lg:gap-14 items-start">
        <div className="flex flex-col gap-6 lg:pt-2">
          <Link href="/agent">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
              Advisor Portal <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <h3 className="font-serif font-bold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-4xl text-[var(--color-navy-900)]">
            Run your whole book from one screen
          </h3>
          <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-secondary)]">
            Leads, renewals, policies and claims in one place. When a customer asks what their cover
            actually does, you have the answer before the call ends.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/agent/signup/step1" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-[var(--color-teal-600)] text-white text-base font-semibold hover:bg-[var(--color-teal-400)] transition-colors">
                Start free — no card
              </button>
            </Link>
            <Link href="/agent/playground" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                See it without signing up
              </button>
            </Link>
          </div>

          <div className="h-px bg-[var(--color-border-light)]" />

          {/* claim-source: every item below is a shipped route or a Free-tier line on
              /advisors/pricing (advisors-pricing.tsx:33-42), verified 2026-08-25 */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {["WhatsApp drafts", "Renewal reminders", "Cover Calculator", "Policy compare",
              "Rider directory", "Excel export", "Team seats", "Sach assistant"].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-base font-medium text-[var(--color-text-main)]">
                <Check className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <AdvisorPanel />
      </div>

      <div className="container-editorial px-6">
        <div className="h-px bg-[var(--color-border-light)] my-14 lg:my-20" />
      </div>

      {/* Band 2 — My Portfolio */}
      <div className="container-editorial px-6 grid lg:grid-cols-[1fr_minmax(0,420px)] gap-10 lg:gap-14 items-center">
        <div className="rounded-xl bg-white overflow-hidden order-2 lg:order-1" style={{ boxShadow: panelShadow }}>
          <PanelBar route="star-health-2026.pdf · page 41" />
          <div className="grid md:grid-cols-2">
            <div className="border-b md:border-b-0 md:border-r border-[var(--color-border-light)] p-4 flex flex-col gap-2.5 bg-[#FCFCFB]">
              <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">What it says</span>
              <p className="text-sm leading-relaxed text-[var(--color-border-medium)] text-justify">
                3.3 Where the Insured Person is admitted to a room the rent of which exceeds the
                eligibility specified in the Schedule, the Insured Person shall bear a rateable
                proportion of the total associated medical expenses.
              </p>
              <div className="bg-[#FFFBEB] border-l-[3px] border-[var(--color-gold-500)] rounded-r-lg px-3 py-2.5">
                <p className="text-sm leading-relaxed text-[#78350F] text-justify">
                  <strong className="font-extrabold">3.4 Co-payment.</strong> Where the age of the
                  Insured Person at commencement of the first Policy exceeds sixty (60) completed
                  years, each and every admissible claim shall be subject to a co-payment of twenty
                  per cent (20%) of the amount otherwise payable, which shall not be recoverable
                  under any cumulative bonus, restoration or top-up benefit.
                </p>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[#0F766E]">
                <ShieldCheck className="w-4 h-4 shrink-0" /> What it means
              </span>
              <p className="font-serif text-xl sm:text-2xl font-bold tracking-[-0.025em] leading-snug text-[var(--color-navy-900)]">
                After you turn 60, you pay a fifth of every hospital bill yourself.
              </p>
              <div className="flex gap-2.5">
                <div className="flex-1 rounded-xl bg-[var(--color-cream-main)] border border-[var(--color-border-light)] p-3 flex flex-col gap-0.5">
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">A ₹4 L bill</span>
                  <span className="text-lg font-extrabold tracking-tight text-[var(--color-navy-900)]">₹3,20,000</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">they pay</span>
                </div>
                <div className="flex-1 rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3 flex flex-col gap-0.5">
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-[#DC2626]">You pay</span>
                  <span className="text-lg font-extrabold tracking-tight text-[#B91C1C]">₹80,000</span>
                  <span className="text-sm text-[#991B1B]">every single time</span>
                </div>
              </div>
              <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                <AlertTriangle className="w-4 h-4 text-[var(--color-gold-500)] shrink-0 mt-0.5" />
                Your cumulative bonus does not cover it, and neither does a top-up.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 order-1 lg:order-2">
          <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-teal-600)]">
            For your own policies
          </span>
          <h3 className="font-serif font-bold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-4xl text-[var(--color-navy-900)]">
            My Portfolio
          </h3>
          <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-secondary)]">
            Open any policy and read it in your own words — what it pays, what it caps, and what it
            quietly refuses. Health, motor, term life, travel: the same treatment for all of them.
          </p>

          {/* claim-source: Free tier on /pricing (pricing.tsx:46-50), verified 2026-08-25 */}
          <ul className="flex flex-col gap-3">
            {["One policy of each type — health, term life, vehicle. Free.",
              "Room rent, co-pay, sub-limits and waiting periods, explained.",
              "Renewal reminders 30 days before expiry."].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-base leading-relaxed text-[var(--color-text-main)]">
                <Check className="w-4 h-4 text-[var(--color-teal-600)] shrink-0 mt-1" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/signup" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-[var(--color-teal-600)] text-white text-base font-semibold hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2">
                Check my policy — free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                What we check
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── HOW IT WORKS — three cards ─────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-[var(--color-cream-main)] border-t border-[var(--color-border-light)] py-14 sm:py-20 lg:py-24">
      <div className="container-editorial px-6 flex flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <span className="self-start px-2.5 py-1 rounded-md bg-[var(--color-teal-600)]/10 text-sm font-bold text-[#0F766E]">
            How it works
          </span>
          <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl lg:text-5xl text-[var(--color-navy-900)]">
            From chaos to clarity, in three steps
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-4">
            <div className="relative h-64 sm:h-72 rounded-xl bg-[var(--color-cream-dark)] overflow-hidden flex items-center justify-center">
              <span className="absolute left-7 top-8 w-10 h-10 rounded-xl bg-white/60" />
              <span className="absolute right-8 top-7 w-10 h-10 rounded-xl bg-white/50" />
              <span className="absolute left-10 bottom-10 w-10 h-10 rounded-xl bg-white/50" />
              <span className="absolute right-9 bottom-9 w-10 h-10 rounded-xl bg-white/60" />
              <div className="relative rounded-xl bg-white px-5 py-4 flex flex-col items-center gap-1" style={{ boxShadow: panelShadow }}>
                <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">One family</span>
                <span className="font-serif text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">₹1.6 Cr</span>
                <span className="text-sm text-[var(--color-text-secondary)]">5 policies · 3 insurers</span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">Bring it all in.</strong>{" "}
              Health, term life, car, two-wheeler, travel — whoever sold it, whenever it renews. One
              place instead of four apps and a drawer.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative h-64 sm:h-72 rounded-xl bg-[var(--color-cream-dark)] overflow-hidden flex items-center justify-center">
              <span className="absolute w-52 h-52 rounded-full border border-dashed border-[var(--color-border-medium)]" />
              <span className="absolute w-36 h-36 rounded-full border border-[var(--color-border-medium)]" />
              <div className="relative rounded-xl bg-white px-4 py-3.5 flex flex-col items-center gap-0.5" style={{ boxShadow: panelShadow }}>
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Checks run</span>
                <span className="font-serif text-2xl font-bold tracking-tight text-[var(--color-navy-900)]">62 pp.</span>
                <span className="text-sm font-bold text-[#0F766E]">in 41 seconds</span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">See what it actually does.</strong>{" "}
              Limits, caps, co-pays, waiting periods and the gaps between policies — pulled out of
              the wording and written in plain language, for every kind of cover.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative h-64 sm:h-72 rounded-xl bg-[var(--color-cream-dark)] overflow-hidden">
              <span className="absolute left-[62%] top-0 bottom-0 w-0.5 bg-[var(--color-teal-600)]/40" />
              <span className="absolute left-[62%] top-20 -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--color-teal-600)] border-2 border-white" />
              <div className="absolute left-5 top-24 right-14 rounded-xl bg-white p-3.5 flex flex-col gap-2" style={{ boxShadow: panelShadow }}>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-[var(--color-gold-500)]">
                  <Bell className="w-4 h-4 shrink-0" /> Renewal
                </span>
                <span className="text-sm leading-relaxed text-[var(--color-navy-900)]">
                  <strong className="font-bold">Car insurance expires in 6 days.</strong> ₹8,400 due
                  — last year you paid ₹9,100.
                </span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">Stay ahead of it.</strong>{" "}
              Reminders before a policy lapses, a straight comparison before you buy the next one,
              and a person on your side when a claim gets stuck.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PAGE ─────────────── */

export default function Home() {
  useSEO({
    title: "All Your Insurance in One Place, in Plain Language | IndSure India",
    description:
      "IndSure keeps every policy your family owns — health, term life, car, travel — in one private dashboard. See what each really covers, what it will not pay, and what renews next. Free to start, no sales calls.",
    canonical: "https://indsure.in/",
  });

  return (
    <div className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] font-sans selection:bg-[var(--color-teal-600)] selection:text-white min-h-screen flex flex-col overflow-x-hidden">
      <Header />

      <main className="flex-grow pt-32">
        <Hero />
        <ProductSection />
        <HowItWorks />

        <section className="py-16 sm:py-24 lg:py-32 bg-[var(--color-navy-900)] text-center text-white">
          <div className="container-editorial px-6">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold tracking-[-0.035em] leading-[1.08] mb-6 text-white">
              Know your coverage.<br />Once and for all.
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Free to start. Your policies stay private — no calls, no spam, ever.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="w-full sm:w-auto">
                <button className="w-full h-14 px-8 rounded-lg bg-[var(--color-teal-600)] text-white text-lg font-bold hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2">
                  Check my policy — free <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="/agent" className="w-full sm:w-auto">
                <button className="w-full h-14 px-8 rounded-lg border border-white/25 text-white/90 text-lg font-semibold hover:bg-white/10 hover:text-white transition-colors">
                  I advise clients
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
