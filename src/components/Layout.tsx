// src/components/Layout.tsx
import { auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/hooks';
import { Trophy, LogOut, User, Menu, X, PlusCircle, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-main text-slate-200 font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-brand rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <Trophy className="text-black w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-xl text-white">CricMaster<span className="text-brand underline decoration-2 underline-offset-4">Pro</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-[0.2em]">
            <Link to="/tournaments" className="text-text-dim hover:text-white transition-colors">Tournaments</Link>
            {user && <Link to="/dashboard" className="text-text-dim hover:text-brand transition-colors flex items-center gap-2 italic">
              <LayoutDashboard size={14} /> Dashboard
            </Link>}
            {user ? (
              <div className="flex items-center gap-4 border-l border-white/10 pl-8">
                <Link to="/profile" className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={14} className="text-brand" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-white tracking-widest group-hover:text-brand transition-colors">{user.displayName || user.email?.split('@')[0]}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 text-text-dim hover:text-red-400 transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="bg-brand text-black px-6 py-2 rounded-lg font-bold hover:bg-white transition-colors uppercase tracking-widest text-[10px]">
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-0 z-40 bg-[#F5F5F0] md:hidden pt-20 px-6"
          >
            <div className="flex flex-col gap-6 text-2xl font-bold uppercase italic">
              <Link to="/tournaments" onClick={() => setIsMenuOpen(false)}>Tournaments</Link>
              {user && <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>}
              {user && <Link to="/profile" onClick={() => setIsMenuOpen(false)}>Profile</Link>}
              {!user && <Link to="/login" onClick={() => setIsMenuOpen(false)}>Login</Link>}
              {user && <button onClick={handleLogout} className="text-left text-red-500">Logout</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full min-h-[calc(100vh-64px)]">
        {children}
      </main>
    </div>
  );
}
