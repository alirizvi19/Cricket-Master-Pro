// src/pages/Tournaments.tsx
import { db } from '@/src/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Trophy, MapPin, Calendar, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const q = query(collection(db, 'tournaments'), orderBy('startDate', 'desc'));
      const querySnapshot = await getDocs(q);
      setTournaments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="w-full space-y-6 sm:space-y-8 md:space-y-12 px-4 sm:px-6 md:px-8 pt-16 md:pt-24 pb-8 md:pb-12">
      <header className="space-y-4 sm:space-y-6">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white decoration-brand/20">
          Public <br className="hidden sm:block" /> <span className="text-brand">Tournaments</span>
        </h1>
        <div className="relative max-w-md">
          <input 
            type="text" 
            placeholder="Search by name or location..." 
            className="w-full pl-12 pr-4 py-4 bg-bg-secondary border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-brand text-white"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
        {tournaments.map((t) => (
          <Link key={t.id} to={`/tournament/${t.id}`}>
            <motion.div
              whileHover={{ y: -8 }}
              className="bg-bg-secondary border border-white/5 rounded-3xl overflow-hidden group shadow-2xl shadow-black/20 hover:border-brand/40 transition-all"
            >
               <div className="h-40 bg-zinc-900/50 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center opacity-5">
                    <Trophy size={120} className="text-white" />
                  </div>
                  <div className="absolute bottom-4 left-6">
                    <span className="text-[10px] font-bold uppercase py-1 px-2 bg-brand text-black rounded-sm italic">{t.status}</span>
                  </div>
               </div>
               <div className="p-6 sm:p-8 space-y-4">
                  <h3 className="text-2xl font-black italic uppercase tracking-tight text-white">{t.name}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-text-dim tracking-widest italic">
                      <MapPin size={14} className="text-brand" /> {t.location}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-text-dim tracking-widest italic">
                      <Calendar size={14} className="text-brand" /> {new Date(t.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-text-dim tracking-widest">{t.teams?.length || 0} Teams Registered</span>
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-brand border border-white/10 group-hover:bg-brand group-hover:text-black transition-colors">
                      <Trophy size={18} />
                    </div>
                  </div>
               </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
