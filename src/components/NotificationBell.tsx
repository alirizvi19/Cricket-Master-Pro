// src/components/NotificationBell.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/src/lib/hooks';
import { useNotifications, Notification } from '@/src/lib/notifications';
import { Bell, BellOff, Check, Trash2, X, ExternalLink, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications(user?.uid);

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);

    // Navigate to appropriate page
    if (notification.matchId) {
      // If live match, go to scoring or match details
      if (notification.type === 'match_start') {
        navigate(`/scoring/${notification.matchId}`);
      } else {
        navigate(`/tournament/${notification.tournamentId}?liveMatchId=${notification.matchId}`);
      }
    } else if (notification.tournamentId) {
      if (notification.type === 'team_invite' && notification.teamId) {
        navigate(`/tournament/${notification.tournamentId}?joinTeam=${notification.teamId}`);
      } else {
        navigate(`/tournament/${notification.tournamentId}`);
      }
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button Icon */}
      <button
        id="notification-bell-btn"
        className={`p-2 rounded-xl transition-all relative ${
          isOpen 
            ? 'bg-brand/10 text-brand border border-brand/20' 
            : 'text-text-dim hover:text-white bg-white/5 hover:bg-white/10 border border-transparent'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
          </span>
        )}
      </button>

      {/* Dropdown Panel Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="notification-dropdown"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[480px] bg-bg-secondary border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-sm:fixed max-sm:inset-x-4 max-sm:top-20 max-sm:bottom-auto max-sm:w-auto max-sm:max-w-md max-sm:mx-auto max-sm:max-h-[70vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-white uppercase tracking-wider">Alerts Hub</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-brand/10 border border-brand/20 text-[9px] sm:text-[10px] font-mono font-bold text-brand">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand hover:text-white transition-colors"
                  >
                    Read All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 sm:p-1 rounded text-text-dim hover:text-white hover:bg-white/5 transition-colors bg-white/5 sm:bg-transparent"
                >
                  <X size={14} className="sm:size-[14px]" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[350px] custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-text-dim mb-3">
                    <BellOff size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1">Silence is Golden</h4>
                  <p className="text-[10px] text-text-dim max-w-[200px]">You have no active matches or alerts. Scheduled tournament alerts will appear here.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors relative flex gap-3 group border-l-2 ${
                      notification.read 
                        ? 'bg-transparent border-transparent text-text-dim' 
                        : 'bg-brand/[0.02] border-brand text-white'
                    }`}
                  >
                    {/* Icon container */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        notification.type === 'match_start' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                          : 'bg-brand/10 text-brand border border-brand/10'
                      }`}>
                        {notification.type === 'match_start' ? (
                          <Activity size={14} className="animate-pulse" />
                        ) : (
                          <Bell size={14} />
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4 sm:pr-4 pr-12">
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className="text-left block w-full outline-none focus:underline"
                      >
                        <h4 className={`text-[11px] font-black uppercase tracking-wider mb-0.5 flex items-center gap-1 leading-none ${
                          notification.read ? 'text-text-dim' : 'text-white'
                        }`}>
                          {notification.title}
                          {!notification.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand"></span>}
                        </h4>
                        <p className={`text-xs leading-relaxed mb-1 ${
                          notification.read ? 'text-text-dim' : 'text-slate-300'
                        }`}>
                          {notification.message}
                        </p>
                      </button>
                      
                      <div className="flex items-center gap-2 text-[9px] font-mono text-text-dim">
                        <span>{new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <button 
                          onClick={() => handleNotificationClick(notification)} 
                          className="hover:text-brand flex items-center gap-0.5 transition-colors"
                        >
                          Scoring <ExternalLink size={8} />
                        </button>
                      </div>
                    </div>

                    {/* Actions Panel overlay on hover OR visible by default on mobile devices */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 sm:opacity-0 group-hover:opacity-100 opacity-100 transition-opacity">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-brand hover:text-black text-text-dim transition-all border border-white/5"
                          title="Mark read"
                        >
                          <Check size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500 hover:text-white text-text-dim transition-all border border-white/5"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer containing quick actions */}
            {notifications.length > 0 && (
              <div className="p-3 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[10px]">
                <button
                  onClick={() => clearAll()}
                  className="text-text-dim hover:text-red-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={11} /> Clear All
                </button>
                <span className="text-text-dim font-mono">
                  {notifications.length} alerts total
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
