// src/pages/Profile.tsx
import { auth, db, handleFirestoreError, OperationType, storage } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/hooks';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, Save, User, Calendar, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    displayName: '',
    age: '',
    location: '',
    bio: '',
    photoUrl: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const [playerStats, setPlayerStats] = useState<any>(null);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          displayName: user.displayName || '',
          age: data.age || '',
          location: data.location || '',
          bio: data.bio || '',
          photoUrl: user.photoURL || ''
        });
      } else {
        setProfile({
          ...profile,
          displayName: user.displayName || '',
          photoUrl: user.photoURL || ''
        });
      }
      
      const pSnap = await getDoc(doc(db, 'players', user.uid));
      if (pSnap.exists()) {
        setPlayerStats(pSnap.data());
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db, 'users', user.uid), { photoUrl: url }, { merge: true });
      
      setProfile(prev => ({ ...prev, photoUrl: url }));
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      // Update Auth Profile
      await updateProfile(user, { displayName: profile.displayName });
      
      // Update Firestore Profile
      await setDoc(doc(db, 'users', user.uid), {
        displayName: profile.displayName,
        age: profile.age,
        location: profile.location,
        bio: profile.bio,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      alert("Profile updated successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <Loading />;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 md:space-y-12 px-4 sm:px-6 md:px-8 pt-16 md:pt-24 pb-8 md:pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-white italic">User Profile</h1>
            <p className="text-text-dim text-sm sm:text-base font-medium">Manage your personal information and presence</p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-bg-secondary border border-white/5 rounded-[2.5rem] p-6 md:p-8 text-center space-y-4 md:space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl rounded-full -mr-16 -mt-16" />
            
            <div className="relative inline-block group">
              <div className="w-32 h-32 rounded-[2rem] bg-white/5 border-2 border-white/10 overflow-hidden flex items-center justify-center relative shadow-2xl">
                {uploading ? (
                  <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                ) : profile.photoUrl ? (
                  <img src={profile.photoUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={48} className="text-white/10" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-3 bg-brand text-black rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-brand/20">
                <Camera size={18} />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase italic text-white tracking-tight">{profile.displayName || 'Anonymous'}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim mt-1">{user?.email}</p>
            </div>

            <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim mb-1">Age</div>
                <div className="font-black italic text-white text-xl">{profile.age || '-'}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim mb-1">Location</div>
                <div className="font-black italic text-white text-xl truncate px-2">{profile.location || '-'}</div>
              </div>
            </div>
          </div>

          {playerStats && (
            <div className="bg-bg-secondary border border-brand/20 rounded-[2.5rem] p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-brand/5 blur-3xl rounded-full -z-10" />
              <h3 className="text-lg font-black uppercase tracking-tighter text-brand italic">Career Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">Total Runs</div>
                  <div className="text-2xl font-black text-white italic">{playerStats.totalRuns || 0}</div>
                  <div className="text-[8px] uppercase text-text-dim mt-1">Avg: {playerStats.battingAverage || 0} | SR: {playerStats.strikeRate || 0}</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">Total Wickets</div>
                  <div className="text-2xl font-black text-white italic">{playerStats.totalWickets || 0}</div>
                  <div className="text-[8px] uppercase text-text-dim mt-1">Best: {playerStats.bestBowlingFigures || '-'} | Econ: {playerStats.economyRate || 0}</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">Matches</div>
                  <div className="text-2xl font-black text-white italic">{playerStats.matchesPlayed || 0}</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">High Score</div>
                  <div className="text-2xl font-black text-brand italic">{playerStats.highestScore || 0}</div>
                  {playerStats.centuries ? <div className="text-[8px] uppercase text-brand/60 mt-1">{playerStats.centuries} centuries</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-bg-secondary border border-white/5 rounded-[2.5rem] p-6 md:p-12 space-y-6 md:space-y-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Display Name</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                    className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-brand transition-all font-bold placeholder:opacity-20"
                    placeholder="e.g. John Doe"
                    required
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-brand transition-colors">
                    <User size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Age</label>
                <div className="relative group">
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile({...profile, age: e.target.value})}
                    className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-brand transition-all font-bold placeholder:opacity-20"
                    placeholder="e.g. 25"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-brand transition-colors">
                    <Calendar size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({...profile, location: e.target.value})}
                  className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-brand transition-all font-bold placeholder:opacity-20"
                  placeholder="e.g. London, UK"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Email (Primary)</label>
                <div className="relative group grayscale">
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-text-dim outline-none cursor-not-allowed font-bold"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-text-dim">
                    <Mail size={18} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">Bio / Professional Intro</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile({...profile, bio: e.target.value})}
                rows={4}
                className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-brand transition-all font-medium placeholder:opacity-20 resize-none"
                placeholder="Tell us about your cricketing journey..."
              />
            </div>

            <div className="pt-6 border-t border-white/5">
              <button
                type="submit"
                disabled={saving}
                className="w-full md:w-auto px-12 py-5 bg-brand text-black rounded-2xl font-black uppercase italic tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand/20 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
