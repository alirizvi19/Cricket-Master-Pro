// src/components/Layout.tsx
import { auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/hooks';
import { Trophy, LogOut, User, Menu, X, PlusCircle, LayoutDashboard, Shield, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading, isAdmin } = useAuth();
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
            {isAdmin && <Link to="/admin" className="text-brand hover:text-white transition-colors flex items-center gap-2 italic">
              <Shield size={14} /> Admin
            </Link>}
            {user ? (
              <div className="flex items-center gap-4 border-l border-white/10 pl-8">
                <Link to="/profile" className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand">
                    {dbUser?.photoUrl ? (
                      <img src={dbUser.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : user.photoURL ? (
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
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            />

            {/* Side Sheet */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-4/5 max-w-sm z-[70] bg-bg-secondary border-l border-white/5 shadow-2xl flex flex-col justify-between md:hidden"
            >
              <div className="p-6 flex flex-col h-full justify-between">
                <div>
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-brand rounded flex items-center justify-center">
                        <Trophy className="text-black w-4.5 h-4.5" />
                      </div>
                      <span className="font-bold tracking-tight text-lg text-white">Menu</span>
                    </div>
                    <button 
                      onClick={() => setIsMenuOpen(false)} 
                      className="p-1.5 rounded-lg text-text-dim hover:text-white transition-colors bg-white/5 hover:bg-white/10"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* User Authentication Card */}
                  {user ? (
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-brand/20 flex items-center justify-center overflow-hidden">
                          {dbUser?.photoUrl ? (
                            <img src={dbUser.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="text-brand w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{user.displayName || user.email?.split('@')[0]}</h4>
                          <p className="text-[10px] font-mono text-text-dim truncate">{user.email}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20">
                          <Shield size={10} /> Admin Access
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-8">
                      <p className="text-xs text-text-dim leading-relaxed mb-3">Sign in to your account to manage tournaments, keep scores, and track your statistics.</p>
                      <Link
                        to="/login"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full h-9 bg-brand hover:bg-white text-black rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-colors"
                      >
                        <LogIn size={14} /> Login
                      </Link>
                    </div>
                  )}

                  {/* Navigation Links */}
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/tournaments"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-dim hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Trophy size={18} className="text-brand/80" />
                      <span>Tournaments</span>
                    </Link>

                    {user && (
                      <Link
                        to="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-dim hover:text-white hover:bg-white/5 transition-all"
                      >
                        <LayoutDashboard size={18} className="text-brand/80" />
                        <span>Dashboard</span>
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-brand hover:bg-brand/10 transition-all border border-brand/10"
                      >
                        <Shield size={18} />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    {user && (
                      <Link
                        to="/profile"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-dim hover:text-white hover:bg-white/5 transition-all"
                      >
                        <User size={18} className="text-brand/80" />
                        <span>My Profile</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Logout / Footer at the bottom */}
                {user && (
                  <div className="pt-4 border-t border-white/5">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold text-red-100 hover:text-white hover:bg-red-500/10 transition-colors border border-red-500/10"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="w-full min-h-[calc(100vh-64px)]">
        {children}
      </main>
    </div>
  );
}
