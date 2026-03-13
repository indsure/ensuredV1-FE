import React from 'react';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { Header } from '@/components/Header';
import { useLocation } from 'wouter';

const CompareMaintenance: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-6">
        {/* @ts-ignore */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-[480px] w-full text-center"
        >
          {/* Pulsating Icon */}
          <div className="relative inline-block mb-10">
            {/* @ts-ignore */}
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="p-8 bg-[#0D9488]/10 rounded-full"
            >
              <Wrench size={64} className="text-[#0D9488]" />
            </motion.div>
            {/* @ts-ignore */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute inset-0 bg-[#0D9488] rounded-full -z-10"
            />
          </div>

          {/* Text Content */}
          <h2 className="font-['Playfair_Display'] text-4xl font-bold text-[#0F172A] mb-4">
            We're upgrading this.
          </h2>
          <p className="font-['Inter'] text-slate-500 text-lg mb-12 leading-relaxed">
            Our comparison engine is getting smarter. We'll be back soon with something much better.
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-4">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold rounded-2xl shadow-xl shadow-teal-900/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              ← Back to Home
            </button>
            <button
              onClick={() => setLocation('/compare/sample')}
              className="w-full py-4 border-2 border-[#0D9488] text-[#0D9488] font-bold rounded-2xl hover:bg-teal-50 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              👀 See a Sample Comparison
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CompareMaintenance;
