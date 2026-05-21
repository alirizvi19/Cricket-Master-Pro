// src/pages/Dashboard.tsx
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/hooks';
import { collection, query, where, getDocs, addDoc, orderBy, deleteDoc, doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trophy, Users, Calendar, ArrowRight, Search, Activity, Trash2, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import Loading from '../components/Loading';

export default function Dashboard() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentLocation, setNewTournamentLocation] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserTournaments();
      fetchUserInvitations();
    }
  }, [user]);

  const fetchUserInvitations = async () => {
    try {
      const q = query(
        collection(db, 'invitations'),
        where('invitedEmail', '==', user?.email),
        where('status', '==', 'pending')
      );
      const snap = await onSnapshot(q, (s) => {
        setInvitations(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'invitations');
      });
      return () => snap();
    } catch (err) {
      console.error("Error fetching invitations:", err);
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    try {
      // 1. Create player
      const playerRef = await addDoc(collection(db, 'players'), {
        name: user?.displayName || user?.email?.split('@')[0],
        email: user?.email,
        userId: user?.uid,
        teamId: invite.teamId,
        role: 'batsman',
        photoUrl: user?.photoURL || null,
        matchesPlayed: 0,
        totalRuns: 0,
        centuries: 0,
        halfCenturies: 0,
        highestScore: 0,
        totalWickets: 0,
        fiveWicketHauls: 0,
        bestBowlingFigures: "-",
        strikeRate: 0,
        economyRate: 0,
        battingAverage: 0,
        bowlingAverage: 0,
      });

      // 2. Add to team
      await updateDoc(doc(db, 'teams', invite.teamId), {
        players: arrayUnion({ id: playerRef.id, name: user?.displayName || user?.email?.split('@')[0], photoUrl: user?.photoURL || null })
      });

      // 3. Mark invite as accepted
      await updateDoc(doc(db, 'invitations', invite.id), { status: 'accepted' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `invitations/${invite.id}`);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'invitations', inviteId), { status: 'declined' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `invitations/${inviteId}`);
    }
  };

  const fetchUserTournaments = async () => {
    try {
      const q = query(
        collection(db, 'tournaments'),
        where('organizerId', '==', user?.uid)
      );
      const querySnapshot = await getDocs(q);
      const fetchedTournaments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side to avoid composite index requirement
      fetchedTournaments.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });
      
      setTournaments(fetchedTournaments);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'tournaments');
    } finally {
      setLoading(false);
    }
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    const path = 'tournaments';
    try {
      const docRef = await addDoc(collection(db, path), {
        name: newTournamentName,
        location: newTournamentLocation,
        organizerId: user.uid,
        organizerName: user.displayName || user.email?.split('@')[0],
        startDate: new Date().toISOString(),
        status: 'upcoming',
        teams: [],
        matches: []
      });
      setShowCreateModal(false);
      navigate(`/tournament/${docRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTournament = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this tournament? This cannot be undone.")) return;
    const path = `tournaments/${id}`;
    try {
      await deleteDoc(doc(db, 'tournaments', id));
      setTournaments(tournaments.filter(t => t.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (authLoading || loading) return <Loading />;

  return (
    <div className="w-full space-y-6 sm:space-y-8 md:space-y-12 px-4 sm:px-6 md:px-8 pt-16 md:pt-24 pb-8 md:pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-white italic">My Dashboard</h1>
          <p className="text-text-dim text-sm sm:text-base font-medium">Manage your tournaments, teams and player performance</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full md:w-auto justify-center bg-brand text-black px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] sm:text-xs flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-brand/20"
          >
            <Plus size={16} className="sm:w-[18px] sm:h-[18px]" /> Create Tournament
          </button>
        )}
      </header>

      {/* Stats Summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Trophy size={16} />} label="Tournaments" value={tournaments.length.toString()} />
        <StatCard icon={<Activity size={16} />} label="Invitations" value={invitations.length.toString()} />
        <StatCard icon={<Users size={16} />} label="Total Teams" value="0" color="bg-brand text-black" />
        <StatCard icon={<Calendar size={16} />} label="Upcoming" value="0" />
      </section>

      {invitations.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-xl font-bold uppercase tracking-tight text-white italic">Team Invitations</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {invitations.map((invite) => (
              <div key={invite.id} className="bg-brand/10 border border-brand/30 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand text-black rounded-xl flex items-center justify-center font-black">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white italic">Join Team Request</h3>
                    <p className="text-[10px] text-brand font-bold uppercase tracking-widest">Tournament Invite</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAcceptInvite(invite)}
                    className="flex-1 py-2 bg-brand text-black rounded-lg font-bold uppercase text-[9px] tracking-widest"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => handleDeclineInvite(invite.id)}
                    className="flex-1 py-2 border border-brand/20 text-brand rounded-lg font-bold uppercase text-[9px] tracking-widest"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tournament List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h2 className="text-xl font-bold uppercase tracking-tight text-white italic">Active Tournaments</h2>
          <div className="flex items-center gap-2 text-[10px] font-mono text-text-dim uppercase tracking-widest">
            <Search size={14} /> Search
          </div>
        </div>

        {tournaments.length === 0 ? (
          <div className="py-12 sm:py-20 text-center bg-white/5 border-2 border-dashed border-white/5 rounded-3xl px-4">
            <Trophy size={48} className="mx-auto text-white/5 mb-4" />
            <p className="text-text-dim font-medium">No tournaments created yet</p>
            {isAdmin ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-brand font-bold flex items-center gap-1 mx-auto hover:gap-2 transition-all uppercase text-[10px] tracking-widest"
              >
                Get Started <ArrowRight size={14} />
              </button>
            ) : (
              <Link
                to="/tournaments"
                className="mt-4 text-brand font-bold flex items-center gap-1 mx-auto hover:gap-2 transition-all uppercase text-[10px] tracking-widest"
              >
                Browse Tournaments <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} onDelete={() => handleDeleteTournament(t.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary rounded-3xl p-6 sm:p-8 w-full max-w-md border border-white/10"
          >
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">New Tournament</h2>
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Tournament Name</label>
                <input
                  type="text"
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Summer Premier League"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Location</label>
                <input
                  type="text"
                  value={newTournamentLocation}
                  onChange={(e) => setNewTournamentLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. London, UK"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color = "bg-bg-secondary text-white" }: { icon: React.ReactNode, label: string, value: string, color?: string }) {
  return (
    <div className={`${color} p-6 rounded-2xl border border-white/5 shadow-xl`}>
      <div className="flex items-center gap-2 opacity-50 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black italic tracking-tighter">{value}</div>
    </div>
  );
}

function TournamentCard({ tournament, onDelete }: { tournament: any, onDelete: () => void | Promise<void>, key?: any }) {
  return (
    <div className="relative group h-full">
      <Link to={`/tournament/${tournament.id}`}>
        <motion.div
          whileHover={{ y: -8 }}
          className="bg-bg-secondary border border-white/5 rounded-3xl p-6 md:p-7 hover:border-brand/50 transition-all h-full flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div>
            <div className="flex items-start justify-between mb-8">
              <div className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl group-hover:bg-brand group-hover:text-black transition-all shadow-inner">
                <Trophy size={28} />
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg italic backdrop-blur-md border ${
                  tournament.status === 'ongoing' ? 'bg-brand/10 text-brand border-brand/20' : 'bg-white/5 text-white/40 border-white/10'
                }`}>
                  {tournament.status}
                </span>
                {tournament.isPublic && (
                  <span className="text-[8px] font-bold text-blue-400/60 uppercase tracking-widest italic">Public Arena</span>
                )}
              </div>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter mb-2 text-white italic group-hover:text-brand transition-colors leading-none">{tournament.name}</h3>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] mb-8 text-text-dim/60">
               <MapPin size={12} className="text-brand/40" />
               {tournament.location}
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 flex items-center justify-between">
            <div className="flex -space-x-3">
              {(tournament.teams || []).slice(0, 3).map((team: any, i: number) => (
                <div key={i} className="w-9 h-9 rounded-xl bg-bg-main border-2 border-bg-secondary flex items-center justify-center text-[10px] font-black text-brand shadow-lg">
                  {team.name?.charAt(0) || '?'}
                </div>
              ))}
              {(tournament.teams?.length || 0) > 3 && (
                <div className="w-9 h-9 rounded-xl bg-white/5 border-2 border-bg-secondary flex items-center justify-center text-[8px] font-black text-text-dim">
                  +{tournament.teams.length - 3}
                </div>
              )}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim flex items-center gap-2 group-hover:text-brand transition-all italic">
              Access <ArrowRight size={14} />
            </div>
          </div>
        </motion.div>
      </Link>
      
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-6 right-6 z-10 p-2.5 bg-black/60 text-white/20 hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md border border-white/10 hover:border-red-500/50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
