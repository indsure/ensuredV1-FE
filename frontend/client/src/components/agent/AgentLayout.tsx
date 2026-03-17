import { useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  Settings,
  Bell,
  Menu,
  X,
  Plus,
  Share2,
  Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import UploadModal from './UploadModal';
import NotificationDropdown from './NotificationDropdown';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../ui/toaster';
import { apiFetch } from '@/lib/api';

interface AgentLayoutProps {
  children: ReactNode;
}

export default function AgentLayout({ children }: AgentLayoutProps) {
  const [agentName, setAgentName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();
  const [location] = useLocation();

  const fetchNotifications = async (id: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.is_read).length || 0);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('agent_id', userId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    let channel: any;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);

        const meRes = await apiFetch('/api/agent/me', { headers: { 'x-user-id': user.id } });
        if (meRes.ok) {
          const agentData = await meRes.json();
          if (agentData?.full_name) setAgentName(agentData.full_name);
        }

        fetchNotifications(user.id);

        channel = supabase
          .channel('notification_changes')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `agent_id=eq.${user.id}` },
            (payload) => {
              const newNotif = payload.new;
              toast({
                title: "Analysis Update",
                description: newNotif.message,
                duration: 5000,
                // @ts-ignore
                onClick: () => { if (newNotif.link) window.location.href = newNotif.link; }
              });
              setNotifications(prev => [newNotif, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          )
          .subscribe();
      }
    }

    initialize();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const navLinks = [
    { name: 'Dashboard', path: '/agent/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Policies', path: '/agent/policies', icon: <FileText size={20} /> },
    { name: 'Uploads', path: '/agent/uploads', icon: <UploadCloud size={20} /> },
    { name: 'Reports', path: '/agent/reports', icon: <Share2 size={20} /> },
    { name: 'Settings', path: '/agent/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex text-slate-800 font-['Inter']">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <div
        className={`fixed md:static inset-y-0 left-0 z-50 w-[240px] bg-[#1E293B] shadow-xl md:shadow-none transform transition-transform duration-300 ease-in-out flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <Link to="/agent" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0D9488] text-white flex items-center justify-center rounded-sm font-['Playfair_Display'] font-bold text-xl">
              I
            </div>
            <span className="font-['Playfair_Display'] text-2xl font-bold tracking-tight text-white">
              IndSure.
            </span>
          </Link>
          <button
            className="ml-auto md:hidden text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = location === link.path || (link.path === '/agent' && location === '/agent/dashboard');
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0D9488]/10 text-white border-l-4 border-[#0D9488]'
                    : 'text-[#CBD5E1] hover:bg-slate-800 hover:text-white border-l-4 border-transparent'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-white uppercase shrink-0">
              {agentName ? agentName.substring(0, 2) : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {agentName || 'Agent'}
              </p>
              <p className="text-xs text-[#CBD5E1] truncate">Advisor Profile</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-[64px] shrink-0 bg-[#0B1120] flex items-center justify-between px-6 shadow-md z-10 w-full relative">
          <div className="flex items-center gap-4 flex-1">
            <button
              className="md:hidden text-slate-300 hover:text-white transition-colors shrink-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>

            <div className="max-w-md w-full ml-2 relative hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full bg-[#1E293B] border border-slate-700 text-sm text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] placeholder:text-slate-500 transition-all"
                  placeholder="Search policies or clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 shrink-0 ml-4">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-lg shadow-[0_4px_14px_0_rgba(13,148,136,0.39)] transition-all hover:-translate-y-0.5"
            >
              <Plus size={18} />
              New Upload
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative text-slate-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 ${isNotificationOpen ? 'text-white bg-white/5' : ''}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#ef4444] rounded-full border-2 border-[#0B1120] flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onMarkRead={markAsRead}
                onMarkAllRead={markAllRead}
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] flex items-center justify-center text-xs font-semibold text-white uppercase shadow-sm cursor-pointer border border-[#0f766e]">
              {agentName ? agentName.substring(0, 2) : 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#FAFAF8] p-4 md:p-6 lg:p-8 w-full">
          {children}
        </main>
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        agentId={userId || ''}
      />
      <Toaster />
    </div>
  );
}
