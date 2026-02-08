import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { Target, Users, Zap, Shield, Eye, Lock, ArrowRight, Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// --- Components ---

const InfiniteMarquee = () => {
  return (
    <div className="relative flex overflow-hidden py-8 bg-[var(--color-cream-main)] border-y border-[var(--color-border-light)]">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-12 mx-6">
            <span className="text-6xl font-serif font-bold text-[var(--color-text-main)] opacity-5 uppercase tracking-tighter">
              Mission
            </span>
            <div className="w-3 h-3 rounded-full bg-[var(--color-green-primary)] opacity-20"></div>
            <span className="text-6xl font-serif font-bold text-[var(--color-text-main)] opacity-5 uppercase tracking-tighter">
              Vision
            </span>
            <div className="w-3 h-3 rounded-full bg-[var(--color-green-primary)] opacity-20"></div>
            <span className="text-6xl font-serif font-bold text-[var(--color-text-main)] opacity-5 uppercase tracking-tighter">
              Transparency
            </span>
            <div className="w-3 h-3 rounded-full bg-[var(--color-green-primary)] opacity-20"></div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default function Mission() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <div className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] font-sans selection:bg-[var(--color-green-secondary)] selection:text-[var(--color-white)] min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-32">

        {/* 1. HERO - WHY INDSURE */}
        <section className="pb-20 container-editorial text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-serif font-bold mb-8 text-[var(--color-text-main)]">
              Why IndSure?
            </h1>
            <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto font-light leading-relaxed">
              Insurance was designed to protect you. <br />
              Somewhere along the way, it became about <span className="font-serif italic text-[var(--color-green-primary)]">confusing</span> you.
            </p>
          </motion.div>
        </section>

        <InfiniteMarquee />

        {/* 2. THE MISSION */}
        <section className="py-32 bg-[var(--color-white)] border-b border-[var(--color-border-light)]">
          <div className="container-editorial grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">Our Mission</h2>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-6">
                To make insurance <strong className="text-[var(--color-text-main)]">actually understandable</strong> for everyone.
              </p>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
                We believe you shouldn't need a law degree to know if your surgery is covered. IndSure strips away the jargon, the hidden clauses, and the sales pitches to give you the raw truth about your financial safety net.
              </p>

              <div className="mt-10 flex gap-4">
                <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--color-green-primary)]">
                  <Target className="w-5 h-5" /> Precision
                </div>
                <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-[var(--color-green-primary)]">
                  <Lock className="w-5 h-5" /> Privacy
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative h-[400px] bg-[var(--color-cream-main)] rounded-2xl border border-[var(--color-border-light)] overflow-hidden shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ y }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <span className="text-9xl font-serif font-bold text-[var(--color-green-primary)]">?</span>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <Users className="w-16 h-16 text-[var(--color-green-primary)] mb-6" />
                <h3 className="text-3xl font-serif font-bold mb-2">10,000+</h3>
                <p className="text-[var(--color-text-secondary)]">Policies Decoded</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 3. CORE VALUES (White Cards) */}
        <section className="py-32 bg-[var(--color-cream-main)]">
          <div className="container-editorial">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-16 text-center">Core Values</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Heart, title: "You First", desc: "No commissions. No upselling. Our only loyalty is to the policyholder." },
                { icon: Lock, title: "Zero Data Stored", desc: "Your PDF is processed in RAM and deleted instantly. We don't want your data." },
                { icon: Zap, title: "Just Facts", desc: "We don't give advice. We give analysis. The decision is always yours." },
                { icon: Eye, title: "Crystal Clear", desc: "If a 10-year-old can't understand it, we rewrite it until they can." }
              ].map((card, i) => (
                <motion.div
                  key={i}
                  className="card-white group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-12 h-12 bg-[var(--color-cream-main)] rounded-md flex items-center justify-center mb-6 group-hover:bg-[var(--color-green-primary)] group-hover:text-white transition-colors duration-300 border border-[var(--color-border-light)] shadow-sm">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif">{card.title}</h3>
                  <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. VISION */}
        <section className="py-32 bg-[var(--color-green-primary)] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

          <div className="container-editorial relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-serif font-bold mb-8">The Vision</h2>
              <p className="text-xl md:text-2xl opacity-90 max-w-4xl mx-auto font-light leading-relaxed mb-12">
                We envision a future where insurance is as transparent as a bank statement. <br />
                No "gotcha" clauses, no denied claims due to fine print.
              </p>
              <Link href="/policychecker">
                <button className="bg-white text-[var(--color-green-primary)] px-10 py-4 rounded-lg font-bold text-lg hover:bg-[var(--color-cream-100)] transition-colors shadow-xl">
                  Join the Movement
                </button>
              </Link>
            </motion.div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
