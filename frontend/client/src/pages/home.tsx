import { Link, useLocation } from "wouter";
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { ArrowRight, Shield, CheckCircle, AlertTriangle, Lock, FileText, Server, Database, Menu, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// --- Motion Variants ---
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

// --- Components ---

const InfiniteMarquee = () => {
  return (
    <div className="relative flex overflow-hidden py-6 md:py-10 bg-[var(--color-navy-900)] border-b border-[var(--color-border-subtle)]">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-6 md:gap-12 mx-4 md:mx-6">
            <span className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white opacity-10 uppercase tracking-tighter">
              Insurance Clarity
            </span>
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[var(--color-teal-600)] opacity-20"></div>
            <span className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white opacity-10 uppercase tracking-tighter">
              Finally
            </span>
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[var(--color-teal-600)] opacity-20"></div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const CountUp = ({ target, suffix = "" }: { target: number, suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isInView, target]);

  return <span ref={ref} className="font-mono font-bold text-[var(--color-teal-600)]">{count}{suffix}</span>;
}

export default function Home() {
  return (
    <div className="bg-[var(--color-navy-900)] text-white font-sans selection:bg-[var(--color-teal-600)] selection:text-white min-h-screen flex flex-col overflow-x-hidden">

      <Header />

      <main className="flex-grow pt-36 sm:pt-40">

        {/* 1. HERO - DEEP NAVY THEME */}
        <section className="pb-12 md:pb-24 bg-[var(--color-navy-900)]">
          <div className="container-editorial mb-10 md:mb-16 px-2 sm:px-4 md:px-6">
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight leading-[1.05] mb-6 md:mb-8 text-white"
            >
              No hidden <span className="text-[var(--color-teal-400)]">clauses.</span><br />
              No surprises.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-lg sm:text-xl md:text-2xl text-[var(--color-white-muted)] max-w-2xl font-light"
            >
              IndSure analyzes your entire insurance portfolio — unbiased, calculated, and transparent.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 md:mt-10"
            >
              <Link href="/policychecker">
                <button className="w-full sm:w-auto bg-[var(--color-teal-600)] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-medium hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20">
                  Check My Coverage <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </Link>
              <a href="#demo" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-medium border border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] transition-colors text-[var(--color-white-muted)] hover:text-white">
                  See Example Report
                </button>
              </a>
            </motion.div>
          </div>

          <InfiniteMarquee />
        </section>

        {/* 2. DASHBOARD PREVIEW ("Matrix" Reborn) - CREAM SECTION for Contrast */}
        <section id="demo" className="py-12 md:py-24 bg-[var(--color-cream-main)] text-[var(--color-text-main)] border-y border-[var(--color-border-light)]">
          <div className="container-editorial">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 md:mb-16 gap-6 md:gap-8">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3 md:mb-4 text-[var(--color-navy-900)]">Forensic Analysis</h2>
                <p className="text-[var(--color-text-secondary)] text-base sm:text-lg max-w-xl">
                  We decode the fine print. See exactly where you stand with a
                  bank-grade audit of your coverage.
                </p>
              </div>
            </div>

            {/* DASHBOARD CARD - Uses White on Cream */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8 }}
              className="bg-white rounded-xl md:rounded-2xl border border-[var(--color-border-light)] p-5 sm:p-6 md:p-8 lg:p-12 shadow-2xl shadow-[rgba(0,0,0,0.05)] border-t-4 border-t-[var(--color-teal-600)]"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">

                {/* Score Panel */}
                <div className="col-span-1 md:border-r md:border-[var(--color-border-light)] md:pr-8 pb-6 md:pb-0 mb-6 md:mb-0 border-b border-[var(--color-border-light)] md:border-b-0">
                  <span className="text-xs sm:text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Insurance Health Score</span>
                  <div className="text-6xl sm:text-7xl md:text-8xl font-serif font-bold text-[var(--color-teal-600)] mt-3 md:mt-4 mb-2">
                    <CountUp target={68} />
                  </div>
                  <p className="text-sm text-[var(--color-teal-600)] font-medium">Top 15% of policyholders</p>

                  <div className="mt-6 md:mt-8 space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Critical Gaps</span>
                      <span className="font-bold text-red-500">3 Found</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Redundancies</span>
                      <span className="font-bold text-[var(--color-gold-500)]">2 Found</span>
                    </div>
                  </div>
                </div>

                {/* Bars / Details */}
                <div className="col-span-2 space-y-6 md:space-y-8">
                  <h3 className="text-xl sm:text-2xl font-serif font-bold mb-4 md:mb-6 text-[var(--color-navy-900)]">Coverage Breakdown</h3>

                  {[
                    { label: "Room Rent Capping", val: 100, status: "Fully Covered", color: "bg-[var(--color-teal-600)]" },
                    { label: "Waiting Period Risk", val: 30, status: "3 Years Remaining (High Risk)", color: "bg-red-400" },
                    { label: "Maternity Coverage", val: 0, status: "Not Covered", color: "bg-[var(--color-border-medium)]" }
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-2 text-sm font-medium">
                        <span className="text-[var(--color-navy-900)]">{item.label}</span>
                        <span className="text-[var(--color-text-muted)] text-xs sm:text-sm">{item.status}</span>
                      </div>
                      <div className="h-3 bg-[var(--color-cream-dark)] rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${item.color}`}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.val}%` }}
                          transition={{ duration: 1, delay: 0.2 * i }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="bg-[var(--color-cream-main)] p-3 sm:p-4 rounded-lg border border-[var(--color-border-light)] mt-6 md:mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-shrink-0 p-2 bg-[var(--color-teal-600)]/10 rounded-full text-[var(--color-teal-600)] w-fit">
                      <Shield className="w-5 h-5" />
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                      <strong>Recommendation:</strong> Consider porting to a policy with zero room-rent capping to avoid proportionate deduction.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 3. PROBLEM CARDS - Navy Background again for rhythm */}
        <section className="py-12 md:py-24 bg-[var(--color-navy-900)] text-white">
          <div className="container-editorial">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-10 md:mb-16 text-center text-white px-2">Why traditional policies fail you</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { title: "Complex by Design", desc: "Policies are intentionally vague to limit claims." },
                { title: "Silent Gaps", desc: "Critical exclusions often go unnoticed until admission." },
                { title: "Costly Overlaps", desc: "You might be paying for duplicate coverage." },
                { title: "Biased Advice", desc: "Agents are incentivized to sell, not to analyze." }
              ].map((card, i) => (
                <motion.div
                  key={i}
                  className="bg-[var(--color-blue-800)] border border-[var(--color-border-subtle)] p-5 sm:p-6 md:p-8 rounded-xl group cursor-default hover:bg-[var(--color-teal-600)] transition-colors duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-12 h-12 bg-[var(--color-navy-900)] rounded-md flex items-center justify-center mb-6 text-[var(--color-teal-400)] group-hover:bg-white group-hover:text-[var(--color-teal-600)] transition-colors duration-300">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-white">{card.title}</h3>
                  <p className="text-[var(--color-white-muted)] text-sm leading-relaxed group-hover:text-white/90">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. PROCESS / TIMELINE - Cream Section */}
        <section className="py-16 md:py-32 bg-[var(--color-cream-main)] text-[var(--color-text-main)] border-t border-[var(--color-border-light)] overflow-hidden">
          <div className="container-editorial">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-20 gap-4 scroll-mt-20">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[var(--color-navy-900)]">From chaos to clarity<br />in 4 steps.</h2>
              <Link href="/policychecker">
                <span className="text-[var(--color-teal-600)] font-medium hover:underline cursor-pointer whitespace-nowrap">Start your audit &rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-8 left-0 w-full h-[2px] bg-[var(--color-border-light)] -z-0">
                <motion.div
                  className="h-full bg-[var(--color-teal-600)]"
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
              </div>

              {[
                { step: "01", title: "Upload", desc: "Upload your policy PDF securely." },
                { step: "02", title: "Decipher", desc: "AI extracts hidden clauses." },
                { step: "03", title: "Audit", desc: "50+ risks checked instantly." },
                { step: "04", title: "Report", desc: "Get your coverage score." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-white p-5 sm:p-6 rounded-xl border border-[var(--color-border-light)] relative z-10 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 * i }}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[var(--color-cream-main)] border border-[var(--color-border-light)] rounded-full flex items-center justify-center text-lg sm:text-xl font-bold font-serif mb-4 sm:mb-6 text-[var(--color-teal-600)] shadow-sm">
                    {item.step}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 text-[var(--color-navy-900)]">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. CTA - Navy */}
        <section className="py-16 md:py-32 bg-[var(--color-navy-900)] text-center text-white">
          <div className="container-editorial px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-serif font-bold mb-6 md:mb-8 text-white">Know your coverage.<br />Once and for all.</h2>
            <p className="text-base sm:text-lg md:text-xl text-white/80 mb-8 md:mb-12">No calls. No spam. Just data.</p>
            <Link href="/policychecker">
              <button className="w-full sm:w-auto bg-[var(--color-teal-600)] text-white px-8 sm:px-12 py-4 sm:py-5 rounded-lg font-bold text-lg sm:text-xl hover:scale-105 active:scale-[0.98] transition-transform shadow-xl shadow-teal-900/20">
                Check My Coverage
              </button>
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
