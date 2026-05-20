// src/pages/TournamentDetail.tsx
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/hooks";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  arrayRemove,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  Users,
  Info,
  Settings,
  Plus,
  Trophy,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Play,
  Calendar,
  Trash2,
  X,
  Edit,
  BarChart2,
  ChevronDown,
  ArrowUpDown,
  User,
  Activity,
  Camera,
  Share2,
  Link2,
  Check,
  MessageCircle,
  MapPin,
  AlertTriangle,
  Mail,
  FileSpreadsheet,
  Star,
  Award,
  Target,
  Medal,
} from "lucide-react";
import Markdown from "react-markdown";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import Loading from "../components/Loading";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/src/lib/firebase";
import { getAccessToken, googleSignIn } from "@/src/lib/authGoogle";
import { exportTournamentToSheets } from "@/src/lib/exportToSheets";

const getShareableUrl = (path: string) => {
  const { protocol, host } = window.location;
  // AI Studio uses -dev- for private development and -pre- for public shared apps
  // We want shared links to always use the public -pre- host if we are in the dev environment
  const shareableHost = host.replace("ais-dev-", "ais-pre-");
  return `${protocol}//${shareableHost}${path}`;
};

export default function TournamentDetail() {
  const { id } = useParams();
  const { user, isAdmin, userRole } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "info" | "standings" | "teams" | "matches"
  >("standings");

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showScorerJoinConfirmation, setShowScorerJoinConfirmation] =
    useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const [joinConfirmation, setJoinConfirmation] = useState<{
    teamId: string;
    teamName: string;
    tournamentId: string;
  } | null>(null);

  useEffect(() => {
    fetchTournamentData();
    checkJoinLink();
  }, [id, user]);

  useEffect(() => {
    if (tournament && searchParams.get("joinScorer") === "true") {
      if (!user) {
        // Redirect to login but keep the current URL as redirect target
        const currentUrl = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        navigate(`/login`, {
          state: {
            from: {
              pathname: window.location.pathname,
              search: window.location.search,
            },
          },
        });
        return;
      }
      if (
        user.uid !== tournament.organizerId &&
        (!tournament.scorers || !tournament.scorers.includes(user.uid))
      ) {
        setShowScorerJoinConfirmation(true);
      }
    }
  }, [tournament, user, searchParams, navigate]);

  const checkJoinLink = async () => {
    const joinTeamId = searchParams.get("joinTeam");
    if (joinTeamId) {
      if (!user) {
        navigate(`/login`, {
          state: {
            from: {
              pathname: window.location.pathname,
              search: window.location.search,
            },
          },
        });
        return;
      }

      // Clear the param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("joinTeam");
      setSearchParams(newParams);

      // Trigger join request modal
      try {
        const teamSnap = await getDoc(doc(db, "teams", joinTeamId));
        if (teamSnap.exists()) {
          setJoinConfirmation({
            teamId: joinTeamId,
            teamName: teamSnap.data().name,
            tournamentId: id || "",
          });
        }
      } catch (err) {
        console.error("Join link error:", err);
      }
    }
  };

  const handleConfirmJoinLink = async () => {
    if (!joinConfirmation || !user) return;
    try {
      await addDoc(collection(db, "joinRequests"), {
        teamId: joinConfirmation.teamId,
        tournamentId: joinConfirmation.tournamentId,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0],
        userPhotoUrl: user.photoURL || null,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setJoinConfirmation(null);
      // We could use a toast here
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "joinRequests");
    }
  };

  const fetchTournamentData = async () => {
    if (!id) return;
    try {
      const docSnap = await getDoc(doc(db, "tournaments", id));
      if (docSnap.exists()) {
        setTournament({ id: docSnap.id, ...docSnap.data() });

        // Fetch teams
        const teamsQ = query(
          collection(db, "teams"),
          where("tournamentId", "==", id),
        );
        const teamsSnap = await getDocs(teamsQ);
        const teamsData = teamsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        if (teamsData.length > 0) {
          const teamIds = teamsData.map((t) => t.id);
          const playersQ = query(
            collection(db, "players"),
            where("teamId", "in", teamIds),
          );
          const playersSnap = await getDocs(playersQ);
          const allPlayers = playersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          const teamsWithPlayers = teamsData.map((team) => ({
            ...team,
            fullPlayers: allPlayers.filter(
              (p) => (p as any).teamId === team.id,
            ),
          }));
          setTeams(teamsWithPlayers);
        } else {
          setTeams(teamsData);
        }

        // Fetch matches
        const matchesQ = query(
          collection(db, "matches"),
          where("tournamentId", "==", id),
        );
        const matchesSnap = await getDocs(matchesQ);
        setMatches(matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tournaments/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const [isAddingTeam, setIsAddingTeam] = useState(false);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTeamName) return;
    setIsAddingTeam(true);
    const path = "teams";
    try {
      const teamRef = await addDoc(collection(db, path), {
        name: newTeamName,
        tournamentId: id,
        players: [],
        createdAt: new Date().toISOString(),
      });
      setTeams([
        ...teams,
        { id: teamRef.id, name: newTeamName, tournamentId: id, players: [] },
      ]);
      setNewTeamName("");
      setShowTeamModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsAddingTeam(false);
    }
  };

  if (loading) return <Loading />;
  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group">
          <Trophy
            size={40}
            className="text-white/20 group-hover:text-brand transition-colors"
          />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-white italic tracking-tighter">
            Tournament Not Found
          </h2>
          <p className="text-text-dim text-[10px] font-bold uppercase tracking-[0.2em] max-w-[280px]">
            The league you are looking for does not exist or has been archived.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="px-8 py-4 bg-brand text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95 shadow-lg shadow-brand/20"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const handleConfirmScorerJoin = async () => {
    if (!id || !user) return;
    try {
      await updateDoc(doc(db, "tournaments", id), {
        scorers: arrayUnion(user.uid),
      });
      setShowScorerJoinConfirmation(false);
      fetchTournamentData();

      // Clear the param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("joinScorer");
      setSearchParams(newParams);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${id}`);
    }
  };

  const handleCopyLink = () => {
    try {
      const link = getShareableUrl(
        `${window.location.pathname}?joinScorer=true`,
      );
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleWhatsAppShare = () => {
    try {
      const link = getShareableUrl(
        `${window.location.pathname}?joinScorer=true`,
      );
      const text = `Join as a Scorer for ${tournament.name} on Antigravity Cricket: ${link}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch (err) {
      console.error("Failed to share on WhatsApp:", err);
    }
  };

  const handleExportToSheets = async () => {
    try {
      if (!id) return;
      setIsExporting(true);
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        if (result && result.accessToken) {
          token = result.accessToken;
        } else {
          setIsExporting(false);
          return;
        }
      }
      const url = await exportTournamentToSheets(id, token);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export to Google Sheets");
    } finally {
      setIsExporting(false);
    }
  };

  const isOrganizer = isAdmin || user?.uid === tournament?.organizerId;
  const isScorer = isOrganizer || userRole === 'scorer' || tournament?.scorers?.includes(user?.uid);

  return (
    <div className="w-full space-y-6 sm:space-y-8 md:space-y-12 px-2 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-8 md:pb-12">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-text-dim hover:text-brand transition-all group"
        >
          <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-brand group-hover:text-black transition-colors">
            <ArrowLeft size={12} />
          </div>
          Back to Arena
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-brand italic">
            Live Tournament
          </span>
        </div>
      </div>

      <header className="relative">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <h1 className="text-[26px] leading-[30px] sm:text-4xl md:text-6xl lg:text-8xl font-black uppercase tracking-tighter text-white italic break-words max-w-full">
                {tournament.name}
              </h1>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <div
                  className={`w-2 h-2 rounded-full ${tournament.status === "ongoing" ? "bg-brand" : "bg-text-dim"}`}
                />
                <span className="text-[9px] sm:text-[10px] font-black uppercase italic text-white tracking-widest">
                  {tournament.status}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-text-dim font-bold text-[10px] uppercase tracking-[0.2em] italic">
              <div className="flex items-center gap-2 p-1 px-3 bg-white/5 rounded-lg border border-white/5">
                <Activity size={12} className="text-brand" />
                {tournament.location}
              </div>
              <div className="flex items-center gap-2 p-1 px-3 bg-white/5 rounded-lg border border-white/5">
                <User size={12} className="text-brand" />
                Organizer: {tournament.organizerName}
              </div>
              <div className="flex items-center gap-2 p-1 px-3 bg-white/5 rounded-lg border border-white/5">
                <Plus size={12} className="text-brand" />
                {tournament.oversPerMatch} Overs
              </div>
            </div>
          </div>

          {isOrganizer && (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="flex p-1 sm:p-2 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  title="Tournament Settings"
                  className="p-2 sm:p-3 text-text-dim hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="w-[1px] h-full bg-white/5 mx-1 sm:mx-2" />
                {isOrganizer && (
                  <>
                    <button
                      onClick={handleExportToSheets}
                      disabled={isExporting}
                      title="Export to Google Sheets"
                      className="p-2 sm:p-3 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden md:inline text-[9px] sm:text-[10px] uppercase font-bold tracking-widest">
                        Export
                      </span>
                    </button>
                    <div className="w-[1px] h-full bg-white/5 mx-1 sm:mx-2" />
                  </>
                )}
                <button
                  onClick={handleCopyLink}
                  title="Copy Scorer Joining Link"
                  className="p-2 sm:p-3 text-text-dim hover:text-brand transition-all"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
                  ) : (
                    <Link2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
                <div className="w-[1px] h-full bg-white/5 mx-1 sm:mx-2 hidden sm:block" />
                <button
                  onClick={handleWhatsAppShare}
                  title="Share Scorer Link on WhatsApp"
                  className="p-2 sm:p-3 text-[#25D366] hover:bg-[#25D366]/5 rounded-xl transition-all"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              <button
                onClick={() => setShowTeamModal(true)}
                className="bg-brand text-black px-6 py-4 sm:px-10 sm:py-5 rounded-2xl font-black uppercase italic tracking-widest text-[10px] sm:text-[11px] flex items-center gap-2 sm:gap-3 hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-brand/30"
              >
                <Plus className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={4} /> Register Team
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 sm:gap-6 md:gap-12 overflow-x-auto pb-2 sm:pb-4 no-scrollbar border-b border-white/5 px-4 sm:px-2 -mx-4 sm:mx-0">
        <TabButton
          active={activeTab === "standings"}
          onClick={() => setActiveTab("standings")}
          icon={<BarChart2 size={16} />}
          label="Leaderboard"
        />
        <TabButton
          active={activeTab === "info"}
          onClick={() => setActiveTab("info")}
          icon={<Info size={16} />}
          label="Intelligence"
        />
        <TabButton
          active={activeTab === "teams"}
          onClick={() => setActiveTab("teams")}
          icon={<Users size={16} />}
          label="Operational Units"
        />
        <TabButton
          active={activeTab === "matches"}
          onClick={() => setActiveTab("matches")}
          icon={<Calendar size={16} />}
          label="War Room"
        />
        <TabButton
          active={activeTab === ("analytics" as any)}
          onClick={() => setActiveTab("analytics" as any)}
          icon={<Award size={16} />}
          label="Analytics & Caps"
        />
      </div>

      <div className="py-8">
        {activeTab === "standings" && (
          <StandingsSection teams={teams} matches={matches} />
        )}
        {activeTab === "info" && (
          <InfoSection
            tournament={tournament}
            stats={{ teams: teams.length, matches: matches.length }}
          />
        )}
        {activeTab === "teams" && (
          <TeamsSection
            teams={teams}
            isOrganizer={isOrganizer}
            onAddPlayer={fetchTournamentData}
            onAddTeam={() => setShowTeamModal(true)}
          />
        )}
        {activeTab === "matches" && (
          <MatchesSection
            matches={matches}
            teams={teams}
            isOrganizer={isScorer}
            tournamentId={id!}
            onUpdate={fetchTournamentData}
            defaultOvers={tournament.oversPerMatch}
          />
        )}
        {activeTab === ("analytics" as any) && (
          <TournamentAnalyticsSection teams={teams} />
        )}
      </div>

      {/* Add Team Modal */}
      {showTeamModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowTeamModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
          >
            <button 
              onClick={() => setShowTeamModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-text-dim hover:text-white transition-all"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">
              Register New Team
            </h2>
            <form onSubmit={handleAddTeam} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Royal Challengers"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  disabled={isAddingTeam}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingTeam}
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {isAddingTeam ? "Registering..." : "Register"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Empty Space preserved to keep formatting */}

      {/* Tournament Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-bg-secondary border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-black uppercase italic text-white tracking-tight">
                  Tournament Settings
                </h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    Status
                  </label>
                  <select
                    value={tournament?.status}
                    onChange={async (e) => {
                      if (!id) return;
                      await updateDoc(doc(db, "tournaments", id), {
                        status: e.target.value,
                      });
                      fetchTournamentData();
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand appearance-none"
                  >
                    <option value="upcoming" className="bg-bg-secondary">
                      Upcoming
                    </option>
                    <option value="ongoing" className="bg-bg-secondary">
                      Ongoing
                    </option>
                    <option value="completed" className="bg-bg-secondary">
                      Completed
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    Visibility
                  </label>
                  <select
                    value={tournament?.isPublic ? "public" : "private"}
                    onChange={async (e) => {
                      if (!id) return;
                      await updateDoc(doc(db, "tournaments", id), {
                        isPublic: e.target.value === "public",
                      });
                      fetchTournamentData();
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand appearance-none"
                  >
                    <option value="public" className="bg-bg-secondary">
                      Public (Featured in Gallery)
                    </option>
                    <option value="private" className="bg-bg-secondary">
                      Private (Link Only)
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    Overs Per Match (Global Default)
                  </label>
                  <input
                    type="number"
                    value={tournament?.oversPerMatch || 20}
                    onChange={async (e) => {
                      if (!id) return;
                      await updateDoc(doc(db, "tournaments", id), {
                        oversPerMatch: Number(e.target.value),
                      });
                      fetchTournamentData();
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-4 bg-brand text-black rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-white transition-all shadow-lg shadow-brand/20"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatInput({
  label,
  value,
  onChange,
  type = "number",
  step,
  placeholder,
  readOnly,
}: {
  label: string;
  value: any;
  onChange?: (v: any) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="space-y-1 bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
        <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim">
          {label}
        </div>
        <div className="text-sm font-black italic text-white mt-1">
          {value !== undefined && value !== "" ? value : "-"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
        {label}
      </label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none transition-all text-xs font-mono focus:ring-2 focus:ring-brand"
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 sm:px-8 sm:py-4 flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 shrink-0 ${active ? "border-brand text-brand" : "border-transparent text-text-dim hover:text-white"}`}
    >
      {icon} {label}
    </button>
  );
}

function InfoSection({ tournament, stats }: { tournament: any; stats: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10"
    >
      <div className="bg-bg-secondary border border-white/5 rounded-[2.5rem] p-6 sm:p-8 md:p-12 space-y-6 md:space-y-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <MapPin size={120} />
        </div>
        <div className="flex items-center gap-6 border-b border-white/5 pb-8 relative z-10">
          <div className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand">
            <MapPin size={28} />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim italic">
              Operational Base
            </h3>
            <p className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter">
              {tournament.location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
            <Calendar size={28} />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim italic">
              Deployment Date
            </h3>
            <p className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter">
              {new Date(tournament.startDate).toLocaleDateString(undefined, {
                dateStyle: "long",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-bg-secondary border border-white/5 rounded-[2.5rem] p-6 sm:p-8 md:p-12 space-y-6 md:space-y-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Users size={120} />
        </div>
        <div className="flex items-center gap-6 border-b border-white/5 pb-8 relative z-10">
          <div className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand">
            <Users size={28} />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim italic">
              Registered Units
            </h3>
            <p className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter">
              {stats.teams} Teams Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-green-400">
            <Activity size={28} />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim italic">
              Battle Status
            </h3>
            <p className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter capitalize">
              {tournament.status}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand/20 via-transparent to-transparent border border-brand/20 rounded-[2.5rem] p-6 sm:p-8 md:p-12 space-y-6 md:space-y-8 shadow-2xl flex flex-col justify-center text-center group relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-brand/5 blur-[100px] -z-10" />
        <Trophy
          size={64}
          className="mx-auto text-brand animate-bounce group-hover:scale-110 transition-transform"
        />
        <div>
          <h3 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter">
            Grand Prize
          </h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.6em] text-brand mt-4 opacity-60">
            Victory Awaits
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function StandingsSection({
  teams,
  matches,
}: {
  teams: any[];
  matches: any[];
}) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "points", direction: "desc" });

  const standings = teams.map((team) => {
    const teamMatches = matches.filter(
      (m) =>
        m.status === "completed" &&
        (m.teamAId === team.id || m.teamBId === team.id),
    );
    const won = teamMatches.filter((m) => m.winnerId === team.id).length;
    const lost = teamMatches.filter(
      (m) => m.winnerId && m.winnerId !== team.id && m.winnerId !== "tie",
    ).length;
    const tied = teamMatches.filter((m) => m.winnerId === "tie").length;

    // NRR Calculation
    let totalRunsScored = 0;
    let totalOversFaced = 0;
    let totalRunsConceded = 0;
    let totalOversBowled = 0;

    teamMatches.forEach((m) => {
      const isTeamA = m.teamAId === team.id;
      const ownScore = isTeamA ? m.score.teamA : m.score.teamB;
      const oppScore = isTeamA ? m.score.teamB : m.score.teamA;
      const maxOvers = m.maxOvers || 20;

      totalRunsScored += ownScore.runs || 0;
      totalRunsConceded += oppScore.runs || 0;

      if (ownScore.wickets >= 10) {
        totalOversFaced += maxOvers;
      } else {
        totalOversFaced +=
          Math.floor(ownScore.overs) + ((ownScore.overs % 1) * 10) / 6;
      }

      if (oppScore.wickets >= 10) {
        totalOversBowled += maxOvers;
      } else {
        totalOversBowled +=
          Math.floor(oppScore.overs) + ((oppScore.overs % 1) * 10) / 6;
      }
    });

    const nrrValue =
      totalOversFaced > 0 && totalOversBowled > 0
        ? totalRunsScored / totalOversFaced -
          totalRunsConceded / totalOversBowled
        : 0;

    return {
      ...team,
      played: teamMatches.length,
      won,
      lost,
      tied,
      points: won * 2 + tied * 1,
      nrr: nrrValue,
    };
  });

  const sortedStandings = [...standings].sort((a: any, b: any) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Secondary sort by Points then NRR if values are equal
    if (aValue === bValue) {
      if (sortConfig.key !== "points") {
        if (a.points !== b.points) return b.points - a.points;
      }
      return b.nrr - a.nrr;
    }

    if (sortConfig.direction === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const SortHeader = ({
    label,
    sortKey,
    align = "center",
  }: {
    label: string;
    sortKey: string;
    align?: "left" | "center" | "right";
  }) => (
    <th
      className={`p-3 sm:py-8 sm:px-4 cursor-pointer hover:bg-white/5 transition-colors group/header ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
      onClick={() => handleSort(sortKey)}
    >
      <div
        className={`flex items-center gap-1 sm:gap-2 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}
      >
        <span>{label}</span>
        <ArrowUpDown
          size={10}
          className={`transition-opacity ${sortConfig.key === sortKey ? "opacity-100 text-brand" : "opacity-20 group-hover/header:opacity-50"}`}
        />
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim border-b border-white/5 bg-white/[0.02]">
                <th className="p-4 sm:py-8 sm:px-10">#</th>
                <SortHeader label="Team" sortKey="name" align="left" />
                <SortHeader label="P" sortKey="played" />
                <SortHeader label="W" sortKey="won" />
                <SortHeader label="L" sortKey="lost" />
                <SortHeader label="T" sortKey="tied" />
                <SortHeader label="NRR" sortKey="nrr" align="right" />
                <SortHeader label="Points" sortKey="points" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedStandings.map((team, idx) => (
                <tr
                  key={team.id}
                  className="group hover:bg-white/[0.02] transition-all"
                >
                  <td className="p-3 sm:py-8 sm:px-10">
                    <span
                      className={`w-6 h-6 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-black italic text-xs sm:text-sm ${idx === 0 && sortConfig.key === "points" && sortConfig.direction === "desc" ? "bg-brand text-black shadow-lg shadow-brand/20" : "bg-white/5 text-text-dim border border-white/5"}`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 p-0.5 group-hover:border-brand/40 transition-colors hidden sm:block">
                        <div className="w-full h-full rounded-[1.125rem] bg-bg-main flex items-center justify-center text-xl font-black italic text-brand">
                          {team.name.charAt(0)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs sm:text-base font-black uppercase italic text-white tracking-tight group-hover:text-brand transition-colors">
                          {team.name}
                        </span>
                        <div className="flex gap-2">
                          <span className="text-[8px] font-bold text-text-dim uppercase tracking-widest">
                            {team.fullPlayers?.length || 0} Players
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4 text-center">
                    <span className="text-[10px] sm:text-xs font-black font-mono text-text-dim bg-white/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/5">
                      {team.played}
                    </span>
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4 text-center">
                    <span className="text-[10px] sm:text-xs font-black italic text-brand bg-brand/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-brand/20">
                      {team.won}
                    </span>
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4 text-center text-[10px] sm:text-xs font-black font-mono text-text-dim">
                    {team.lost}
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4 text-center text-[10px] sm:text-xs font-black font-mono text-text-dim">
                    {team.tied}
                  </td>
                  <td className="p-3 sm:py-8 sm:px-4 text-right">
                    <span
                      className={`text-[8px] sm:text-[10px] font-black font-mono tracking-tighter ${team.nrr >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {team.nrr > 0 ? "+" : ""}
                      {team.nrr.toFixed(3)}
                    </span>
                  </td>
                  <td className="p-3 sm:py-8 sm:px-10 text-right">
                    <span className="text-xl sm:text-3xl font-black italic text-white tracking-tighter group-hover:scale-110 block transition-transform">
                      {team.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {standings.length === 0 && (
          <div className="p-32 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5 text-text-dim/10 relative">
              <Trophy size={48} />
              <div className="absolute inset-0 bg-brand/5 blur-2xl rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="text-lg sm:text-xl font-black uppercase italic text-white tracking-tight">
                No Rankings Yet
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim italic">
                Complete matches to see the battlefield standings
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamsSection({
  teams,
  isOrganizer,
  onAddPlayer,
  onAddTeam,
}: {
  teams: any[];
  isOrganizer: boolean;
  onAddPlayer: () => void;
  onAddTeam?: () => void;
}) {
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "batsman" | "bowler" | "all-rounder"
  >("all");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(
    new Set(),
  );
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const { user } = useAuth();
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState<
    "batsman" | "bowler" | "all-rounder"
  >("batsman");
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<string | null>(
    null,
  );
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState<{
    teamId: string;
    player: any;
  } | null>(null);
  const [showEditTeamModal, setShowEditTeamModal] = useState<any | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [showStatsModal, setShowStatsModal] = useState<any | null>(null);
  const [statsForm, setStatsForm] = useState({
    matchesPlayed: 0,
    totalRuns: 0,
    totalBallsFaced: 0,
    totalDismissals: 0,
    centuries: 0,
    halfCenturies: 0,
    highestScore: 0,
    fours: 0,
    sixes: 0,
    totalWickets: 0,
    totalRunsConceded: 0,
    totalBallsBowled: 0,
    maidens: 0,
    fourWicketHauls: 0,
    fiveWicketHauls: 0,
    bestBowlingFigures: "",
    strikeRate: 0,
    economyRate: 0,
    battingAverage: 0,
    bowlingAverage: 0,
    matchLogs: [] as any[],
  });
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(
    null,
  );

  const handleUpdateStats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showStatsModal) return;
    try {
      await updateDoc(doc(db, "players", showStatsModal.id), statsForm);
      onAddPlayer();
      setShowStatsModal(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `players/${showStatsModal.id}`,
      );
    }
  };

  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditTeamModal || !editTeamName.trim()) return;
    try {
      const teamId = showEditTeamModal.id;
      const newName = editTeamName.trim();

      // Update team document
      await updateDoc(doc(db, "teams", teamId), {
        name: newName,
      });

      // Update match documents where this team is involved (denormalized name cache)
      const matchesQA = query(
        collection(db, "matches"),
        where("teamAId", "==", teamId),
      );
      const matchesQB = query(
        collection(db, "matches"),
        where("teamBId", "==", teamId),
      );

      const [snapA, snapB] = await Promise.all([
        getDocs(matchesQA),
        getDocs(matchesQB),
      ]);

      const batchUpdates = [
        ...snapA.docs.map((d) =>
          updateDoc(doc(db, "matches", d.id), { teamAName: newName }),
        ),
        ...snapB.docs.map((d) =>
          updateDoc(doc(db, "matches", d.id), { teamBName: newName }),
        ),
      ];

      await Promise.all(batchUpdates);

      onAddPlayer();
      setShowEditTeamModal(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `teams/${showEditTeamModal.id}`,
      );
    }
  };

  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPlayerModal || !newPlayerName) return;
    setIsAddingPlayer(true);
    const playerPath = "players";
    try {
      const playerRef = await addDoc(collection(db, playerPath), {
        name: newPlayerName,
        teamId: showPlayerModal,
        role: newPlayerRole,
        photoUrl: null,
        matchesPlayed: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        totalDismissals: 0,
        centuries: 0,
        halfCenturies: 0,
        highestScore: 0,
        totalWickets: 0,
        totalRunsConceded: 0,
        totalBallsBowled: 0,
        fiveWicketHauls: 0,
        bestBowlingFigures: "0/0",
        strikeRate: 0,
        economyRate: 0,
        battingAverage: 0,
        bowlingAverage: 0,
      });

      await updateDoc(doc(db, "teams", showPlayerModal), {
        players: arrayUnion({ id: playerRef.id, name: newPlayerName }),
      });
      onAddPlayer();
      setShowPlayerModal(null);
      setNewPlayerName("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, playerPath);
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!confirmDeletePlayer) return;
    const { teamId, player } = confirmDeletePlayer;
    const teamPath = `teams/${teamId}`;
    try {
      const teamRef = doc(db, "teams", teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const currentPlayers = teamSnap.data().players || [];
        const updatedPlayers = currentPlayers.filter(
          (p: any) => p.id !== player.id,
        );
        await updateDoc(teamRef, { players: updatedPlayers });
      }

      await deleteDoc(doc(db, "players", player.id));
      onAddPlayer();
      setConfirmDeletePlayer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, teamPath);
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirmDeleteTeam) return;
    const teamId = confirmDeleteTeam;
    const path = `teams/${teamId}`;
    try {
      await deleteDoc(doc(db, "teams", teamId));
      setConfirmDeleteTeam(null);
      onAddPlayer();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  useEffect(() => {
    if (user && teams.length > 0) {
      return fetchUserRequests();
    }
  }, [user, teams]);

  const fetchUserRequests = () => {
    try {
      const q = query(
        collection(db, "joinRequests"),
        where("tournamentId", "==", teams[0]?.tournamentId),
      );
      const snap1 = onSnapshot(
        q,
        (s) => {
          setUserRequests(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "joinRequests");
        },
      );

      const qInv = query(
        collection(db, "invitations"),
        where("tournamentId", "==", teams[0]?.tournamentId),
      );
      const snap2 = onSnapshot(
        qInv,
        (s) => {
          setInvitations(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, "invitations");
        },
      );

      return () => {
        snap1();
        snap2();
      };
    } catch (err) {
      console.error("Error fetching requests:", err);
    }
  };

  const handleJoinRequest = async (teamId: string) => {
    if (!user) return alert("Please login to join a team");
    try {
      await addDoc(collection(db, "joinRequests"), {
        teamId,
        tournamentId: teams[0].tournamentId,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0],
        userPhotoUrl: user.photoURL || null,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      alert("Join request sent!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "joinRequests");
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showInviteModal || !inviteEmail) return;
    try {
      // In a real app, you'd search for the user by email first.
      // For this prototype, we'll just create an invitation.
      const team = teams.find(t => t.id === showInviteModal);
      if (!team) throw new Error("Team not found");
      
      await addDoc(collection(db, "invitations"), {
        teamId: showInviteModal,
        tournamentId: team.tournamentId,
        invitedEmail: inviteEmail,
        status: "pending",
        createdAt: new Date().toISOString(),
        invitedBy: user?.uid,
      });
      setShowInviteModal(null);
      setInviteEmail("");
      alert("Invitation sent!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "invitations");
    }
  };

  const handleApproveRequest = async (request: any) => {
    try {
      // 1. Create player from request
      const playerRef = await addDoc(collection(db, "players"), {
        name: request.userName,
        teamId: request.teamId,
        role: "batsman", // Default role
        photoUrl: request.userPhotoUrl,
        userId: request.userId,
        // ... other default stats
        matchesPlayed: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        totalDismissals: 0,
        centuries: 0,
        halfCenturies: 0,
        highestScore: 0,
        totalWickets: 0,
        totalRunsConceded: 0,
        totalBallsBowled: 0,
        fiveWicketHauls: 0,
        bestBowlingFigures: "0/0",
        strikeRate: 0,
        economyRate: 0,
        battingAverage: 0,
        bowlingAverage: 0,
      });

      // 2. Add to team's players array
      await updateDoc(doc(db, "teams", request.teamId), {
        players: arrayUnion({
          id: playerRef.id,
          name: request.userName,
          photoUrl: request.userPhotoUrl,
        }),
      });

      // 3. Mark request as approved
      await updateDoc(doc(db, "joinRequests", request.id), {
        status: "approved",
      });
      onAddPlayer();
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `joinRequests/${request.id}`,
      );
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "joinRequests", requestId), {
        status: "rejected",
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `joinRequests/${requestId}`,
      );
    }
  };

  const handlePhotoUpload = async (
    playerId: string,
    teamId: string,
    file: File,
  ) => {
    try {
      setUploadingPlayerId(playerId);
      const storageRef = ref(storage, `players/${playerId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const photoUrl = await getDownloadURL(storageRef);

      // Update player document
      try {
        await updateDoc(doc(db, "players", playerId), { photoUrl });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `players/${playerId}`);
      }

      // Update team document (denormalized cache)
      const teamRef = doc(db, "teams", teamId);
      try {
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const currentPlayers = teamSnap.data().players || [];
          const updatedPlayers = currentPlayers.map((p: any) =>
            p.id === playerId ? { ...p, photoUrl } : p,
          );
          await updateDoc(teamRef, { players: updatedPlayers });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `teams/${teamId}`);
      }
      
      // Update local state if needed
      if (onAddPlayer) onAddPlayer();
      
    } catch (err) {
      console.error("Photo upload failed", err);
      alert("Failed to upload photo. Please check your Firebase Storage settings and rules.");
    } finally {
      setUploadingPlayerId(null);
    }
  };

  const roleCounts = {
    all: teams.reduce((acc, t) => acc + (t.players?.length || 0), 0),
    batsman: teams.reduce(
      (acc, t) =>
        acc +
        (t.fullPlayers?.filter((p: any) => p.role === "batsman").length || 0),
      0,
    ),
    bowler: teams.reduce(
      (acc, t) =>
        acc +
        (t.fullPlayers?.filter((p: any) => p.role === "bowler").length || 0),
      0,
    ),
    "all-rounder": teams.reduce(
      (acc, t) =>
        acc +
        (t.fullPlayers?.filter((p: any) => p.role === "all-rounder").length ||
          0),
      0,
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 p-5 px-8 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand">
            <Activity size={18} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim italic block leading-none mb-1">
              Squad Filter
            </span>
            <span className="text-[9px] font-bold text-brand uppercase tracking-widest">
              {roleFilter === "all" ? "All Roles" : roleFilter + "s"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {isOrganizer && onAddTeam && (
            <button
              onClick={onAddTeam}
              className="w-full sm:w-auto px-6 py-3.5 bg-brand text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all transform hover:scale-[1.02] shadow-xl flex items-center justify-center gap-2"
            >
              <Plus size={14} strokeWidth={3} />
              Add Team
            </button>
          )}
          <div className="relative group w-full sm:min-w-[220px]">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 pr-12 text-[10px] font-black uppercase tracking-[0.2em] text-white outline-none focus:ring-2 focus:ring-brand hover:bg-white/10 transition-all cursor-pointer shadow-xl backdrop-blur-xl"
            >
              <option value="all" className="bg-bg-secondary text-white">
                Full Squad Stats ({roleCounts.all})
              </option>
              <option value="batsman" className="bg-bg-secondary text-white">
                Specialist Batsmen ({roleCounts.batsman})
              </option>
              <option value="bowler" className="bg-bg-secondary text-white">
                Strike Bowlers ({roleCounts.bowler})
              </option>
              <option
                value="all-rounder"
                className="bg-bg-secondary text-white"
              >
                Impact All-Rounders ({roleCounts["all-rounder"]})
              </option>
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim group-hover:text-brand transition-colors">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </div>

      {isOrganizer && userRequests.filter((r) => r.status === "pending").length > 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand/10 border border-brand/30 rounded-2xl flex items-center justify-center text-brand">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-brand tracking-widest italic">
                Pending Join Requests
              </h3>
              <p className="text-[10px] uppercase text-text-dim tracking-widest font-bold">
                Approve or reject team enrollments
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRequests
              .filter((r) => r.status === "pending")
              .map((req) => {
                const teamName = teams.find(t => t.id === req.teamId)?.name || 'Unknown Team';
                return (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.03] p-4 rounded-xl border border-white/5 gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                        {req.userPhotoUrl ? (
                          <img
                            src={req.userPhotoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={16} className="text-text-dim" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-white font-black italic uppercase tracking-tight block truncate">
                          {req.userName}
                        </span>
                        <span className="text-[10px] text-text-dim uppercase tracking-widest font-bold">
                          Joining: <span className="text-brand">{teamName}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveRequest(req)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-brand/10 hover:bg-brand text-brand hover:text-black rounded-lg transition-colors font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-bg-secondary border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 shadow-xl group hover:border-brand/40 transition-all flex flex-col"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1 overflow-hidden w-full sm:w-auto">
                <h3 className="text-xl sm:text-2xl font-black uppercase text-white italic tracking-tighter truncate group-hover:text-brand transition-colors">
                  {team.name}
                </h3>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest italic">
                    {team.players?.length || 0} Registered Players
                  </span>
                </div>
              </div>
              {isOrganizer && (
                <div className="shrink-0 flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md w-full sm:w-auto overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => {
                      setShowEditTeamModal(team);
                      setEditTeamName(team.name);
                    }}
                    className="p-2.5 hover:bg-white/10 text-white/40 hover:text-white transition-all rounded-xl"
                    title="Edit Team"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => setShowPlayerModal(team.id)}
                    className="p-2.5 hover:bg-brand/10 text-brand/60 hover:text-brand transition-all rounded-xl"
                    title="Add Player"
                  >
                    <UserPlus size={16} />
                  </button>
                  <button
                    onClick={() => setShowInviteModal(team.id)}
                    className="p-2.5 hover:bg-blue-500/10 text-blue-400/60 hover:text-blue-400 transition-all rounded-xl border border-transparent bg-white/5"
                    title="Invite via Email"
                  >
                    <Mail size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const url = getShareableUrl(
                        `${window.location.pathname}?joinTeam=${team.id}`,
                      );
                      navigator.clipboard.writeText(url);
                      setCopiedTeamId(team.id);
                      setTimeout(() => setCopiedTeamId(null), 2000);
                    }}
                    className={`p-2.5 transition-all rounded-xl border flex items-center justify-center ${
                      copiedTeamId === team.id
                        ? "bg-green-500 text-white border-green-500"
                        : "hover:bg-green-500/10 text-green-400/60 hover:text-green-400 border-transparent bg-white/5"
                    }`}
                    title="Copy Join Link"
                  >
                    {copiedTeamId === team.id ? (
                      <Check size={16} />
                    ) : (
                      <Link2 size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteTeam(team.id)}
                    className="p-2.5 hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition-all rounded-xl"
                    title="Delete Team"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {isOrganizer &&
              invitations.filter(
                (r) => r.teamId === team.id && r.status === "pending",
              ).length > 0 && (
                <div className="bg-blue-500/5 rounded-2xl p-6 space-y-4 border border-blue-500/10 border-dashed mb-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] italic">
                      Pending Invitations
                    </span>
                  </div>
                  <div className="space-y-2">
                    {invitations
                      .filter(
                        (r) => r.teamId === team.id && r.status === "pending",
                      )
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center border border-white/10">
                              <Mail size={14} className="text-text-dim" />
                            </div>
                            <span className="text-[11px] text-white font-black italic uppercase tracking-tight">
                              {inv.invitedEmail}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-[9px] uppercase tracking-widest text-text-dim font-bold flex items-center">
                              Sent
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {team.players && team.players.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {(team.fullPlayers || team.players)
                  .filter(
                    (p: any) => roleFilter === "all" || p.role === roleFilter,
                  )
                  .map((p: any) => {
                    const fullPlayer =
                      team.fullPlayers?.find((fp: any) => fp.id === p.id) || p;
                    const isExpanded = expandedPlayers.has(p.id);
                    const toggleExpand = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      const newSet = new Set(expandedPlayers);
                      if (newSet.has(p.id)) newSet.delete(p.id);
                      else newSet.add(p.id);
                      setExpandedPlayers(newSet);
                    };

                    return (
                      <div
                        key={p.id}
                        className="flex flex-col gap-2 p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-white transition-all group/player hover:bg-white/10"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer group/name"
                          onClick={toggleExpand}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center relative shadow-inner">
                                {uploadingPlayerId === p.id ? (
                                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                ) : fullPlayer.photoUrl ? (
                                  <img
                                    src={fullPlayer.photoUrl}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <User size={20} className="text-white/20" />
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="truncate font-black italic text-sm group-hover/name:text-brand transition-colors">
                                {p.name}
                              </span>
                              <div className="flex items-center gap-2 opacity-60">
                                <div
                                  className={`shrink-0 w-1.5 h-1.5 rounded-full ${fullPlayer.role === "all-rounder" ? "bg-brand" : fullPlayer.role === "bowler" ? "bg-blue-400" : "bg-red-400"}`}
                                ></div>
                                <span className="text-[8px] font-bold uppercase tracking-widest">
                                  {fullPlayer.role}
                                </span>
                                {(fullPlayer.totalRuns > 0 ||
                                  fullPlayer.totalWickets > 0) && (
                                  <div className="w-[1px] h-2 bg-white/20 mx-1" />
                                )}
                                {fullPlayer.totalRuns > 0 && (
                                  <span className="text-[7px] font-bold text-brand">
                                    R: {fullPlayer.totalRuns}
                                  </span>
                                )}
                                {fullPlayer.totalWickets > 0 && (
                                  <span className="text-[7px] font-bold text-blue-400">
                                    W: {fullPlayer.totalWickets}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-max">
                            {isOrganizer && (
                              <label
                                className="p-1.5 hover:text-brand transition-all cursor-pointer opacity-100 group-hover/player:bg-white/5 rounded-lg flex items-center justify-center shrink-0"
                                title="Upload Photo"
                              >
                                <Camera size={14} />
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handlePhotoUpload(p.id, team.id, file);
                                  }}
                                />
                              </label>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const pData = fullPlayer;
                                setShowStatsModal(pData);
                                setStatsForm({
                                  matchesPlayed: pData.matchesPlayed || 0,
                                  totalRuns: pData.totalRuns || 0,
                                  totalBallsFaced: pData.totalBallsFaced || 0,
                                  totalDismissals: pData.totalDismissals || 0,
                                  centuries: pData.centuries || 0,
                                  halfCenturies: pData.halfCenturies || 0,
                                  highestScore: pData.highestScore || 0,
                                  fours: pData.fours || 0,
                                  sixes: pData.sixes || 0,
                                  totalWickets: pData.totalWickets || 0,
                                  totalRunsConceded:
                                    pData.totalRunsConceded || 0,
                                  totalBallsBowled: pData.totalBallsBowled || 0,
                                  maidens: pData.maidens || 0,
                                  fourWicketHauls: pData.fourWicketHauls || 0,
                                  fiveWicketHauls: pData.fiveWicketHauls || 0,
                                  bestBowlingFigures:
                                    pData.bestBowlingFigures || "",
                                  strikeRate: pData.strikeRate || 0,
                                  economyRate: pData.economyRate || 0,
                                  battingAverage: pData.battingAverage || 0,
                                  bowlingAverage: pData.bowlingAverage || 0,
                                  matchLogs: pData.matchLogs || [],
                                });
                              }}
                              className="p-1.5 hover:text-brand transition-all flex items-center justify-center rounded-lg"
                              title="Detailed Profile"
                            >
                              <BarChart2
                                size={14}
                                className="text-text-dim group-hover/player:text-brand transition-all shrink-0"
                              />
                            </button>
                            {isOrganizer && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeletePlayer({
                                    teamId: team.id,
                                    player: p,
                                  });
                                }}
                                className="p-1.5 hover:text-red-500 transition-all cursor-pointer opacity-0 group-hover/player:opacity-100 shrink-0"
                                title="Remove Player"
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              className="p-1 text-text-dim"
                            >
                              <ChevronDown size={14} />
                            </motion.div>
                          </div>
                        </div>

                        <motion.div
                          initial={false}
                          animate={{
                            height: isExpanded ? "auto" : 0,
                            opacity: isExpanded ? 1 : 0,
                          }}
                          className="overflow-hidden"
                        >
                          {fullPlayer && (
                            <div className="space-y-4 border-t border-white/5 pt-4">
                              {/* Batting Stats */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Activity size={10} className="text-brand" />
                                  <span className="text-[8px] font-black uppercase text-brand/60 tracking-wider">
                                    Batting Performance
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-[7px] text-text-dim mb-1">
                                      Runs
                                    </span>
                                    <span className="block font-black text-white text-xs italic">
                                      {fullPlayer.totalRuns || 0}
                                    </span>
                                  </div>
                                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-[7px] text-text-dim mb-1">
                                      100s
                                    </span>
                                    <span className="block font-black text-white text-xs italic">
                                      {fullPlayer.centuries || 0}
                                    </span>
                                  </div>
                                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-[7px] text-text-dim mb-1">
                                      HS
                                    </span>
                                    <span className="block font-black text-white text-xs italic">
                                      {fullPlayer.highestScore || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Bowling Stats */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Activity
                                    size={10}
                                    className="text-blue-400"
                                  />
                                  <span className="text-[8px] font-black uppercase text-blue-400/60 tracking-wider">
                                    Bowling Performance
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-[7px] text-text-dim mb-1">
                                      Wickets
                                    </span>
                                    <span className="block font-black text-white text-xs italic">
                                      {fullPlayer.totalWickets || 0}
                                    </span>
                                  </div>
                                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-[7px] text-text-dim mb-1">
                                      Best Fig.
                                    </span>
                                    <span className="block font-black text-white text-xs italic">
                                      {fullPlayer.bestBowlingFigures || "-"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[7px] font-mono text-text-dim italic opacity-50 px-1 pt-1">
                                <span>
                                  Matches: {fullPlayer.matchesPlayed || 0}
                                </span>
                                <span>
                                  Avg: {fullPlayer.battingAverage || 0} /{" "}
                                  {fullPlayer.bowlingAverage || 0}
                                </span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-text-dim/40 text-[10px] font-bold uppercase tracking-[0.2em] text-center py-6 bg-white/5 rounded-xl border border-dashed border-white/10 uppercase">
                No players registered
              </p>
            )}

            {isOrganizer && (
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={() => setShowPlayerModal(team.id)}
                  className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-brand hover:border-brand/40 hover:bg-brand/5 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={14} />
                  Add New Player
                </button>
                <button
                  onClick={() => setShowInviteModal(team.id)}
                  className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-blue-400 hover:border-blue-400/40 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={14} />
                  Invite User
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Player Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">
              Add Player to Team
            </h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Player Name
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Virat Kohli"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Player Role
                </label>
                <div className="flex gap-2">
                  {(["batsman", "bowler", "all-rounder"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewPlayerRole(r)}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${newPlayerRole === r ? "bg-brand text-black border-brand" : "bg-white/5 text-text-dim border-white/5 hover:border-white/20"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(null)}
                  disabled={isAddingPlayer}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingPlayer}
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {isAddingPlayer ? "Adding..." : "Add Player"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">
              Edit Team Name
            </h2>
            <form onSubmit={handleEditTeam} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Royal Challengers"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditTeamModal(null)}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Player Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl my-8"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white italic">
                  Player Statistics
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand mt-1">
                  {showStatsModal.name}
                </p>
              </div>
              <button
                onClick={() => setShowStatsModal(null)}
                className="p-2 hover:bg-white/5 rounded-xl text-text-dim hover:text-white transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateStats} className="space-y-8">
              {/* General Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-dim italic border-b border-white/5 pb-2">
                  General Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatInput
                    label="Matches Played"
                    value={statsForm.matchesPlayed}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, matchesPlayed: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                </div>
              </div>

              {/* Batting Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-brand italic border-b border-brand/20 pb-2">
                  Batting Career Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatInput
                    label="Total Runs"
                    value={statsForm.totalRuns}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, totalRuns: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Balls Faced"
                    value={statsForm.totalBallsFaced}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, totalBallsFaced: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Highest Score"
                    value={statsForm.highestScore}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, highestScore: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Batting Avg"
                    value={statsForm.battingAverage}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, battingAverage: Number(v) })
                    }
                    type="number"
                    step="0.01"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Batting SR"
                    value={statsForm.strikeRate}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, strikeRate: Number(v) })
                    }
                    type="number"
                    step="0.01"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Dismissals"
                    value={statsForm.totalDismissals}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, totalDismissals: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Centuries"
                    value={statsForm.centuries}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, centuries: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Half Centuries"
                    value={statsForm.halfCenturies}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, halfCenturies: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Fours"
                    value={statsForm.fours}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, fours: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Sixes"
                    value={statsForm.sixes}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, sixes: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                </div>
              </div>

              {/* Bowling Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 italic border-b border-blue-400/20 pb-2">
                  Bowling Career Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatInput
                    label="Total Wickets"
                    value={statsForm.totalWickets}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, totalWickets: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Balls Bowled"
                    value={statsForm.totalBallsBowled}
                    onChange={(v) =>
                      setStatsForm({
                        ...statsForm,
                        totalBallsBowled: Number(v),
                      })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Runs Conceded"
                    value={statsForm.totalRunsConceded}
                    onChange={(v) =>
                      setStatsForm({
                        ...statsForm,
                        totalRunsConceded: Number(v),
                      })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Maidens"
                    value={statsForm.maidens}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, maidens: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Economy"
                    value={statsForm.economyRate}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, economyRate: Number(v) })
                    }
                    type="number"
                    step="0.01"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Bowling Avg"
                    value={statsForm.bowlingAverage}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, bowlingAverage: Number(v) })
                    }
                    type="number"
                    step="0.01"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="4 Wicket Hauls"
                    value={statsForm.fourWicketHauls}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, fourWicketHauls: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="5 Wicket Hauls"
                    value={statsForm.fiveWicketHauls}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, fiveWicketHauls: Number(v) })
                    }
                    type="number"
                    readOnly={!isOrganizer}
                  />
                  <StatInput
                    label="Best Figures"
                    value={statsForm.bestBowlingFigures}
                    onChange={(v) =>
                      setStatsForm({ ...statsForm, bestBowlingFigures: v })
                    }
                    type="text"
                    placeholder="e.g. 5/12"
                    readOnly={!isOrganizer}
                  />
                </div>
              </div>

              {/* Match Logs Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 italic">
                    Match Logs
                  </h3>
                  {isOrganizer && (
                    <button
                      type="button"
                      onClick={() =>
                        setStatsForm({
                          ...statsForm,
                          matchLogs: [
                            ...statsForm.matchLogs,
                            {
                              opponent: "",
                              date: "",
                              runsScored: 0,
                              ballsFaced: 0,
                              fours: 0,
                              sixes: 0,
                              wickets: 0,
                              runsConceded: 0,
                              ballsBowled: 0,
                              maidens: 0,
                            },
                          ],
                        })
                      }
                      className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 hover:text-white transition-colors bg-emerald-400/10 px-3 py-1.5 rounded-lg"
                    >
                      + Add Match Log
                    </button>
                  )}
                </div>
                {statsForm.matchLogs.length > 0 ? (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {statsForm.matchLogs.map((log: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4 relative group"
                      >
                        {isOrganizer && (
                          <button
                            type="button"
                            onClick={() =>
                              setStatsForm({
                                ...statsForm,
                                matchLogs: statsForm.matchLogs.filter(
                                  (_, i) => i !== idx,
                                ),
                              })
                            }
                            className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <StatInput
                            label="Opponent"
                            value={log.opponent}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].opponent = v;
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="text"
                            readOnly={!isOrganizer}
                            placeholder="e.g. Eagles"
                          />
                          <StatInput
                            label="Date"
                            value={log.date}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].date = v;
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="date"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Runs"
                            value={log.runsScored}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].runsScored = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Balls"
                            value={log.ballsFaced}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].ballsFaced = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Fours"
                            value={log.fours}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].fours = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Sixes"
                            value={log.sixes}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].sixes = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Wickets"
                            value={log.wickets}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].wickets = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Runs Conceded"
                            value={log.runsConceded}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].runsConceded = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Balls Bowled"
                            value={log.ballsBowled}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].ballsBowled = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                          <StatInput
                            label="Maidens"
                            value={log.maidens}
                            onChange={(v) => {
                              const ne = [...statsForm.matchLogs];
                              ne[idx].maidens = Number(v);
                              setStatsForm({ ...statsForm, matchLogs: ne });
                            }}
                            type="number"
                            readOnly={!isOrganizer}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-white/40 uppercase tracking-widest text-center py-8 font-bold border border-white/5 border-dashed rounded-2xl">
                    No match logs recorded
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowStatsModal(null)}
                  className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/10 transition-all"
                >
                  Close
                </button>
                {isOrganizer && (
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-brand text-black rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-white transition-all shadow-lg shadow-brand/20"
                  >
                    Save Statistics
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {confirmDeleteTeam && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setConfirmDeleteTeam(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white italic">
                  Delete Team?
                </h2>
                <p className="text-text-dim text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  This action is permanent and will remove all players from this
                  team.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={handleDeleteTeam}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-600 transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteTeam(null)}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Player Confirmation Modal */}
      <AnimatePresence>
        {confirmDeletePlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setConfirmDeletePlayer(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserMinus size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white italic">
                  Remove Player?
                </h2>
                <p className="text-text-dim text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  Are you sure you want to remove{" "}
                  <span className="text-white">
                    {confirmDeletePlayer.player.name}
                  </span>{" "}
                  from the team?
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={handleDeletePlayer}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-600 transition-colors"
                >
                  Confirm Removal
                </button>
                <button
                  onClick={() => setConfirmDeletePlayer(null)}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite User Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setShowInviteModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <h2 className="text-lg sm:text-xl font-black uppercase mb-6 tracking-tighter text-white italic">
                Invite User
              </h2>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    User Email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(null)}
                    className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white"
                  >
                    Invite
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MatchDetailsModal({
  match,
  balls,
  loading,
  onClose,
}: {
  match: any;
  balls: any[];
  loading: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<
    "scorecard" | "stats" | "summary" | "timeline" | "players"
  >("scorecard");

  // Aggregation logic for individual stats
  const getInningsStats = (innings: number) => {
    const inningsBalls = balls.filter((b) => b.innings === innings);
    const batsmenMap: Record<string, any> = {};
    const bowlersMap: Record<string, any> = {};

    inningsBalls.forEach((ball) => {
      // Batting Stats
      const strikerId = ball.strikerId || "unknown_bat";
      if (!batsmenMap[strikerId]) {
        batsmenMap[strikerId] = {
          id: strikerId,
          name: ball.strikerName || "Unknown",
          photoUrl: ball.strikerPhotoUrl || null,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          out: false,
          dismissal: "",
        };
      }

      const isExtraBall = ball.extraType === "wide" || ball.extraType === "nb";
      if (!isExtraBall) {
        batsmenMap[strikerId].balls += 1;
      }

      // Batsman runs (exclude extras for their personal tally)
      batsmenMap[strikerId].runs += ball.runs || 0;
      if (ball.runs === 4) batsmenMap[strikerId].fours += 1;
      if (ball.runs === 6) batsmenMap[strikerId].sixes += 1;

      if (ball.isWicket) {
        batsmenMap[strikerId].out = true;
        batsmenMap[strikerId].dismissal = ball.wicketType
          ? `b ${ball.bowlerName} (${ball.wicketType})`
          : `b ${ball.bowlerName}`;
      }

      // Bowling Stats
      const bowlerId = ball.bowlerId || "unknown_bowl";
      if (!bowlersMap[bowlerId]) {
        bowlersMap[bowlerId] = {
          id: bowlerId,
          name: ball.bowlerName || "Unknown",
          photoUrl: ball.bowlerPhotoUrl || null,
          balls: 0,
          runs: 0,
          wickets: 0,
          dots: 0,
          fours: 0,
          sixes: 0,
        };
      }

      if (!isExtraBall) {
        bowlersMap[bowlerId].balls += 1;
      }

      // Runs conceded: Includes extras except byes/leg-byes
      if (ball.extraType !== "bye" && ball.extraType !== "lb") {
        const totalConceded = (ball.runs || 0) + (ball.extra || 0);
        bowlersMap[bowlerId].runs += totalConceded;
        if (totalConceded === 0) bowlersMap[bowlerId].dots += 1;
        if (ball.runs === 4) bowlersMap[bowlerId].fours += 1;
        if (ball.runs === 6) bowlersMap[bowlerId].sixes += 1;
      }

      if (ball.isWicket && ball.wicketType !== "run out") {
        bowlersMap[bowlerId].wickets += 1;
      }
    });

    return {
      batsmen: Object.values(batsmenMap).sort((a, b) => b.runs - a.runs),
      bowlers: Object.values(bowlersMap).sort(
        (a, b) => b.wickets - a.wickets || a.runs - b.runs,
      ),
    };
  };

  const getMatchPlayerStats = () => {
    const inn1 = getInningsStats(1);
    const inn2 = getInningsStats(2);

    const combined: Record<string, any> = {};

    const processStats = (stats: any[], type: "batting" | "bowling") => {
      stats.forEach((s: any) => {
        if (!combined[s.id]) {
          combined[s.id] = {
            id: s.id,
            name: s.name,
            photoUrl: s.photoUrl,
            batting: null,
            bowling: null,
          };
        }
        combined[s.id][type] = s;
      });
    };

    processStats(inn1.batsmen, "batting");
    processStats(inn1.bowlers, "bowling");
    processStats(inn2.batsmen, "batting");
    processStats(inn2.bowlers, "bowling");

    return Object.values(combined).sort((a: any, b: any) => {
      const scoreA = (a.batting?.runs || 0) + (a.bowling?.wickets || 0) * 20;
      const scoreB = (b.batting?.runs || 0) + (b.bowling?.wickets || 0) * 20;
      return scoreB - scoreA;
    });
  };

  const getMatchSummary = () => {
    const inn1 = getInningsStats(1);
    const inn2 = getInningsStats(2);

    const allPerformers: any[] = [];

    [...inn1.batsmen, ...inn2.batsmen].forEach((p) => {
      allPerformers.push({ ...p, type: "batting", score: p.runs });
    });

    [...inn1.bowlers, ...inn2.bowlers].forEach((p) => {
      // Wicket is worth roughly 20-30 runs in performance weight
      allPerformers.push({
        ...p,
        type: "bowling",
        score: p.wickets * 25 - p.runs / 2,
      });
    });

    return allPerformers.sort((a, b) => b.score - a.score).slice(0, 4);
  };

  const getMatchStats = () => {
    const stats = {
      teamA: {
        dots: 0,
        fours: 0,
        sixes: 0,
        extras: { wd: 0, nb: 0, b: 0, lb: 0 },
        totalExtras: 0,
      },
      teamB: {
        dots: 0,
        fours: 0,
        sixes: 0,
        extras: { wd: 0, nb: 0, b: 0, lb: 0 },
        totalExtras: 0,
      },
    };

    balls.forEach((ball) => {
      const team = ball.innings === 1 ? stats.teamA : stats.teamB;
      if (ball.runs === 0 && !ball.extraType) team.dots += 1;
      if (ball.runs === 4) team.fours += 1;
      if (ball.runs === 6) team.sixes += 1;
      if (ball.extraType) {
        team.totalExtras += ball.extra || 0;
        if (ball.extraType === "wd") team.extras.wd += ball.extra || 0;
        if (ball.extraType === "nb") team.extras.nb += ball.extra || 0;
        if (ball.extraType === "b") team.extras.b += ball.extra || 0;
        if (ball.extraType === "lb") team.extras.lb += ball.extra || 0;
      }
    });

    return stats;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-[110] p-4 bg-black/50 hover:bg-brand hover:text-black border border-white/10 hover:border-brand rounded-full text-white backdrop-blur-md transition-all shadow-2xl opacity-70 hover:opacity-100"
      >
        <X size={24} />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-secondary border border-white/10 rounded-[3rem] p-6 md:p-12 w-full max-w-5xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] my-8 relative overflow-hidden mt-24 md:mt-12"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 blur-[120px] rounded-full -mr-48 -mt-48" />

        <div className="flex justify-between items-start mb-10 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1.5 h-10 bg-brand rounded-full" />
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white italic leading-none">
                {match.status === "live"
                  ? "Live Match Center"
                  : "Match Analytics"}
              </h2>
              {match.status === "live" && (
                <div className="px-3 py-1 bg-red-600/10 border border-red-600/20 rounded-full flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-red-500 tracking-widest italic">
                    Live Sync
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-dim ml-4">
              {match.teamAName} <span className="text-brand">Vs</span>{" "}
              {match.teamBName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-text-dim hover:text-white transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex gap-4 md:gap-8 mb-10 border-b border-white/5 relative z-10 overflow-x-auto no-scrollbar">
          {[
            {
              id: "scorecard",
              label: "Scorecard",
              icon: <BarChart2 size={14} />,
            },
            { id: "stats", label: "Stats", icon: <Activity size={14} /> },
            { id: "players", label: "Players", icon: <Users size={14} /> },
            { id: "summary", label: "Impact", icon: <Trophy size={14} /> },
            {
              id: "timeline",
              label: match.status === "live" ? "Commentary" : "Timeline",
              icon: <Calendar size={14} />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest italic transition-all pb-4 border-b-2 shrink-0 ${activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-text-dim hover:text-white"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="relative z-10">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-text-dim animate-pulse">
                Syncing Match Data
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {activeTab === "scorecard" && (
                <div className="space-y-16 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  {match.status === "completed" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 bg-brand text-black rounded-[2rem] text-center font-black uppercase italic tracking-widest text-xl shadow-2xl shadow-brand/20"
                    >
                      {match.score.teamA.runs > match.score.teamB.runs
                        ? `${match.teamAName} won by ${match.score.teamA.runs - match.score.teamB.runs} runs`
                        : match.score.teamB.runs > match.score.teamA.runs
                          ? `${match.teamBName} won by ${10 - match.score.teamB.wickets} wickets`
                          : "Match Tied"}
                    </motion.div>
                  )}

                  {[
                    {
                      name: match.teamAName,
                      score: match.score.teamA,
                      innings: 1,
                    },
                    {
                      name: match.teamBName,
                      score: match.score.teamB,
                      innings: 2,
                    },
                  ].map((t, i) => {
                    const { batsmen, bowlers } = getInningsStats(t.innings);
                    const inningsBalls = balls.filter(
                      (b) => b.innings === t.innings,
                    );
                    const extras = inningsBalls.reduce(
                      (acc, b) => acc + (b.extra || 0),
                      0,
                    );

                    if (batsmen.length === 0 && bowlers.length === 0)
                      return null;

                    return (
                      <div key={`innings-${t.innings}`} className="space-y-8">
                        <div className="flex items-end justify-between border-b-2 border-white/5 pb-4">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-brand mb-1">
                              Innings {t.innings}
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black uppercase text-white italic tracking-tight">
                              {t.name}
                            </h3>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl sm:text-4xl font-black italic text-white tracking-tighter">
                              {t.score.runs}
                              <span className="text-brand text-2xl">/</span>
                              {t.score.wickets}
                            </div>
                            <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                              ({t.score.overs} Overs)
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-12">
                          {/* Batting Card */}
                          <div className="space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
                              Batting Summary
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="text-[9px] font-black uppercase tracking-widest text-text-dim border-b border-white/5">
                                    <th className="py-2 sm:py-4 px-1 sm:px-2">
                                      Batsman
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      R
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      B
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      4s
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      6s
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      SR
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {batsmen.map((b, idx) => (
                                    <tr
                                      key={idx}
                                      className="text-xs group hover:bg-white/[0.02] transition-colors"
                                    >
                                      <td className="py-3 sm:py-5 px-1 sm:px-2">
                                        <div className="font-black italic uppercase text-white tracking-tight text-xs sm:text-sm">
                                          {b.name}
                                        </div>
                                        <div className="text-[8px] font-bold text-text-dim uppercase mt-1 tracking-widest opacity-60">
                                          {b.out ? b.dismissal : "Not Out"}
                                        </div>
                                      </td>
                                      <td className="py-3 sm:py-5 px-1 sm:px-2 text-right font-black italic text-xs sm:text-sm">
                                        {b.runs}
                                      </td>
                                      <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-mono">
                                        {b.balls}
                                      </td>
                                      <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-mono">
                                        {b.fours}
                                      </td>
                                      <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-mono">
                                        {b.sixes}
                                      </td>
                                      <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-brand font-black italic">
                                        {b.balls > 0
                                          ? ((b.runs / b.balls) * 100).toFixed(
                                              1,
                                            )
                                          : "0.0"}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="text-[10px] font-black bg-white/5 rounded-xl">
                                    <td className="py-3 sm:py-4 px-2 sm:px-4 uppercase italic text-text-dim">
                                      Extras
                                    </td>
                                    <td
                                      colSpan={5}
                                      className="py-3 sm:py-4 px-2 sm:px-4 text-right italic font-mono text-white"
                                    >
                                      {extras}{" "}
                                      <span className="text-[8px] font-bold opacity-30 ml-1 sm:ml-2">
                                        (WD, NB, B, LB)
                                      </span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Bowling Card */}
                          <div className="space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/40 mb-2">
                              Bowling Analysis
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="text-[9px] font-black uppercase tracking-widest text-text-dim border-b border-white/5">
                                    <th className="py-2 sm:py-4 px-1 sm:px-2">
                                      Bowler
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      O
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      M
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      R
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      W
                                    </th>
                                    <th className="py-2 sm:py-4 px-1 sm:px-2 text-right">
                                      Econ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {bowlers.map((b, idx) => {
                                    const overs = `${Math.floor(b.balls / 6)}.${b.balls % 6}`;
                                    return (
                                      <tr
                                        key={idx}
                                        className="text-xs group hover:bg-white/[0.02] transition-colors"
                                      >
                                        <td className="py-3 sm:py-5 px-1 sm:px-2">
                                          <div className="font-black italic uppercase text-white tracking-tight text-xs sm:text-sm">
                                            {b.name}
                                          </div>
                                        </td>
                                        <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-mono">
                                          {overs}
                                        </td>
                                        <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-mono">
                                          {Math.floor(b.dots / 6)}
                                        </td>
                                        <td className="py-3 sm:py-5 px-1 sm:px-2 text-right font-black italic text-xs sm:text-sm">
                                          {b.runs}
                                        </td>
                                        <td className="py-3 sm:py-5 px-1 sm:px-2 text-right font-black text-brand italic text-base sm:text-lg">
                                          {b.wickets}
                                        </td>
                                        <td className="py-3 sm:py-5 px-1 sm:px-2 text-right text-text-dim font-black italic">
                                          {b.balls > 0
                                            ? ((b.runs / b.balls) * 6).toFixed(
                                                2,
                                              )
                                            : "0.00"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "stats" && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
                    {[
                      { name: match.teamAName, stats: getMatchStats().teamA },
                      { name: match.teamBName, stats: getMatchStats().teamB },
                    ].map((t, idx) => (
                      <div key={idx} className="space-y-6">
                        <h3 className="text-xl sm:text-2xl font-black uppercase italic text-white border-b border-white/5 pb-2">
                          {t.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
                            <div className="text-xl sm:text-2xl font-black text-brand italic">
                              {t.stats.dots}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                              Dot Balls
                            </div>
                          </div>
                          <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
                            <div className="text-xl sm:text-2xl font-black text-white italic">
                              {t.stats.fours}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                              Fours (4s)
                            </div>
                          </div>
                          <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
                            <div className="text-xl sm:text-2xl font-black text-white italic">
                              {t.stats.sixes}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                              Sixes (6s)
                            </div>
                          </div>
                          <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
                            <div className="text-xl sm:text-2xl font-black text-brand italic">
                              {t.stats.totalExtras}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
                              Extra Runs
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3">
                          <div className="text-[9px] font-black uppercase tracking-widest text-text-dim border-b border-white/5 pb-2">
                            Extras Breakdown
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-dim uppercase font-bold tracking-widest">
                              Wide (WD)
                            </span>
                            <span className="font-black italic text-white">
                              {t.stats.extras.wd}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-dim uppercase font-bold tracking-widest">
                              No Ball (NB)
                            </span>
                            <span className="font-black italic text-white">
                              {t.stats.extras.nb}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-dim uppercase font-bold tracking-widest">
                              Bye (B)
                            </span>
                            <span className="font-black italic text-white">
                              {t.stats.extras.b}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-dim uppercase font-bold tracking-widest">
                              Leg Bye (LB)
                            </span>
                            <span className="font-black italic text-white">
                              {t.stats.extras.lb}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "players" && (
                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {getMatchPlayerStats().map((p: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex items-center gap-6"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User size={32} className="text-white/10" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-black uppercase italic text-white truncate mb-4">
                            {p.name}
                          </h4>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {p.batting ? (
                              <div className="space-y-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-brand">
                                  Batting
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-lg sm:text-xl font-black italic text-white">
                                    {p.batting.runs}
                                  </span>
                                  <span className="text-[10px] font-mono text-text-dim">
                                    ({p.batting.balls})
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-text-dim uppercase tracking-tighter">
                                  {p.batting.fours}x4s • {p.batting.sixes}x6s
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1 opacity-20">
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                                  DNB
                                </div>
                              </div>
                            )}
                            {p.bowling ? (
                              <div className="space-y-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                  Bowling
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-lg sm:text-xl font-black italic text-white">
                                    {p.bowling.wickets}
                                  </span>
                                  <span className="text-xs font-black italic text-text-dim">
                                    / {p.bowling.runs}
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-text-dim uppercase tracking-tighter">
                                  {Math.floor(p.bowling.balls / 6)}.
                                  {p.bowling.balls % 6} Overs •{" "}
                                  {(
                                    (p.bowling.runs / p.bowling.balls) *
                                    6
                                  ).toFixed(1)}{" "}
                                  Eco
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1 opacity-20">
                                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                                  DNB
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "summary" && (
                <div className="space-y-10">
                  {match.aiSummary && (
                    <div className="bg-gradient-to-br from-brand/10 via-transparent to-transparent border border-brand/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-brand/20 text-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/10">
                          <Star size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-white italic">
                            AI Match Summary
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80">
                            Gemini Generated
                          </p>
                        </div>
                      </div>
                      <div className="prose prose-invert prose-brand max-w-none text-sm md:text-base leading-relaxed opacity-90 marker:text-brand font-medium">
                        <Markdown>{match.aiSummary}</Markdown>
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-12">
                    <Trophy
                      size={48}
                      className="mx-auto text-brand mb-4 animate-bounce"
                    />
                    <h3 className="text-2xl sm:text-3xl font-black uppercase italic text-white">
                      Impact Performers
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-dim">
                      Match-winning contributions
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {getMatchSummary().map((p, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4 hover:border-brand/40 transition-all hover:translate-y-[-5px]"
                      >
                        <div
                          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center font-black italic text-2xl ${p.type === "batting" ? "bg-brand text-black shadow-lg shadow-brand/20" : "bg-blue-500 text-white shadow-lg shadow-blue-500/20"}`}
                        >
                          {p.type === "batting" ? "BAT" : "BWL"}
                        </div>
                        <div>
                          <div className="font-black uppercase italic text-lg text-white mb-1">
                            {p.name}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim">
                            {p.type === "batting" ? "Batter" : "Bowler"}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-white/5 space-y-2">
                          {p.type === "batting" ? (
                            <>
                              <div className="text-2xl sm:text-3xl font-black italic text-brand">
                                {p.runs}
                              </div>
                              <div className="text-[10px] font-mono text-text-dim">
                                {p.balls} Balls • {p.fours}x4s • {p.sixes}x6s
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl sm:text-3xl font-black italic text-blue-400">
                                {p.wickets}
                                <span className="text-sm opacity-50 mx-1">
                                  W
                                </span>
                                {p.runs}
                                <span className="text-sm opacity-50 ml-1">
                                  R
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-text-dim">
                                {Math.floor(p.balls / 6)}.{p.balls % 6} Overs •{" "}
                                {p.dots} Dots
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {balls.length > 0 && (
                    <div className="mt-16 space-y-12">
                      <div className="text-center">
                        <Activity
                          size={48}
                          className="mx-auto text-blue-400 mb-4"
                        />
                        <h3 className="text-2xl sm:text-3xl font-black uppercase italic text-white">
                          Data Visualizations
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-dim">
                          Wagon Wheel & Run Rate
                        </p>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-8">
                        {(() => {
                          const regions: Record<string, number> = {};
                          balls.forEach((b) => {
                            if (b.region && b.runs > 0 && !b.isWicket) {
                              regions[b.region] =
                                (regions[b.region] || 0) + b.runs;
                            }
                          });
                          const pieData = Object.entries(regions).map(
                            ([name, value]) => ({ name, value }),
                          );
                          const COLORS = [
                            "#E2FF00",
                            "#3b82f6",
                            "#10b981",
                            "#f59e0b",
                            "#ef4444",
                            "#8b5cf6",
                            "#ec4899",
                            "#14b8a6",
                            "#f97316",
                          ];
                          if (pieData.length === 0)
                            return (
                              <div className="bg-bg-secondary border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center opacity-50 h-[400px]">
                                <MapPin
                                  size={48}
                                  className="mb-4 text-text-dim"
                                />
                                <h4 className="text-lg font-bold">
                                  Wagon Wheel
                                </h4>
                                <p className="text-xs">
                                  No region data recorded for this match.
                                </p>
                              </div>
                            );
                          return (
                            <div className="bg-bg-secondary border border-white/5 rounded-3xl p-8 shadow-xl h-[400px] flex flex-col relative">
                              <h4 className="text-center text-sm font-black uppercase tracking-widest text-text-dim mb-4 italic">
                                Wagon Wheel (Runs)
                              </h4>
                              <div className="flex-1 w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={120}
                                      innerRadius={60}
                                      dataKey="value"
                                      nameKey="name"
                                      stroke="#1A1A1A"
                                      strokeWidth={2}
                                      label={({ name, value }) =>
                                        `${name} (${value})`
                                      }
                                      labelLine={false}
                                    >
                                      {pieData.map((entry, index) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={COLORS[index % COLORS.length]}
                                        />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip
                                      contentStyle={{
                                        backgroundColor: "#1A1A1A",
                                        borderColor: "#333",
                                        borderRadius: "1rem",
                                        border:
                                          "1px solid rgba(255,255,255,0.1)",
                                      }}
                                      itemStyle={{
                                        color: "#E2FF00",
                                        fontWeight: "bold",
                                      }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })()}

                        {(() => {
                          let cumA = 0;
                          let cumB = 0;
                          const overData: Record<number, any> = {};
                          balls.forEach((b) => {
                            const o = Math.floor(b.overs || 0);
                            if (!overData[o])
                              overData[o] = {
                                over: o + 1,
                                teamA: cumA,
                                teamB: cumB,
                              };
                            if (b.innings === 1) {
                              cumA += (b.runs || 0) + (b.extra || 0);
                              overData[o].teamA = cumA;
                            } else {
                              cumB += (b.runs || 0) + (b.extra || 0);
                              overData[o].teamB = cumB;
                            }
                          });
                          const chartData = Object.values(overData).sort(
                            (a: any, b: any) => a.over - b.over,
                          );

                          return (
                            <div className="bg-bg-secondary border border-white/5 rounded-3xl p-8 shadow-xl h-[400px] flex flex-col relative">
                              <h4 className="text-center text-sm font-black uppercase tracking-widest text-text-dim mb-4 italic">
                                Worm Chart (Cumulative Runs)
                              </h4>
                              <div className="flex-1 w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart
                                    data={chartData}
                                    margin={{
                                      top: 10,
                                      right: 10,
                                      left: -20,
                                      bottom: 0,
                                    }}
                                  >
                                    <CartesianGrid
                                      strokeDasharray="3 3"
                                      stroke="rgba(255,255,255,0.05)"
                                    />
                                    <XAxis
                                      dataKey="over"
                                      stroke="rgba(255,255,255,0.3)"
                                      tick={{
                                        fill: "rgba(255,255,255,0.5)",
                                        fontSize: 10,
                                      }}
                                    />
                                    <YAxis
                                      stroke="rgba(255,255,255,0.3)"
                                      tick={{
                                        fill: "rgba(255,255,255,0.5)",
                                        fontSize: 10,
                                      }}
                                    />
                                    <RechartsTooltip
                                      contentStyle={{
                                        backgroundColor: "#1A1A1A",
                                        borderRadius: "1rem",
                                        border:
                                          "1px solid rgba(255,255,255,0.1)",
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="teamA"
                                      name={match.teamAName || "Team A"}
                                      stroke="#E2FF00"
                                      strokeWidth={3}
                                      dot={false}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="teamB"
                                      name={match.teamBName || "Team B"}
                                      stroke="#3b82f6"
                                      strokeWidth={3}
                                      dot={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "timeline" && (
                <div className="space-y-10">
                  {balls.length > 0 ? (
                    <div className="space-y-12 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                      {[1, 2].reverse().map((inn) => {
                        const innBalls = balls.filter((b) => b.innings === inn);
                        if (innBalls.length === 0) return null;

                        // Group balls by over
                        const overs: any[] = [];
                        innBalls.forEach((ball, idx) => {
                          const overNum =
                            ball.over !== undefined
                              ? ball.over
                              : Math.floor(idx / 6);
                          if (!overs[overNum]) overs[overNum] = [];
                          overs[overNum].push(ball);
                        });

                        return (
                          <div key={inn} className="space-y-6">
                            <div className="sticky top-0 z-10 bg-bg-secondary/80 backdrop-blur-md py-2 border-b border-brand/20">
                              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-brand italic">
                                Innings {inn} Timeline
                              </div>
                            </div>
                            <div className="space-y-4">
                              {overs
                                .slice()
                                .reverse()
                                .map((overBalls, overIdx) => (
                                  <div
                                    key={overIdx}
                                    className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:bg-white/10 transition-all"
                                  >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                      <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-brand text-black rounded-full flex flex-col items-center justify-center font-black italic shadow-lg shadow-brand/20">
                                          <span className="text-[10px] opacity-40 leading-none mb-0.5">
                                            OVER
                                          </span>
                                          <span className="text-xl leading-none">
                                            {overs.length - 1 - overIdx}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-xs font-black uppercase italic text-white tracking-tight">
                                            {overBalls[overBalls.length - 1]
                                              ?.bowlerName || "Bowler"}
                                          </p>
                                          <p className="text-[9px] font-bold text-text-dim uppercase tracking-widest mt-1">
                                            Conceded:{" "}
                                            {overBalls.reduce(
                                              (acc: any, b: any) =>
                                                acc +
                                                (b.runs || 0) +
                                                (b.extra || 0),
                                              0,
                                            )}{" "}
                                            Runs
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                                        {overBalls.map(
                                          (ball: any, bIdx: number) => (
                                            <div
                                              key={bIdx}
                                              className="flex flex-col items-center gap-2 shrink-0"
                                            >
                                              <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black italic transition-all shadow-md
                                            ${
                                              ball.isWicket
                                                ? "bg-red-500 text-white animate-pulse"
                                                : ball.runs >= 4
                                                  ? "bg-brand text-black scale-110 border-2 border-brand shadow-lg shadow-brand/20"
                                                  : ball.extraType
                                                    ? "bg-blue-500 text-white border border-blue-400"
                                                    : "bg-white/10 text-white/70"
                                            }
                                          `}
                                                title={`${ball.strikerName} faced ${ball.bowlerName}${ball.extraType ? ` (${ball.extraType})` : ""}`}
                                              >
                                                {ball.isWicket
                                                  ? "W"
                                                  : ball.extraType
                                                    ? ball.extraType.toUpperCase()
                                                    : ball.runs || 0}
                                              </div>
                                              <div className="text-[7px] font-black uppercase tracking-tighter text-text-dim text-center leading-none">
                                                {
                                                  ball.strikerName?.split(
                                                    " ",
                                                  )[0]
                                                }
                                              </div>
                                              <span className="text-[8px] font-mono font-bold text-brand animate-pulse">
                                                .{bIdx + 1}
                                              </span>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 sm:p-12 md:p-16 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
                      <BarChart2
                        size={48}
                        className="mx-auto text-text-dim/20 mb-4"
                      />
                      <p className="text-xs font-black uppercase tracking-widest text-text-dim italic">
                        Awaiting the first delivery...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function MatchSetupModal({
  match,
  teams,
  onClose,
  onStart,
}: {
  match: any;
  teams: any[];
  onClose: () => void;
  onStart: (data: any) => void;
}) {
  const [battingFirst, setBattingFirst] = useState<"teamA" | "teamB">("teamA");
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [error, setError] = useState<string | null>(null);

  const battingTeam =
    battingFirst === "teamA"
      ? teams.find((t) => t.id === match.teamAId)
      : teams.find((t) => t.id === match.teamBId);
  const bowlingTeam =
    battingFirst === "teamA"
      ? teams.find((t) => t.id === match.teamBId)
      : teams.find((t) => t.id === match.teamAId);

  const handleStart = () => {
    setError(null);
    if (!striker || !nonStriker || !bowler) {
      setError("Incomplete Selection: Please assign all opening roles.");
      return;
    }
    if (striker === nonStriker) {
      setError(
        "Selection Error: Striker and Non-Striker must be distinct players.",
      );
      return;
    }

    const strikerPlayer = battingTeam?.fullPlayers.find(
      (p: any) => p.id === striker,
    );
    const nonStrikerPlayer = battingTeam?.fullPlayers.find(
      (p: any) => p.id === nonStriker,
    );
    const bowlerPlayer = bowlingTeam?.fullPlayers.find(
      (p: any) => p.id === bowler,
    );

    onStart({
      battingFirst,
      strikerId: striker || null,
      strikerName: strikerPlayer?.name || null,
      strikerRole: strikerPlayer?.role || null,
      strikerPhotoUrl: strikerPlayer?.photoUrl || null,
      nonStrikerId: nonStriker || null,
      nonStrikerName: nonStrikerPlayer?.name || null,
      nonStrikerRole: nonStrikerPlayer?.role || null,
      nonStrikerPhotoUrl: nonStrikerPlayer?.photoUrl || null,
      bowlerId: bowler || null,
      bowlerName: bowlerPlayer?.name || null,
      bowlerRole: bowlerPlayer?.role || null,
      bowlerPhotoUrl: bowlerPlayer?.photoUrl || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl overflow-y-auto"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-[110] p-4 bg-black/50 hover:bg-brand hover:text-black border border-white/10 hover:border-brand rounded-full text-white backdrop-blur-md transition-all shadow-2xl opacity-70 hover:opacity-100"
      >
        <X size={24} />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-secondary border border-white/10 rounded-[4rem] p-8 md:p-16 w-full max-w-4xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] relative my-8 mt-24 md:mt-16"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-brand to-transparent" />

        <div className="text-center mb-16 space-y-4">
          <div className="inline-block px-5 py-2 bg-brand/10 border border-brand/20 rounded-full text-[9px] font-black uppercase tracking-[0.6em] text-brand italic">
            Battle Authorization
          </div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-white italic leading-none">
            Match Initialization
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-dim max-w-sm mx-auto leading-relaxed opacity-60 italic">
            Define the opening sequence for the upcoming innings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-16">
          {/* Section 1: Team Selection */}
          <div className="space-y-12">
            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand rounded-full animate-ping" />
                Toss Winner / Batting First
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "teamA", name: match.teamAName },
                  { id: "teamB", name: match.teamBName },
                ].map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setBattingFirst(team.id as any);
                      setStriker("");
                      setNonStriker("");
                      setBowler("");
                      setError(null);
                    }}
                    className={`group relative p-8 rounded-[2.5rem] border-2 transition-all text-center overflow-hidden ${battingFirst === team.id ? "border-brand bg-brand shadow-2xl shadow-brand/20" : "border-white/5 bg-white/[0.02] hover:border-white/20"}`}
                  >
                    <div
                      className={`text-sm font-black uppercase italic tracking-wider transition-colors ${battingFirst === team.id ? "text-black" : "text-text-dim"}`}
                    >
                      {team.name}
                    </div>
                    <div
                      className={`text-[8px] font-bold uppercase mt-2 tracking-widest transition-opacity ${battingFirst === team.id ? "text-black/60" : "opacity-20"}`}
                    >
                      Batting First
                    </div>
                    {battingFirst === team.id && (
                      <motion.div
                        layoutId="selectionGlow"
                        className="absolute inset-0 bg-white/20 mix-blend-overlay pointer-events-none"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
                Opening Batsmen{" "}
                <span className="opacity-40 italic">({battingTeam?.name})</span>
              </label>
              <div className="space-y-4">
                <div className="relative group">
                  <select
                    value={striker}
                    onChange={(e) => setStriker(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-[1.5rem] p-6 text-white font-black italic uppercase text-sm focus:border-brand transition-all outline-none appearance-none cursor-pointer group-hover:bg-white/[0.08]"
                  >
                    <option value="" className="bg-bg-secondary text-text-dim">
                      Select Striker
                    </option>
                    {battingTeam?.fullPlayers?.map((p: any) => (
                      <option
                        key={p.id}
                        value={p.id}
                        className="bg-bg-secondary"
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-brand/40 group-hover:text-brand transition-colors">
                    <User size={18} />
                  </div>
                </div>

                <div className="relative group">
                  <select
                    value={nonStriker}
                    onChange={(e) => setNonStriker(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-[1.5rem] p-6 text-white font-black italic uppercase text-sm focus:border-brand transition-all outline-none appearance-none cursor-pointer group-hover:bg-white/[0.08]"
                  >
                    <option value="" className="bg-bg-secondary text-text-dim">
                      Select Non-Striker
                    </option>
                    {battingTeam?.fullPlayers?.map((p: any) => (
                      <option
                        key={p.id}
                        value={p.id}
                        className="bg-bg-secondary"
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-brand/40 group-hover:text-brand transition-colors">
                    <User size={18} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Bowling Selection */}
          <div className="space-y-12">
            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
                Strike Bowler{" "}
                <span className="opacity-40 italic">({bowlingTeam?.name})</span>
              </label>
              <div className="relative group">
                <select
                  value={bowler}
                  onChange={(e) => setBowler(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-[1.5rem] p-6 text-white font-black italic uppercase text-sm focus:border-brand transition-all outline-none appearance-none cursor-pointer group-hover:bg-white/[0.08]"
                >
                  <option value="" className="bg-bg-secondary text-text-dim">
                    Select Opening Bowler
                  </option>
                  {bowlingTeam?.fullPlayers?.map((p: any) => (
                    <option key={p.id} value={p.id} className="bg-bg-secondary">
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-brand/40 group-hover:text-brand transition-colors">
                  <Activity size={18} />
                </div>
              </div>

              <div className="p-10 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem] text-center space-y-4">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-text-dim/40 border border-white/5">
                  <Calendar size={20} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim italic leading-loose opacity-40">
                  Initializing Engine...
                  <br />
                  Ready for First Delivery
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-12 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center gap-5 shadow-inner"
            >
              <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                <X size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-red-500 italic leading-none">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col md:flex-row gap-6 mt-16 pt-12 border-t border-white/5 relative z-10">
          <button
            onClick={handleStart}
            className="flex-1 py-7 bg-brand text-black rounded-[2.5rem] font-black uppercase italic tracking-[0.3em] shadow-[0_20px_50px_rgba(255,255,255,0.05)] hover:bg-white hover:scale-[1.02] active:scale-95 transition-all text-xl"
          >
            Commence Match
          </button>
          <button
            onClick={onClose}
            className="px-12 py-7 text-[11px] font-black uppercase tracking-[0.4em] text-text-dim hover:text-white transition-all italic"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MatchesSection({
  matches,
  teams,
  isOrganizer,
  tournamentId,
  onUpdate,
  defaultOvers,
}: {
  matches: any[];
  teams: any[];
  isOrganizer: boolean;
  tournamentId: string;
  onUpdate: () => void;
  defaultOvers?: number;
}) {
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [editCompletedMatch, setEditCompletedMatch] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [maxOvers, setMaxOvers] = useState(defaultOvers?.toString() || "20");
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    if (defaultOvers) {
      setMaxOvers(defaultOvers.toString());
    }
  }, [defaultOvers]);
  const [selectedMatchStats, setSelectedMatchStats] = useState<any | null>(
    null,
  );
  const [matchBalls, setMatchBalls] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [setupMatch, setSetupMatch] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "scheduled" | "live" | "completed"
  >("all");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (matches.length > 0) {
      const liveId = searchParams.get("liveMatchId");
      if (liveId && !selectedMatchStats) {
        const targetMatch = matches.find((m: any) => m.id === liveId);
        if (targetMatch) {
          fetchMatchStats(targetMatch);
        }
      }
    }
  }, [matches, searchParams, selectedMatchStats]);

  const statusCounts = {
    all: matches.length,
    scheduled: matches.filter((m) => m.status === "scheduled").length,
    live: matches.filter((m) => m.status === "live").length,
    completed: matches.filter((m) => m.status === "completed").length,
  };

  const filteredMatches = matches.filter(
    (m) => statusFilter === "all" || m.status === statusFilter,
  );

  const handleStartMatch = async (setupData: any) => {
    if (!setupMatch) return;
    try {
      const matchRef = doc(db, "matches", setupMatch.id);

      // Update match with initialization data
      const updateData = {
        status: "live",
        currentInnings: 1,
        isFreeHit: false,
        battingFirst: setupData.battingFirst,
        // If teamA bats first, currentBatting is teamA
        currentBattingTeamId:
          setupData.battingFirst === "teamA"
            ? setupMatch.teamAId
            : setupMatch.teamBId,
        strikerId: setupData.strikerId || null,
        strikerName: setupData.strikerName || null,
        strikerRole: setupData.strikerRole || null,
        strikerPhotoUrl: setupData.strikerPhotoUrl || null,
        nonStrikerId: setupData.nonStrikerId || null,
        nonStrikerName: setupData.nonStrikerName || null,
        nonStrikerRole: setupData.nonStrikerRole || null,
        nonStrikerPhotoUrl: setupData.nonStrikerPhotoUrl || null,
        bowlerId: setupData.bowlerId || null,
        bowlerName: setupData.bowlerName || null,
        bowlerRole: setupData.bowlerRole || null,
        bowlerPhotoUrl: setupData.bowlerPhotoUrl || null,
        strikerRuns: 0,
        strikerBalls: 0,
        nonStrikerRuns: 0,
        nonStrikerBalls: 0,
      };

      await updateDoc(matchRef, updateData);
      setSetupMatch(null);
      navigate(`/scoring/${setupMatch.id}`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `matches/${setupMatch.id}`,
      );
    }
  };

  const fetchMatchStats = async (match: any) => {
    setSelectedMatchStats(match);
    setLoadingStats(true);
    try {
      const ballsQ = query(
        collection(db, "matches", match.id, "balls"),
        orderBy("timestamp", "asc"),
      );
      const ballsSnap = await getDocs(ballsQ);
      setMatchBalls(ballsSnap.docs.map((d) => d.data()));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `matches/${match.id}/balls`);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!selectedMatchStats?.id || selectedMatchStats.status !== "live") return;

    const unsubscribeMatch = onSnapshot(
      doc(db, "matches", selectedMatchStats.id),
      (snap) => {
        if (snap.exists()) {
          setSelectedMatchStats({ id: snap.id, ...snap.data() });
        }
      },
    );

    const ballsQ = query(
      collection(db, "matches", selectedMatchStats.id, "balls"),
      orderBy("timestamp", "asc"),
    );
    const unsubscribeBalls = onSnapshot(ballsQ, (snap) => {
      setMatchBalls(snap.docs.map((d) => d.data()));
    });

    return () => {
      unsubscribeMatch();
      unsubscribeBalls();
    };
  }, [selectedMatchStats?.id]);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError("");
    if (!teamA || !teamB) {
      setMatchError("Select both teams");
      return;
    }
    if (teamA === teamB) {
      setMatchError("Select different teams");
      return;
    }
    const path = "matches";
    try {
      await addDoc(collection(db, path), {
        tournamentId,
        teamAId: teamA,
        teamAName: teams.find((t) => t.id === teamA)?.name || null,
        teamBId: teamB,
        teamBName: teams.find((t) => t.id === teamB)?.name || null,
        venue,
        matchDate,
        matchTime,
        status: "scheduled",
        maxOvers: Number(maxOvers),
        currentInnings: 1,
        isFreeHit: false,
        score: {
          teamA: { runs: 0, wickets: 0, overs: 0 },
          teamB: { runs: 0, wickets: 0, overs: 0 },
        },
        createdAt: new Date().toISOString(),
      });
      setShowMatchModal(false);
      onUpdate();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const confirmDeleteMatch = async () => {
    if (!matchToDelete) return;
    setIsDeleting(true);
    const path = `matches/${matchToDelete}`;
    try {
      // First delete all balls in the subcollection
      const ballsQ = query(collection(db, "matches", matchToDelete, "balls"));
      const ballsSnap = await getDocs(ballsQ);
      const ballDeletions = ballsSnap.docs.map((d) =>
        deleteDoc(doc(db, "matches", matchToDelete, "balls", d.id)),
      );
      await Promise.all(ballDeletions);

      // Then delete the match itself
      await deleteDoc(doc(db, "matches", matchToDelete));
      onUpdate();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsDeleting(false);
      setMatchToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 p-4 px-6 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <Trophy size={14} className="text-brand" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim italic">
              Match Center
            </span>
          </div>

          <div className="relative group w-full sm:min-w-[200px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:ring-1 focus:ring-brand hover:bg-white/10 transition-all cursor-pointer shadow-xl"
            >
              <option value="all" className="bg-bg-secondary text-white">
                All Fixtures ({statusCounts.all})
              </option>
              <option value="scheduled" className="bg-bg-secondary text-white">
                Scheduled ({statusCounts.scheduled})
              </option>
              <option value="live" className="bg-bg-secondary text-white">
                Live Matches ({statusCounts.live})
              </option>
              <option value="completed" className="bg-bg-secondary text-white">
                Match Results ({statusCounts.completed})
              </option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim group-hover:text-brand transition-colors">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
        {isOrganizer && (
          <button
            onClick={() => setShowMatchModal(true)}
            className="px-6 py-2 bg-brand text-black rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-white transition-all shadow-lg shadow-brand/20"
          >
            + Schedule Match
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
        {filteredMatches.map((match) => (
          <div
            key={match.id}
            className={`bg-bg-secondary border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 shadow-xl group hover:border-brand/50 transition-all relative flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-white/[0.02]`}
            onClick={() => {
              fetchMatchStats(match);
            }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-brand/40 transition-all" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
                <div
                  className={`w-2 h-2 rounded-full ${match.status === "live" ? "bg-brand animate-pulse" : match.status === "completed" ? "bg-green-400" : "bg-text-dim/30"}`}
                />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 italic leading-none">
                  {match.status}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-[9px] font-bold text-text-dim/60 uppercase tracking-widest italic">
                  <MapPin size={10} className="text-brand/40" />
                  {match.venue || "TBA"}
                </div>
                {(match.matchDate || match.matchTime) && (
                  <div className="flex items-center gap-2 text-[8px] font-black text-brand/60 uppercase tracking-widest italic">
                    <Calendar size={10} />
                    {match.matchDate || ""} {match.matchTime || ""}
                  </div>
                )}
              </div>
              {isOrganizer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMatchToDelete(match.id);
                  }}
                  className="p-2.5 text-text-dim hover:text-red-500 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-6 items-center">
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex-1 text-center space-y-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 border border-white/10 rounded-2xl mx-auto flex items-center justify-center font-black italic text-brand text-2xl group-hover:scale-105 transition-transform shadow-inner">
                    {match.teamAName?.charAt(0)}
                  </div>
                  <div className="text-sm font-black uppercase italic text-white tracking-tight leading-tight truncate">
                    {match.teamAName}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim italic">
                    VS
                  </div>
                  <div className="w-px h-12 bg-white/10 my-2" />
                </div>

                <div className="flex-1 text-center space-y-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 border border-white/10 rounded-2xl mx-auto flex items-center justify-center font-black italic text-brand text-2xl group-hover:scale-105 transition-transform shadow-inner">
                    {match.teamBName?.charAt(0)}
                  </div>
                  <div className="text-sm font-black uppercase italic text-white tracking-tight leading-tight truncate">
                    {match.teamBName}
                  </div>
                </div>
              </div>

              {(match.status === "completed" || match.status === "live") && (
                <div className="flex items-center gap-4 sm:gap-10 bg-white/5 p-4 sm:p-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-white/10 w-full justify-around backdrop-blur-xl relative overflow-hidden group/score">
                  <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-black italic text-white tracking-tighter">
                      {match.score.teamA.runs}
                      <span className="text-xs sm:text-sm text-brand mx-0.5">
                        /
                      </span>
                      {match.score.teamA.wickets}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black text-text-dim uppercase tracking-[0.2em] italic mt-1">
                      {match.score.teamA.overs} OV
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-black italic text-white tracking-tighter">
                      {match.score.teamB.runs}
                      <span className="text-xs sm:text-sm text-brand mx-0.5">
                        /
                      </span>
                      {match.score.teamB.wickets}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black text-text-dim uppercase tracking-[0.2em] italic mt-1">
                      {match.score.teamB.overs} OV
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 sm:pt-8 border-t border-white/10 flex flex-col gap-3 sm:gap-4">
              {(match.status === "completed" || match.status === "live") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchMatchStats(match);
                  }}
                  className="w-full py-4 sm:py-5 bg-white/5 hover:bg-white text-text-dim hover:text-black rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] italic transition-all flex items-center justify-center gap-2 sm:gap-3 border border-white/5 hover:border-white shadow-xl"
                >
                  {match.status === "live" ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                      Match Live Center
                    </>
                  ) : (
                    <>
                      <BarChart2 size={14} className="sm:w-4 sm:h-4" /> Analytic
                      Portal
                    </>
                  )}
                </button>
              )}
              {isOrganizer && match.status === "scheduled" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSetupMatch(match);
                  }}
                  className="w-full py-4 sm:py-5 bg-brand text-black rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.05)] flex items-center justify-center gap-2 sm:gap-3"
                >
                  <Play
                    size={14}
                    fill="currentColor"
                    className="sm:w-4 sm:h-4"
                  />{" "}
                  Initiate Scoring
                </button>
              )}
              {match.status === "live" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/scoring/${match.id}`}
                    className="w-full py-4 sm:py-5 bg-brand text-black rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 sm:gap-3 underline decoration-4 underline-offset-8"
                  >
                    <Play
                      size={14}
                      fill="currentColor"
                      className="sm:w-4 sm:h-4"
                    />{" "}
                    {isOrganizer ? "Resume War Room" : "View Live Score"}
                  </Link>
                </div>
              )}
              {match.status === "completed" && (
                <div onClick={(e) => e.stopPropagation()}>
                  {isOrganizer ? (
                    <button
                      onClick={() => setEditCompletedMatch(match)}
                      className="w-full py-4 sm:py-5 bg-white/10 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic hover:bg-white/20 transition-all flex items-center justify-center gap-2 sm:gap-3 border border-white/10"
                    >
                      <Play
                        size={14}
                        fill="currentColor"
                        className="sm:w-4 sm:h-4"
                      />{" "}
                      Edit Match Score
                    </button>
                  ) : (
                    <Link
                      to={`/scoring/${match.id}`}
                      className="w-full py-4 sm:py-5 bg-white/10 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic hover:bg-white/20 transition-all flex items-center justify-center gap-2 sm:gap-3 border border-white/10"
                    >
                      <Play
                        size={14}
                        fill="currentColor"
                        className="sm:w-4 sm:h-4"
                      />{" "}
                      View Match Details
                    </Link>
                  )}
                </div>
              )}
              {match.status === "scheduled" && !isOrganizer && (
                <div className="w-full py-5 text-center bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.5em] text-text-dim/50 italic">
                  Match Scheduled
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {filteredMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 md:p-12 bg-white/5 border border-white/5 rounded-[2.5rem] text-center space-y-6 shadow-inner">
          <Calendar size={48} className="text-brand opacity-80" />
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl sm:text-2xl font-black uppercase italic text-white tracking-tighter">
              No Matches Yet
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim leading-relaxed">
              {isOrganizer
                ? "Get the tournament started by scheduling the first fixture. Select teams, venue, and time."
                : "The organizer hasn't scheduled any matches for this tournament yet. Check back later."}
            </p>
          </div>
          {isOrganizer && (
            <button
              onClick={() => setShowMatchModal(true)}
              className="mt-4 px-8 py-4 bg-brand text-black rounded-2xl font-black uppercase italic tracking-widest text-[11px] hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-brand/30 flex items-center gap-2"
            >
              <Plus size={16} /> Schedule First Match
            </button>
          )}
        </div>
      )}
      {selectedMatchStats && (
        <MatchDetailsModal
          match={selectedMatchStats}
          balls={matchBalls}
          loading={loadingStats}
          onClose={() => setSelectedMatchStats(null)}
        />
      )}

      {/* Match Setup Modal */}
      <AnimatePresence>
        {setupMatch && (
          <MatchSetupModal
            match={setupMatch}
            teams={teams}
            onClose={() => setSetupMatch(null)}
            onStart={handleStartMatch}
          />
        )}
      </AnimatePresence>

      {showMatchModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowMatchModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
          >
            <button 
              onClick={() => setShowMatchModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-text-dim hover:text-white transition-all"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">
              Schedule Match
            </h2>
            {matchError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold uppercase tracking-widest text-center">
                {matchError}
              </div>
            )}
            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Team A
                </label>
                <select
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand appearance-none"
                  required
                >
                  <option value="" className="bg-bg-secondary">
                    Select Team
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-bg-secondary">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Team B
                </label>
                <select
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand appearance-none"
                  required
                >
                  <option value="" className="bg-bg-secondary">
                    Select Team
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-bg-secondary">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Total Overs
                </label>
                <input
                  type="number"
                  value={maxOvers}
                  onChange={(e) => setMaxOvers(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. 20"
                  required
                  min="1"
                  max="50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                  Venue
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Lords Cricket Ground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={matchTime}
                    onChange={(e) => setMatchTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMatchModal(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white transition-all shadow-lg hover:shadow-brand/20 active:scale-[0.98]"
                >
                  Schedule
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Completed Match Modal */}
      {editCompletedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
          >
            <button
              onClick={() => setEditCompletedMatch(null)}
              className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-text-dim hover:text-white transition-all"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl sm:text-2xl font-black uppercase mb-6 tracking-tighter text-white italic">
              Edit Match Score
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsDeleting(true);
                try {
                  const tA = editCompletedMatch.teamAId;
                  const tB = editCompletedMatch.teamBId;
                  
                  const targetScore = {
                    teamA: {
                      runs: Number((e.target as any).teamARuns.value),
                      wickets: Number((e.target as any).teamAWickets.value),
                      overs: Number((e.target as any).teamAOvers.value),
                    },
                    teamB: {
                      runs: Number((e.target as any).teamBRuns.value),
                      wickets: Number((e.target as any).teamBWickets.value),
                      overs: Number((e.target as any).teamBOvers.value),
                    }
                  };
                  
                  let winnerId = null;
                  if (targetScore.teamA.runs > targetScore.teamB.runs) {
                    winnerId = tA;
                  } else if (targetScore.teamB.runs > targetScore.teamA.runs) {
                    winnerId = tB;
                  }

                  await updateDoc(doc(db, "matches", editCompletedMatch.id), {
                    score: targetScore,
                    winnerId: winnerId,
                  });
                  onUpdate();
                  setEditCompletedMatch(null);
                } catch (err) {
                  console.error(err);
                  alert("Failed to update score");
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-brand">{editCompletedMatch.teamAName}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" name="teamARuns" placeholder="Runs" defaultValue={editCompletedMatch.score.teamA.runs} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                  <input type="number" name="teamAWickets" placeholder="Wickets" defaultValue={editCompletedMatch.score.teamA.wickets} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                  <input type="number" step="0.1" name="teamAOvers" placeholder="Overs" defaultValue={editCompletedMatch.score.teamA.overs} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-white/5">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-brand">{editCompletedMatch.teamBName}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" name="teamBRuns" placeholder="Runs" defaultValue={editCompletedMatch.score.teamB.runs} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                  <input type="number" name="teamBWickets" placeholder="Wickets" defaultValue={editCompletedMatch.score.teamB.wickets} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                  <input type="number" step="0.1" name="teamBOvers" placeholder="Overs" defaultValue={editCompletedMatch.score.teamB.overs} required className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4 mt-8">
                <button
                  type="button"
                  onClick={() => setEditCompletedMatch(null)}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-brand text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white transition-all shadow-lg hover:shadow-brand/20 disabled:opacity-50"
                >
                  Save Score
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Match Confirmation Modal */}
      {matchToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary w-full max-w-sm rounded-[2rem] p-6 border border-white/10 shadow-2xl space-y-6"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tight">
                Delete Match?
              </h3>
              <p className="text-sm font-medium text-text-dim">
                This action will permanently remove the match and all of its
                ball-by-ball scoring data. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setMatchToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMatch}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-black shadow-lg shadow-red-500/20 rounded-xl font-bold uppercase text-[10px] tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? "Deleting..." : "Delete It"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TournamentAnalyticsSection({ teams }: { teams: any[] }) {
  // Orange Cap (Most Runs)
  const allPlayers = teams.flatMap(
    (t) => (t.fullPlayers || t.players)?.map((p: any) => ({ ...p, teamName: t.name })) || [],
  );

  const orangeCap = [...allPlayers]
    .sort((a, b) => (b.totalRuns || 0) - (a.totalRuns || 0))
    .slice(0, 10);
  const purpleCap = [...allPlayers]
    .sort((a, b) => (b.totalWickets || 0) - (a.totalWickets || 0))
    .slice(0, 10);
  const highestStrikeRate = [...allPlayers]
    .filter((p) => (p.totalBallsFaced || 0) > 0)
    .sort((a, b) => (b.strikeRate || 0) - (a.strikeRate || 0))
    .slice(0, 10);
  const bestEconomy = [...allPlayers]
    .filter((p) => (p.totalBallsBowled || 0) > 0)
    .sort((a, b) => (a.economyRate || 99) - (b.economyRate || 99))
    .slice(0, 10);

  const playerOfTournament = [...allPlayers]
    .sort((a, b) => {
      const scoreA = (a.totalRuns || 0) + (a.totalWickets || 0) * 25;
      const scoreB = (b.totalRuns || 0) + (b.totalWickets || 0) * 25;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <Award size={48} className="mx-auto text-brand mb-4" />
        <h2 className="text-[20px] leading-[24px] sm:text-3xl font-black uppercase italic text-white tracking-tighter">
          Tournament Awards
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Top Performers
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
        <div className="bg-bg-secondary border border-yellow-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-yellow-500/20 transition-all rounded-full" />
          <h3 className="text-lg font-black uppercase italic text-yellow-500 mb-6 flex items-center gap-2">
            <Star size={20} /> Player of the Tournament
          </h3>
          <div className="space-y-3 relative z-10">
            {playerOfTournament.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-[10px] font-black italic">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      {p.name || "Unknown Player"}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-text-dim">
                      {p.teamName}
                    </div>
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black italic text-yellow-500">
                  <span className="text-[10px] text-text-dim mr-2">PTS</span>
                  {((p.totalRuns || 0) + (p.totalWickets || 0) * 25).toFixed(0)}
                </div>
              </div>
            ))}
            {playerOfTournament.length === 0 && (
              <div className="text-center text-text-dim py-4 text-xs">
                No data yet
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary border border-orange-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/20 transition-all rounded-full" />
          <h3 className="text-lg font-black uppercase italic text-orange-500 mb-6 flex items-center gap-2">
            <Trophy size={20} /> Most Runs
          </h3>
          <div className="space-y-3 relative z-10">
            {orangeCap.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-[10px] font-black italic">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      {p.name || "Unknown Player"}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-text-dim">
                      {p.teamName}
                    </div>
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black italic text-orange-500">
                  {p.totalRuns || 0}{" "}
                  <span className="text-[10px] text-text-dim">RUNS</span>
                </div>
              </div>
            ))}
            {orangeCap.length === 0 && (
              <div className="text-center text-text-dim py-4 text-xs">
                No data yet
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary border border-purple-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all rounded-full" />
          <h3 className="text-lg font-black uppercase italic text-purple-500 mb-6 flex items-center gap-2">
            <Medal size={20} /> Most Wickets
          </h3>
          <div className="space-y-3 relative z-10">
            {purpleCap.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-[10px] font-black italic">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      {p.name || "Unknown Player"}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-text-dim">
                      {p.teamName}
                    </div>
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black italic text-purple-500">
                  {p.totalWickets || 0}{" "}
                  <span className="text-[10px] text-text-dim">WKTS</span>
                </div>
              </div>
            ))}
            {purpleCap.length === 0 && (
              <div className="text-center text-text-dim py-4 text-xs">
                No data yet
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary border border-blue-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all rounded-full" />
          <h3 className="text-lg font-black uppercase italic text-blue-500 mb-6 flex items-center gap-2">
            <Activity size={20} /> Highest Strike Rate
          </h3>
          <div className="space-y-3 relative z-10">
            {highestStrikeRate.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-black italic">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      {p.name || "Unknown Player"}
                    </div>
                    <div className="text-[8px] uppercase tracking-widest text-text-dim">
                      {p.totalRuns || 0} runs / {p.totalBallsFaced || 0} balls
                    </div>
                  </div>
                </div>
                <div className="text-lg font-black italic text-blue-500">
                  {p.strikeRate || 0}
                </div>
              </div>
            ))}
            {highestStrikeRate.length === 0 && (
              <div className="text-center text-text-dim py-4 text-xs">
                Min 10 balls faced
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary border border-green-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/20 transition-all rounded-full" />
          <h3 className="text-lg font-black uppercase italic text-green-500 mb-6 flex items-center gap-2">
            <Target size={20} /> Best Economy Rate
          </h3>
          <div className="space-y-3 relative z-10">
            {bestEconomy.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-black italic">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">
                      {p.name || "Unknown Player"}
                    </div>
                    <div className="text-[8px] uppercase tracking-widest text-text-dim">
                      {p.totalRunsConceded || 0} runs /{" "}
                      {Math.floor((p.totalBallsBowled || 0) / 6)}.
                      {(p.totalBallsBowled || 0) % 6} overs
                    </div>
                  </div>
                </div>
                <div className="text-lg font-black italic text-green-500">
                  {p.economyRate || 0}
                </div>
              </div>
            ))}
            {bestEconomy.length === 0 && (
              <div className="text-center text-text-dim py-4 text-xs">
                Min 2 overs bowled
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
