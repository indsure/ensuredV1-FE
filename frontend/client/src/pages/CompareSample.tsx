import { motion } from 'framer-motion';
import { CheckCircle2, TrendingUp, Star } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } }
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};

interface Row {
  param: string;
  nivaVal: string;
  starVal: string;
  winner: 'niva' | 'star' | 'tie';
}

const rows: Row[] = [
  { param: 'Room Rent',                 nivaVal: 'No limit',             starVal: 'Single Private A/C Room',  winner: 'niva' },
  { param: 'ICU Charges',               nivaVal: 'No limit',             starVal: 'No limit',                 winner: 'tie' },
  { param: 'Co-payment',                nivaVal: 'Nil',                  starVal: 'Nil',                      winner: 'tie' },
  { param: 'Restoration',               nivaVal: '100%, unlimited times', starVal: '100%, once per year',     winner: 'niva' },
  { param: 'Pre-existing Waiting',      nivaVal: '36 months',            starVal: '48 months',                winner: 'niva' },
  { param: 'Specific Disease Waiting',  nivaVal: '24 months',            starVal: '24 months',                winner: 'tie' },
  { param: 'Maternity Cover',           nivaVal: 'Not covered',          starVal: 'Available as add-on',      winner: 'star' },
  { param: 'OPD Cover',                 nivaVal: 'Not covered',          starVal: 'Not covered',              winner: 'tie' },
  { param: 'Annual Health Checkup',     nivaVal: 'Covered',              starVal: 'Covered',                  winner: 'tie' },
  { param: 'No Claim Bonus',            nivaVal: 'Up to 100%',           starVal: 'Up to 100%',               winner: 'tie' },
  { param: 'Domiciliary',               nivaVal: 'Covered',              starVal: 'Covered',                  winner: 'tie' },
  { param: 'Ayush Treatment',           nivaVal: 'Covered',              starVal: 'Covered',                  winner: 'tie' },
  { param: 'Approx Annual Premium',     nivaVal: '₹12,500',              starVal: '₹14,200',                  winner: 'niva' },
];

function ScoreBadge({ score, color }: { score: number; color: 'teal' | 'amber' }) {
  const ring = color === 'teal' ? 'border-[#0D9488] text-[#0D9488]' : 'border-amber-500 text-amber-600';
  return (
    <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg ${ring}`}>
      {score}
    </div>
  );
}

export default function CompareSample() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] font-['Inter']">
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-36 pb-12 sm:pb-16 lg:pb-20">

        {/* ── Hero ── */}
        <motion.div className="text-center mb-14" variants={container} initial="hidden" animate="show">
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D9488] mb-3">Sample Comparison</motion.p>
          {/* @ts-ignore */}
          <motion.h1 variants={fadeUp} className="font-['Playfair_Display'] text-4xl sm:text-5xl font-bold text-[#0F172A] leading-tight mb-4">
            Side-by-Side Policy Comparison
          </motion.h1>
          {/* @ts-ignore */}
          <motion.p variants={fadeUp} className="text-[#64748B] text-lg max-w-2xl mx-auto">
            An unbiased breakdown of two of India's most popular health plans
          </motion.p>
        </motion.div>

        {/* ── Policy Header Cards ── */}
        {/* @ts-ignore */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          {[
            { label: 'Policy A', name: 'Niva Bupa ReAssure 2.0', sum: '₹10L Sum Insured', score: 84, color: 'teal' as const },
            { label: 'Policy B', name: 'Star Health Comprehensive', sum: '₹10L Sum Insured', score: 71, color: 'amber' as const },
          ].map(p => (
            // @ts-ignore
            <motion.div key={p.name} variants={fadeUp} className="bg-white rounded-2xl shadow-[0_1px_12px_rgba(0,0,0,0.08)] border border-slate-100 p-6 flex items-center gap-5">
              <ScoreBadge score={p.score} color={p.color} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">{p.label}</p>
                <p className="font-['Playfair_Display'] text-xl font-bold text-[#0F172A] leading-tight">{p.name}</p>
                <p className="text-sm text-slate-500 mt-1">{p.sum}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Comparison Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-[0_1px_12px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden mb-10"
        >
          {/* Sticky header */}
          <div className="hidden md:grid grid-cols-3 sticky top-0 bg-[#0B1120] text-white z-10">
            <div className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Parameter</div>
            <div className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">Niva Bupa ReAssure 2.0</div>
            <div className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-amber-400">Star Health Comprehensive</div>
          </div>

          {rows.map((row, i) => (
            <div key={row.param} className={`grid grid-cols-1 md:grid-cols-3 border-b border-slate-100 md:border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
              <div className="px-4 md:px-6 pt-4 pb-2 md:py-4 text-sm font-semibold text-[#0F172A]">{row.param}</div>
              <div className={`px-4 md:px-6 py-2 md:py-4 text-sm flex flex-wrap items-center gap-x-2 gap-y-1 ${row.winner === 'niva' ? 'bg-[#F0FDFA] text-[#0D9488] font-semibold' : 'text-slate-600'}`}>
                <span className="md:hidden w-full text-[11px] font-bold uppercase tracking-widest text-slate-400">Niva Bupa ReAssure 2.0</span>
                {row.nivaVal}
                {row.winner === 'niva' && (
                  <span className="text-[11px] sm:text-[10px] font-bold bg-[#0D9488] text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Better</span>
                )}
              </div>
              <div className={`px-4 md:px-6 py-2 pb-4 md:py-4 text-sm flex flex-wrap items-center gap-x-2 gap-y-1 ${row.winner === 'star' ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-600'}`}>
                <span className="md:hidden w-full text-[11px] font-bold uppercase tracking-widest text-slate-400">Star Health Comprehensive</span>
                {row.starVal}
                {row.winner === 'star' && (
                  <span className="text-[11px] sm:text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Better</span>
                )}
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Score Bars ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_12px_rgba(0,0,0,0.08)] p-8 mb-10"
        >
          <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#0F172A] mb-6">Overall Score</h2>
          <div className="space-y-5">
            {[
              { name: 'Niva Bupa ReAssure 2.0', score: 84, color: 'bg-[#0D9488]', textColor: 'text-[#0D9488]' },
              { name: 'Star Health Comprehensive', score: 71, color: 'bg-amber-400', textColor: 'text-amber-600' },
            ].map(p => (
              <div key={p.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-[#0F172A]">{p.name}</span>
                  <span className={`text-sm font-bold ${p.textColor}`}>{p.score}/100</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.score}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    className={`${p.color} h-3 rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Verdict Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.5 }}
          className="bg-[#0B1120] rounded-2xl p-8 text-white"
        >
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#0D9488] mb-2">Analysis Complete</p>
          <h2 className="font-['Playfair_Display'] text-3xl font-bold text-white mb-1">Our Verdict</h2>
          <p className="text-slate-400 text-sm mb-4">Based on coverage depth, value, and flexibility</p>

          <p className="font-['Playfair_Display'] text-3xl sm:text-4xl font-bold text-[#2DD4BF] mb-6">
            Niva Bupa ReAssure 2.0
          </p>

          <div className="space-y-3 mb-8">
            {[
              'No room rent capping — full reimbursement on any hospital room',
              'Unlimited restoration — multiple claims in the same year covered',
              'Lower annual premium by ₹1,700 for equivalent coverage',
            ].map(r => (
              <div key={r} className="flex items-start gap-3">
                <CheckCircle2 className="text-[#0D9488] shrink-0 mt-0.5" size={18} />
                <p className="text-slate-300 text-sm">{r}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#1E293B] border border-amber-900/40 rounded-xl p-4 mb-8 flex items-start gap-3">
            <Star size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm font-medium">
              Star Health is the better pick if maternity cover is a priority for your family
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.location.href = '/policychecker'}
              className="flex-1 py-3 px-6 rounded-xl border-2 border-[#0D9488] text-[#0D9488] font-semibold text-sm hover:bg-[#0D9488] hover:text-white transition-all"
            >
              Analyze Your Own Policy →
            </button>
            <button
              onClick={() => window.location.href = '/compare'}
              className="flex-1 py-3 px-6 rounded-xl border-2 border-slate-500 text-slate-300 font-semibold text-sm hover:border-[#0D9488] hover:text-[#0D9488] transition-all"
            >
              Compare Your Policies →
            </button>
          </div>
        </motion.div>

      </div>

      <Footer />
    </div>
  );
}
