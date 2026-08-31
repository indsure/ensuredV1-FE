import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
  type?: 'info' | 'success' | 'warning';
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead
}: NotificationDropdownProps) {
  if (!isOpen) return null;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      onMarkRead(notif.id);
    }
    if (notif.link) {
      window.location.href = notif.link;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="absolute top-16 right-0 w-[360px] z-[100] mt-2 mr-4">
        {/* Backdrop for mobile (optional, but requested panel only) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[500px]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="font-semibold text-[#0F172A] font-['Inter']">Notifications</h3>
            {notifications.some(n => !n.is_read) && (
              <button 
                onClick={onMarkAllRead}
                className="text-xs font-bold text-[#0D9488] hover:text-[#0f766e] transition-colors"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-[100px] max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                  <Bell size={24} />
                </div>
                <p className="text-slate-500 text-sm font-medium">No notifications yet</p>
                <p className="text-slate-400 text-xs mt-1">We'll notify you when your analyses are done.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`px-5 py-4 flex gap-4 cursor-pointer transition-colors hover:bg-slate-50 relative ${
                      !notif.is_read ? 'bg-[#F0F9FF]' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      !notif.is_read 
                        ? (notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#0D9488]/10 text-[#0D9488]')
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {notif.type === 'success' ? <Check size={18} /> : 
                       notif.type === 'warning' ? <AlertTriangle size={18} /> :
                       <Bell size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.is_read ? 'text-[#334155] font-semibold' : 'text-[#64748B]'}`}>
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#64748B]">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-sm" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-xs font-bold text-slate-500 hover:text-[#0D9488] transition-colors">
                View all notifications
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
