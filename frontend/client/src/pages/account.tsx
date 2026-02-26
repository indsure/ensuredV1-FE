import { Link, useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowLeft,
  Shield,
  LogOut,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
// ARCHIVED: import { useAuth } from "@/hooks/use-auth";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export default function Account() {
  const { user, isLoading, logout } = { user: null as any, isLoading: false, logout: async () => { } }; // ARCHIVED: const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true });

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    setLocation("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--color-cream-main)] min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-muted)] font-sans">Loading…</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : "—";

  return (
    <div className="bg-[var(--color-navy-900)] text-white font-sans min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-24">
        {/* Hero */}
        <section className="pb-16">
          <div className="container-editorial px-6">
            <Link href="/">
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-white-muted)] hover:text-white transition-colors cursor-pointer mb-6">
                <ArrowLeft className="w-4 h-4" /> Back
              </span>
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-4 text-white"
            >
              Your <span className="text-[var(--color-teal-400)]">profile.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-lg text-[var(--color-white-muted)]"
            >
              Welcome back, <span className="font-medium text-white">{user?.username}</span>
            </motion.p>
          </div>
        </section>

        {/* Content — Cream */}
        <section
          ref={sectionRef}
          className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] py-16 border-t border-[var(--color-border-light)]"
        >
          <div className="container-editorial px-6">
            <div className="max-w-2xl mx-auto space-y-8">

              {/* Account Details Card */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                className="bg-white rounded-2xl border border-[var(--color-border-light)] p-8 shadow-2xl shadow-[rgba(0,0,0,0.05)] border-t-4 border-t-[var(--color-teal-600)]"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-[var(--color-navy-900)] rounded-md flex items-center justify-center text-[var(--color-teal-400)]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-navy-900)]">Account Details</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">Your profile information</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Username</span>
                    <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1">{user?.username}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Role</span>
                    <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1 capitalize">{user?.role}</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                  <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Member Since</span>
                  <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1">{memberSince}</div>
                </div>
              </motion.div>

              {/* Analysis History Card */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-[var(--color-border-light)] p-8 shadow-lg shadow-[rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-[var(--color-cream-main)] border border-[var(--color-border-light)] rounded-md flex items-center justify-center text-[var(--color-teal-600)]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-navy-900)]">Analysis History</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">Your past policy analyses</p>
                  </div>
                </div>

                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-[var(--color-cream-main)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--color-border-light)]">
                    <FileText className="w-7 h-7 text-[var(--color-text-muted)] opacity-50" />
                  </div>
                  <p className="font-serif font-bold text-lg text-[var(--color-navy-900)]">Coming Soon</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-xs mx-auto">
                    Your analysis history will appear here once connected.
                  </p>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-between items-center"
              >
                <Link href="/policychecker">
                  <button className="bg-[var(--color-teal-600)] text-white px-8 py-4 rounded-lg font-medium hover:bg-[var(--color-teal-400)] transition-colors flex items-center gap-2 shadow-lg shadow-teal-900/20">
                    Analyze a Policy <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-8 py-4 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
