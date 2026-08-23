import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Key, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  Bell,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminOverview from '../../components/admin/AdminOverview';
import AdminAgents from '../../components/admin/AdminAgents';
import AdminInviteCodes from '../../components/admin/AdminInviteCodes';
import AdminLeads from '../../components/admin/AdminLeads';
import { apiFetch } from '@/lib/api';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'codes' | 'leads'>('overview');
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/agent/login';
      return;
    }

    // Use backend API to fetch agent profile (bypasses RLS)
    const res = await apiFetch('/api/agent/me', {
      headers: { 'x-user-id': user.id }
    });

    if (!res.ok) {
      window.location.href = '/agent/login';
      return;
    }

    const agent = await res.json();
    if (!agent?.is_admin) {
      window.location.href = '/agent/login';
      return;
    }

    setAdminName(agent.full_name);
    setLoading(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'codes', label: 'Invite Codes', icon: Key },
    { id: 'leads', label: 'Leads', icon: Users },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D9488]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-[#1E293B] flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-8">
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-white tracking-tight">
            IndSure <span className="text-[#2DD4BF] text-sm align-top leading-none">Admin</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-[#2DD4BF]/10 text-[#2DD4BF] border-l-4 border-[#2DD4BF]' 
                  : 'text-[#CBD5E1] hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/agent/login')}
            className="w-full flex items-center gap-3 px-4 py-3 text-[#CBD5E1] hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-[#0B1120] border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4 text-white">
            <button 
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="font-['Playfair_Display'] text-xl font-bold">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <button className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-slate-400 hover:text-white transition-colors">
              <Search size={16} />
              <span className="text-sm">Search records...</span>
            </button>
            
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0B1120]"></span>
              </button>
              
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2DD4BF] to-[#0D9488] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-teal-500/20">
                  {adminName.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-white leading-none">{adminName}</p>
                  <p className="text-[11px] sm:text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Super Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && <AdminOverview />}
              {activeTab === 'agents' && <AdminAgents />}
              {activeTab === 'codes' && <AdminInviteCodes />}
              {activeTab === 'leads' && <AdminLeads />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#1E293B] z-[70] lg:hidden p-6"
            >
              <div className="flex justify-between items-center mb-8">
                <h1 className="font-['Playfair_Display'] text-xl font-bold text-white">IndSure</h1>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 p-1">
                  <X size={24} />
                </button>
              </div>
              
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-[#2DD4BF]/10 text-[#2DD4BF]' 
                        : 'text-[#CBD5E1]'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
