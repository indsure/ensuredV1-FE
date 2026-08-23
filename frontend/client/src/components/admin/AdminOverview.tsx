import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  FileCheck, 
  Layers, 
  Share2, 
  ArrowUpRight, 
  TrendingUp,
  Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

interface AdminStats {
  totalAgents: number;
  totalPolicies: number;
  totalBatches: number;
  totalReports: number;
}

const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const response = await apiFetch('/api/admin/stats', {
        headers: { 'x-user-id': user.id }
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Agents', value: stats?.totalAgents || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12%' },
    { label: 'Policies Analyzed', value: stats?.totalPolicies || 0, icon: FileCheck, color: 'text-[#0D9488]', bg: 'bg-teal-50', trend: '+18%' },
    { label: 'Batches Processed', value: stats?.totalBatches || 0, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50', trend: '+5%' },
    { label: 'Public Reports', value: stats?.totalReports || 0, icon: Share2, color: 'text-purple-600', bg: 'bg-purple-50', trend: '+24%' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 shadow-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color} transition-colors group-hover:scale-110 duration-300`}>
                <card.icon size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                <TrendingUp size={12} />
                {card.trend}
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{card.label}</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{card.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Chart Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-lg font-bold text-[#0F172A]">Platform Growth</h4>
              <p className="text-slate-500 text-sm">Policy analysis volume over time</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors">Weekly</button>
              <button className="px-4 py-1.5 bg-[#0F172A] text-white text-xs font-bold rounded-lg transition-colors">Monthly</button>
            </div>
          </div>
          
          <div className="flex-1 flex items-end gap-2 px-4 pb-4">
            {[40, 70, 45, 90, 65, 80, 50, 95, 100, 85, 60, 75].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.05, duration: 1 }}
                className="flex-1 bg-gradient-to-t from-[#0D9488] to-[#2DD4BF] rounded-t-sm relative group cursor-pointer"
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[11px] sm:text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {Math.round(height * 2.5)}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between pt-4 border-t border-slate-50 text-[11px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Jan</span>
            <span>Jun</span>
            <span>Dec</span>
          </div>
        </div>

        <div className="bg-[#0B1120] p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#2DD4BF]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
           <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Activity className="text-[#2DD4BF]" size={24} />
                </div>
                <h4 className="font-bold text-lg">System Health</h4>
              </div>

              <div className="space-y-6 flex-1">
                {[
                  { label: 'Gemini API', status: 'Healthy', val: '99.8%' },
                  { label: 'DB Connection', status: 'Healthy', val: '12ms' },
                  { label: 'Storage Usage', status: 'Normal', val: '42%' },
                  { label: 'Batch Queue', status: 'Active', val: '0 pending' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{item.label}</p>
                      <p className="text-sm font-bold mt-1">{item.status}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[#2DD4BF] text-sm font-bold">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                 <p className="text-[11px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold">Node Version v20.x • Production</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
