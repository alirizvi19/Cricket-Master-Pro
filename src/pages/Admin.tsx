import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../lib/hooks';
import Loading from '../components/Loading';
import { Shield, ShieldAlert, Users, Check, Edit2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Navigate } from 'react-router-dom';

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const usersData = snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserAccess = async (uid: string, accessRole: string) => {
    setUpdating(uid);
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: accessRole
      });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: accessRole } : u));
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user access.");
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) return <Loading />;
  
  // Protect route
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24 space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-brand mb-4">
            <Shield size={32} />
            <span className="text-sm font-bold uppercase tracking-[0.3em]">Admin Control</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white italic">
            User Management
          </h1>
          <p className="text-text-dim max-w-xl text-sm leading-relaxed">
            Manage player access and scoring permissions across the platform.
          </p>
        </div>
      </header>

      <div className="grid gap-4">
        {users.map(u => (
          <div key={u.uid} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/10 transition-colors">
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
                {u.photoUrl ? (
                  <img src={u.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-brand" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">{u.displayName || 'Unknown Player'}</h3>
                <p className="text-text-dim text-xs font-mono">{u.email}</p>
                {u.playerRole && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-brand/10 text-brand text-[9px] font-bold uppercase tracking-widest rounded-full">
                    {u.playerRole}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/30 p-2 border border-white/5 rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Access:</div>
              <select
                value={u.role || 'viewer'}
                onChange={(e) => updateUserAccess(u.uid, e.target.value)}
                disabled={updating === u.uid || u.email === user?.email}
                className="bg-transparent text-white text-xs font-bold uppercase outline-none cursor-pointer pr-4 disabled:opacity-50"
              >
                <option value="viewer" className="text-black">View Only</option>
                <option value="scorer" className="text-black">Scorer</option>
                <option value="admin" className="text-black">Admin</option>
              </select>
            </div>

          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
            <Users size={48} className="mx-auto text-text-dim mb-4" />
            <h3 className="text-xl font-bold text-white italic">No players found</h3>
          </div>
        )}
      </div>
    </div>
  );
}
