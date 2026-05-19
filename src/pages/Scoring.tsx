// src/pages/Scoring.tsx
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/hooks';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, where, getDocs, increment } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Settings, User, AlertTriangle, Check, X, ChevronDown, Users, Share2, Activity, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Loading from '../components/Loading';

export default function Scoring() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balls, setBalls] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pendingBall, setPendingBall] = useState<{ runs: number, extraType: string | null, isWicket: boolean, region?: string | null } | null>(null);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState<{ type: 'batting' | 'opponent' } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBatsmanSelection, setShowBatsmanSelection] = useState<any | null>(null);
  const [showBowlerSelection, setShowBowlerSelection] = useState(false);
  const [showSpecialRuns, setShowSpecialRuns] = useState(false);
  const [battingSquad, setBattingSquad] = useState<any[]>([]);
  const [bowlingSquad, setBowlingSquad] = useState<any[]>([]);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (match) {
      fetchSquads();
    }
  }, [match?.id, match?.teamAId, match?.teamBId, match?.currentInnings]);

  const fetchSquads = async () => {
    if (!match) return;
    try {
      const battingId = match.currentBattingTeamId;
      const bowlingId = battingId === match.teamAId ? match.teamBId : match.teamAId;

      const [battingSnap, bowlingSnap] = await Promise.all([
        getDocs(query(collection(db, 'players'), where('teamId', '==', battingId))),
        getDocs(query(collection(db, 'players'), where('teamId', '==', bowlingId)))
      ]);

      setBattingSquad(battingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBowlingSquad(bowlingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching squads:", err);
    }
  };

  useEffect(() => {
    if (match?.tournamentId) {
      const fetchTeams = async () => {
        try {
          const q = query(collection(db, 'teams'), where('tournamentId', '==', match.tournamentId));
          const snap = await getDocs(q);
          setAvailableTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error("Error fetching tournament teams:", err);
        }
      };
      fetchTeams();
    }
  }, [match?.tournamentId]);

  const updateTeamAssignment = async (teamId: string, teamName: string, type: 'batting' | 'opponent') => {
    if (!match || !id) return;
    
    const isBattingType = type === 'batting';
    // If innings 1: teamA is batting, teamB is opponent.
    // If innings 2: teamB is batting, teamA is opponent.
    const targetKey = match.currentInnings === 1 
      ? (isBattingType ? 'teamA' : 'teamB')
      : (isBattingType ? 'teamB' : 'teamA');

    const updateData: any = {
      [`${targetKey}Id`]: teamId,
      [`${targetKey}Name`]: teamName
    };

    // Explicitly update opponentTeamId and opponentTeamName as requested by user
    if (!isBattingType) {
      updateData.opponentTeamId = teamId;
      updateData.opponentTeamName = teamName;
    } else {
      updateData.battingTeamId = teamId;
      updateData.battingTeamName = teamName;
    }

    try {
      await updateDoc(doc(db, 'matches', id), updateData);
      setShowTeamSelector(null);
      setShowSettings(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}`);
    }
  };

  const nextInnings = async () => {
    if (!match || !id) return;
    try {
      setBattingSquad([]);
      setBowlingSquad([]);
      await updateDoc(doc(db, 'matches', id), {
        currentInnings: 2,
        status: 'live',
        currentBattingTeamId: match.battingFirst === 'teamA' ? match.teamBId : match.teamAId,
        // Reset players for new innings
        strikerId: null,
        strikerName: null,
        strikerRole: null,
        strikerPhotoUrl: null,
        nonStrikerId: null,
        nonStrikerName: null,
        nonStrikerRole: null,
        nonStrikerPhotoUrl: null,
        bowlerId: null,
        bowlerName: null,
        bowlerRole: null,
        bowlerPhotoUrl: null,
        strikerRuns: 0,
        strikerBalls: 0,
        nonStrikerRuns: 0,
        nonStrikerBalls: 0
      });
      setShowSettings(false);
      setShowBatsmanSelection({ type: 'striker' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}`);
    }
  };

  const completeMatch = async () => {
    if (!match || !id) return;
    
    setLoading(true);
    try {
      const ballsSnap = await getDocs(query(collection(db, 'matches', id, 'balls'), orderBy('timestamp', 'asc')));
      const allBalls = ballsSnap.docs.map(d => d.data());

      const stats: Record<string, any> = {};
      allBalls.forEach(ball => {
        if (ball.strikerId) {
          if (!stats[ball.strikerId]) stats[ball.strikerId] = { runs: 0, ballsFaced: 0, isOut: false, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          stats[ball.strikerId].runs += (ball.runs || 0);
          if (ball.extraType !== 'wide' && ball.extraType !== 'nb') stats[ball.strikerId].ballsFaced++;
          if (ball.isWicket) stats[ball.strikerId].isOut = true;
        }
        if (ball.bowlerId) {
          if (!stats[ball.bowlerId]) stats[ball.bowlerId] = { runs: 0, ballsFaced: 0, isOut: false, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          if (ball.extraType !== 'wide' && ball.extraType !== 'nb') stats[ball.bowlerId].ballsBowled++;
          if (ball.extraType !== 'bye' && ball.extraType !== 'lb') stats[ball.bowlerId].runsConceded += (ball.runs || 0) + (ball.extra || 0);
          if (ball.isWicket && ball.wicketType !== 'run out') stats[ball.bowlerId].wickets++;
        }
      });

      for (const pid in stats) {
        const pRef = doc(db, 'players', pid);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const d = pSnap.data();
          const s = stats[pid];

          const newMatches = (d.matchesPlayed || 0) + 1;
          const newRuns = (d.totalRuns || 0) + s.runs;
          const newBallsFaced = (d.totalBallsFaced || 0) + s.ballsFaced;
          const newDismissals = (d.totalDismissals || 0) + (s.isOut ? 1 : 0);
          const newWickets = (d.totalWickets || 0) + s.wickets;
          const newRunsConceded = (d.totalRunsConceded || 0) + s.runsConceded;
          const newBallsBowled = (d.totalBallsBowled || 0) + s.ballsBowled;

          const update: any = {
            matchesPlayed: newMatches,
            totalRuns: newRuns,
            totalBallsFaced: newBallsFaced,
            totalDismissals: newDismissals,
            totalWickets: newWickets,
            totalRunsConceded: newRunsConceded,
            totalBallsBowled: newBallsBowled,
            highestScore: Math.max(d.highestScore || 0, s.runs),
            centuries: (d.centuries || 0) + (s.runs >= 100 ? 1 : 0),
            halfCenturies: (d.halfCenturies || 0) + (s.runs >= 50 && s.runs < 100 ? 1 : 0),
            fiveWicketHauls: (d.fiveWicketHauls || 0) + (s.wickets >= 5 ? 1 : 0)
          };

          const currentBestStr = d.bestBowlingFigures || "0/999";
          const [cBw, cBr] = currentBestStr.includes('/') ? currentBestStr.split('/').map(Number) : [0, 999];
          if (s.wickets > cBw || (s.wickets === cBw && s.runsConceded < cBr)) {
            update.bestBowlingFigures = `${s.wickets}/${s.runsConceded}`;
          }

          if (newBallsFaced > 0) update.strikeRate = Number(((newRuns / newBallsFaced) * 100).toFixed(2));
          if (newDismissals > 0) update.battingAverage = Number((newRuns / newDismissals).toFixed(2));
          else if (newDismissals === 0 && newRuns > 0) update.battingAverage = newRuns; 
          
          if (newBallsBowled > 0) {
            update.economyRate = Number(((newRunsConceded / newBallsBowled) * 6).toFixed(2));
            if (newWickets > 0) update.bowlingAverage = Number((newRunsConceded / newWickets).toFixed(2));
          }

          await updateDoc(pRef, update);
        }
      }

      // Mark match as strictly completed and update winnerId
      let winnerId = null;
      if (match.score) {
        const scoreA = match.score['teamA']?.runs || 0;
        const scoreB = match.score['teamB']?.runs || 0;
        if (scoreA > scoreB) winnerId = match.teamAId;
        else if (scoreB > scoreA) winnerId = match.teamBId;
        else winnerId = 'tie';
      }

      await updateDoc(doc(db, 'matches', id), {
        status: 'completed',
        winnerId
      });

      // Trigger AI Summary Generation
      fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchData: {
          teamA: match.teamAName,
          teamB: match.teamBName,
          scoreA: match.score?.['teamA'],
          scoreB: match.score?.['teamB'],
          winner: winnerId === match.teamAId ? match.teamAName : winnerId === match.teamBId ? match.teamBName : 'Tie'
        } })
      }).then(res => res.json()).then(data => {
        if (data.summary) {
          updateDoc(doc(db, 'matches', id), { aiSummary: data.summary }).catch(e => console.error(e));
        }
      }).catch(err => console.error(err));

      navigate(`/tournament/${match.tournamentId}`);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}`);
    } finally {
      setLoading(false);
      setShowCompleteConfirm(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    const unsubscribeMatch = onSnapshot(doc(db, 'matches', id), (docSnap) => {
      if (docSnap.exists()) {
        setMatch({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${id}`);
    });

    const ballsQuery = query(
      collection(db, 'matches', id, 'balls'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribeBalls = onSnapshot(ballsQuery, (snap) => {
      setBalls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `matches/${id}/balls`);
    });

    return () => {
      unsubscribeMatch();
      unsubscribeBalls();
    };
  }, [id]);

  useEffect(() => {
    if (match?.tournamentId && user) {
      const fetchTournament = async () => {
        try {
          const tSnap = await getDoc(doc(db, 'tournaments', match.tournamentId));
          if (tSnap.exists()) {
            const tData = tSnap.data();
            setTournament(tData);
            if (user.uid === tData.organizerId || (tData.scorers && tData.scorers.includes(user.uid))) {
              setIsAuthorized(true);
            }
          }
        } catch (err) {
          console.error("Error checking authorization:", err);
        }
      };
      fetchTournament();
    }
  }, [match?.tournamentId, user]);

  const recordBall = async (runs: number, extraType: string | null = null, isWicket: boolean = false, region: string | null = null) => {
    if (!match) return;

    const isTeamABatting = match.currentBattingTeamId === match.teamAId;
    const battingTeamKey = isTeamABatting ? 'teamA' : 'teamB';
    const opponentTeamKey = isTeamABatting ? 'teamB' : 'teamA';
    const currentScore = match.score[battingTeamKey];

    let extraRuns = 0;
    let batterRuns = runs;
    let ballIncrement = 0.1;
    let nextIsFreeHit = false;

    if (extraType === 'wide') {
      extraRuns = 1 + runs;
      batterRuns = 0;
      ballIncrement = 0;
    } else if (extraType === 'nb') {
      extraRuns = 1;
      batterRuns = runs;
      ballIncrement = 0;
      nextIsFreeHit = true;
    } else if (extraType === 'lb' || extraType === 'bye') {
      extraRuns = runs;
      batterRuns = 0;
      ballIncrement = 0.1;
    }

    const newRuns = currentScore.runs + batterRuns + extraRuns;
    const newWickets = currentScore.wickets + (isWicket ? 1 : 0);
    
    // Determine the max allowed overs and wickets
    const tournamentMaxOvers = match.maxOvers || tournament?.oversPerMatch || 20;
    
    // If we have squads, use squad length. Otherwise default to 11.
    const battingTeamDoc = availableTeams.find(t => t.id === match.currentBattingTeamId);
    const playersCount = battingSquad.length > 0 ? battingSquad.length : (battingTeamDoc?.players?.length || 11);
    
    // In cricket, you are all out when you lose (players - 1) wickets, unless it's a special rule.
    // However, if the user explicitly wants everyone out (like in some variants), we check if they are actually all gone.
    // We'll use (players - 1) as the default for matches with > 1 player.
    const maxWickets = playersCount > 1 ? playersCount - 1 : 1;
    const isAllOut = newWickets >= maxWickets;
    
    let finalOvers = currentScore.overs;
    let overEnded = false;
    if (ballIncrement > 0) {
      const newOvers = parseFloat((currentScore.overs + ballIncrement).toFixed(1));
      if (Math.round((newOvers * 10) % 10) === 6) {
        finalOvers = Math.floor(newOvers) + 1;
        overEnded = true;
      } else {
        finalOvers = newOvers;
      }
    }

    const target = match.currentInnings === 2 ? (match.score[opponentTeamKey].runs + 1) : null;
    const isTargetReached = target !== null && (currentScore.runs + batterRuns + extraRuns) >= target;

    const isInningsEnded = isAllOut || finalOvers >= tournamentMaxOvers || isTargetReached;

    let finalStatus = 'live';
    let winnerId = match.winnerId || null;

    if (isTargetReached) {
      finalStatus = 'completed';
      winnerId = match.currentBattingTeamId;
    } else if (isInningsEnded) {
      if (match.currentInnings === 2) {
        finalStatus = 'completed';
        const opponentScore = match.score[opponentTeamKey].runs;
        const currentTotal = currentScore.runs + batterRuns + extraRuns;
        if (currentTotal > opponentScore) {
          winnerId = match.currentBattingTeamId;
        } else if (opponentScore > currentTotal) {
          winnerId = match.currentBattingTeamId === match.teamAId ? match.teamBId : match.teamAId;
        } else {
          winnerId = 'tie';
        }
      } else {
        finalStatus = 'innings_completed';
      }
    }

    // Determine if strikers should swap
    // Use the original 'runs' argument to determine if they crossed
    let shouldSwap = runs % 2 !== 0;
    
    // Over end swap
    if (overEnded && !isInningsEnded) {
      shouldSwap = !shouldSwap;
    }

    try {
      const updateData: any = {
        [`score.${battingTeamKey}.runs`]: increment(batterRuns + extraRuns),
        [`score.${battingTeamKey}.wickets`]: increment(isWicket ? 1 : 0),
        [`score.${battingTeamKey}.overs`]: finalOvers,
        status: finalStatus,
        winnerId: winnerId,
        isFreeHit: nextIsFreeHit || (!!match.isFreeHit && ballIncrement === 0),
      };

      if (isWicket && !isAllOut && !isTargetReached) {
        // Pop up batsman selection
        setShowBatsmanSelection({ type: 'striker' });
      }

      if (overEnded && !isWicket && !isInningsEnded) {
        // Pop up bowler selection
        setShowBowlerSelection(true);
      }

      if (shouldSwap && !isWicket && !isInningsEnded) {
        updateData.strikerId = match.nonStrikerId || null;
        updateData.strikerName = match.nonStrikerName || null;
        updateData.strikerRole = match.nonStrikerRole || null;
        updateData.strikerPhotoUrl = match.nonStrikerPhotoUrl || null;
        updateData.strikerRuns = match.nonStrikerRuns || 0;
        updateData.strikerBalls = match.nonStrikerBalls || 0;
        
        updateData.nonStrikerId = match.strikerId || null;
        updateData.nonStrikerName = match.strikerName || null;
        updateData.nonStrikerRole = match.strikerRole || null;
        updateData.nonStrikerPhotoUrl = match.strikerPhotoUrl || null;
        updateData.nonStrikerRuns = (match.strikerRuns || 0) + batterRuns;
        updateData.nonStrikerBalls = (match.strikerBalls || 0) + (ballIncrement > 0 ? 1 : 0);
      } else if (!isWicket) {
        // No swap and not out: just increment current striker's stats
        updateData.strikerRuns = increment(batterRuns);
        updateData.strikerBalls = increment(ballIncrement > 0 ? 1 : 0);
      }

      await updateDoc(doc(db, 'matches', match.id), updateData);

      await addDoc(collection(db, 'matches', match.id, 'balls'), {
        runs: batterRuns,
        extra: extraRuns,
        extraType: extraType || null,
        isWicket,
        isFreeHit: match.isFreeHit || false,
        timestamp: new Date().toISOString(),
        innings: match.currentInnings,
        over: Math.floor(finalOvers),
        ballNum: Math.round((finalOvers % 1) * 10),
        strikerName: match.strikerName || null,
        nonStrikerName: match.nonStrikerName || null,
        bowlerName: match.bowlerName || null,
        bowlerRole: match.bowlerRole || null,
        strikerId: match.strikerId || null,
        nonStrikerId: match.nonStrikerId || null,
        bowlerId: match.bowlerId || null,
        strikerPhotoUrl: match.strikerPhotoUrl || null,
        bowlerPhotoUrl: match.bowlerPhotoUrl || null,
        swappedPlayers: shouldSwap,
        // Store pre-ball stats for perfect undo
        prevStrikerRuns: match.strikerRuns || 0,
        prevStrikerBalls: match.strikerBalls || 0,
        prevNonStrikerRuns: match.nonStrikerRuns || 0,
        prevNonStrikerBalls: match.nonStrikerBalls || 0,
        region
      }).then(ballRef => {
        // Fire commentary in background
        fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Generate a single short sentence of exciting professional cricket commentary for a ball. Batsman: ${match.strikerName || 'Unknown'}, Bowler: ${match.bowlerName || 'Unknown'}. Event: ${isWicket ? "WICKET!" : (extraType ? extraType + " (" + runs + " runs)" : runs + " runs")}. Region: ${region || '-'}.`
          })
        }).then(res => res.json()).then(data => {
          if (data.commentary) {
            updateDoc(doc(db, 'matches', match.id, 'balls', ballRef.id), { commentary: data.commentary }).catch(e => console.error(e));
          }
        }).catch(err => console.error("Commentary error:", err));
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${match.id}`);
    }
  };

  const handleUndo = async () => {
    if (!match || balls.length === 0 || !id) return;
    
    const lastBall = balls[0];
    const ballInnings = lastBall.innings || 1;
    const isTeamABattingFirst = match.battingFirst === 'teamA';
    const battingTeamId = ballInnings === 1 
      ? (isTeamABattingFirst ? match.teamAId : match.teamBId)
      : (isTeamABattingFirst ? match.teamBId : match.teamAId);
    
    const battingTeamKey = battingTeamId === match.teamAId ? 'teamA' : 'teamB';
    const currentScore = match.score[battingTeamKey];

    const runsToSubtract = (lastBall.runs || 0) + (lastBall.extra || 0);
    const wicketsToSubtract = lastBall.isWicket ? 1 : 0;
    const isLegitimateBall = !(lastBall.extraType === 'wide' || lastBall.extraType === 'nb');

    // Precision-calculate new overs
    const totalCurrentBalls = Math.floor(currentScore.overs) * 6 + Math.round((currentScore.overs % 1) * 10);
    const newTotalBalls = isLegitimateBall ? Math.max(0, totalCurrentBalls - 1) : totalCurrentBalls;
    const newOvers = Math.floor(newTotalBalls / 6) + (newTotalBalls % 6) / 10;

    try {
      const updateData: any = {
        [`score.${battingTeamKey}.runs`]: increment(-runsToSubtract),
        [`score.${battingTeamKey}.wickets`]: increment(-wicketsToSubtract),
        [`score.${battingTeamKey}.overs`]: newOvers,
        status: 'live',
        winnerId: null,
        currentInnings: ballInnings,
        currentBattingTeamId: battingTeamId,
        isFreeHit: lastBall.isFreeHit || false,
        // Restore player state from the moment this ball was recorded
        strikerId: lastBall.strikerId || null,
        strikerName: lastBall.strikerName || null,
        strikerPhotoUrl: lastBall.strikerPhotoUrl || null,
        strikerRuns: lastBall.prevStrikerRuns || 0,
        strikerBalls: lastBall.prevStrikerBalls || 0,
        nonStrikerId: lastBall.nonStrikerId || null,
        nonStrikerName: lastBall.nonStrikerName || null,
        nonStrikerRuns: lastBall.prevNonStrikerRuns || 0,
        nonStrikerBalls: lastBall.prevNonStrikerBalls || 0,
        bowlerId: lastBall.bowlerId || null,
        bowlerName: lastBall.bowlerName || null,
        bowlerPhotoUrl: lastBall.bowlerPhotoUrl || null
      };

      await deleteDoc(doc(db, 'matches', id, 'balls', lastBall.id));
      await updateDoc(doc(db, 'matches', id), updateData);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}/balls/${lastBall.id}`);
    }
  };

  const handleRecordBall = (runs: number, extraType: string | null = null, isWicket: boolean = false) => {
    if (isWicket || runs >= 4) {
      setPendingBall({ runs, extraType, isWicket });
    } else {
      recordBall(runs, extraType, isWicket);
    }
  };

  const handleSelectNewBatsman = async (player: any) => {
    if (!match || !id || !showBatsmanSelection) return;

    try {
      const updateData: any = {};
      
      let isOverEnded = false;
      if (match.score && match.score[battingTeamKey]) {
        isOverEnded = Math.round((match.score[battingTeamKey].overs % 1) * 10) === 6;
      }

      if (showBatsmanSelection.type === 'striker') {
        updateData.strikerId = player.id;
        updateData.strikerName = player.name;
        updateData.strikerRole = player.role || 'batsman';
        updateData.strikerPhotoUrl = player.photoUrl || null;
        updateData.strikerRuns = 0;
        updateData.strikerBalls = 0;
      } else {
        updateData.nonStrikerId = player.id;
        updateData.nonStrikerName = player.name;
        updateData.nonStrikerRole = player.role || 'batsman';
        updateData.nonStrikerPhotoUrl = player.photoUrl || null;
        updateData.nonStrikerRuns = 0;
        updateData.nonStrikerBalls = 0;
      }

      await updateDoc(doc(db, 'matches', id), updateData);
      
      if (showBatsmanSelection.type === 'striker' && !match.nonStrikerId) {
        setShowBatsmanSelection({ type: 'non-striker' });
      } else {
        setShowBatsmanSelection(null);
        if (!match.bowlerId || isOverEnded) {
          setShowBowlerSelection(true);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}`);
    }
  };

  const handleSelectNewBowler = async (player: any) => {
    if (!match || !id) return;

    try {
      const updateData: any = {
        bowlerId: player.id,
        bowlerName: player.name,
        bowlerRole: player.role || 'bowler',
        bowlerPhotoUrl: player.photoUrl || null
      };

      await updateDoc(doc(db, 'matches', id), updateData);
      setShowBowlerSelection(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${id}`);
    }
  };

  if (loading) return <Loading />;
  if (!match) return <div className="min-h-screen bg-bg-primary flex items-center justify-center text-white italic font-black uppercase">Match not found</div>;

  const isTeamABatting = match.currentBattingTeamId === match.teamAId;
  const battingTeamKey = isTeamABatting ? 'teamA' : 'teamB';
  const opponentTeamKey = isTeamABatting ? 'teamB' : 'teamA';
  const score = match.score[battingTeamKey];
  const currentBatting = match[battingTeamKey + 'Name'];
  const currentOpponent = match[opponentTeamKey + 'Name'];

  // Stats calculation
  const totalBalls = Math.floor(score.overs) * 6 + (Math.round((score.overs % 1) * 10));
  const displayMaxOvers = match.maxOvers || tournament?.oversPerMatch || 20;
  const crr = totalBalls > 0 ? (score.runs / (totalBalls / 6)).toFixed(2) : "0.00";
  const projected = crr !== "0.00" ? Math.round(parseFloat(crr) * displayMaxOvers) : 0;

  // Innings completion status
  const isInningsCompleted = match.status === 'innings_completed';
  const isMatchCompleted = match.status === 'completed';

  // Current over balls (last 6 legitimate deliveries)
  const currentOverBalls = balls.filter(b => b.innings === match.currentInnings).slice(0, 6).reverse();

  const getShareableUrl = (path: string) => {
    const { protocol, host } = window.location;
    const shareableHost = host.replace("ais-dev-", "ais-pre-");
    return `${protocol}//${shareableHost}${path}`;
  };

  const handleCopyLink = () => {
    const link = getShareableUrl(`/tournament/${match.tournamentId}?liveMatchId=${id}`);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#1A1A1A] text-white">
      {/* Header */}
      <header className="px-4 h-14 flex items-center justify-between z-10 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <button 
              onClick={() => setShowTeamSelector({ type: 'batting' })}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tight italic text-brand hover:text-white transition-colors"
            >
              {currentBatting} <ChevronDown size={10} />
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTeamSelector({ type: 'opponent' })}
                className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-text-dim hover:text-white transition-colors"
              >
                vs {currentOpponent} <ChevronDown size={8} />
              </button>
              {match.venue && (
                <span className="text-[7px] text-text-dim/40 uppercase tracking-widest px-1.5 py-0.5 border border-white/5 rounded-md bg-white/[0.02]">
                  {match.venue}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-0.5 transition-all text-brand hover:text-white"
          >
            <motion.div whileTap={{ scale: 0.9 }}>
              {copiedLink ? <Check size={18} /> : <Share2 size={18} />}
            </motion.div>
            <span className="text-[7px] font-black uppercase">{copiedLink ? 'Copied' : 'Live Link'}</span>
          </button>
          {isAuthorized && (
            <>
              <button 
                onClick={handleUndo}
                disabled={balls.length === 0}
                className={`flex flex-col items-center gap-0.5 transition-all ${balls.length === 0 ? 'opacity-20 cursor-not-allowed' : 'text-brand hover:text-white'}`}
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <RotateCcw size={18} />
                </motion.div>
                <span className="text-[7px] font-black uppercase">Undo</span>
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-1 hover:text-brand transition-colors"
              >
                <Settings size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Score Display */}
        <section className="relative px-8 py-10 flex flex-col items-center justify-center bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]"></div>
          
          {/* Live Indicator */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <motion.div 
              animate={{ opacity: [1, 0.4, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60 italic">Live</span>
          </div>

          <div className="relative z-10 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-[16px]">
              <motion.span 
                key={`runs-${score.runs}`}
                initial={{ scale: 1.1, color: "#98D22C" }}
                animate={{ scale: 1, color: "#ffffff" }}
                className="text-[40px] font-black italic tracking-tighter leading-[40px]"
              >
                {score.runs}
              </motion.span>
              <span className="text-[40px] font-black italic tracking-tighter leading-[40px]">/</span>
              <motion.span 
                key={`wickets-${score.wickets}`}
                initial={{ scale: 1.2, color: "#ef4444" }}
                animate={{ scale: 1, color: "#ffffff" }}
                className="text-[40px] font-black italic tracking-tighter leading-[40px]"
              >
                {score.wickets}
              </motion.span>
              <motion.span 
                key={`overs-${score.overs}`}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="text-base font-bold text-white/50 mb-4 tracking-tighter ml-[10px]"
              >
                ({score.overs}/{displayMaxOvers})
              </motion.span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-none">
              CRR: {crr} | Projected Score: {projected} (at {crr} RPO)
            </div>
            {match.currentInnings === 2 && (
              <div className="pt-2">
                <div className="text-[11px] font-black uppercase text-brand tracking-[0.2em] italic">
                  Need {Math.max(0, (match.score[opponentTeamKey].runs + 1) - score.runs)} runs from {Math.max(0, (displayMaxOvers * 6) - totalBalls)} balls
                </div>
                <div className="text-[8px] font-bold uppercase text-white/30 tracking-widest mt-1">
                  Target: {match.score[opponentTeamKey].runs + 1}
                </div>
              </div>
            )}
          </div>
          {match.isFreeHit && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-4 right-4 bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[26px] font-black uppercase italic shadow-[0_0_30px_rgba(220,38,38,0.8)] border border-red-400 z-20 flex items-center gap-3 backdrop-blur-md"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-ping" />
              Free Hit
            </motion.div>
          )}
        </section>

        {/* Players Mini Stats */}
        <div className="grid grid-cols-2 divide-x divide-white/5 bg-[#242424] border-y border-white/5">
          <div 
            className={`p-3 pl-4 flex flex-col gap-0.5 bg-white/5 transition-colors ${isAuthorized ? 'cursor-pointer hover:bg-white/10' : ''}`}
            onClick={isAuthorized ? () => setShowBatsmanSelection({ type: 'striker' }) : undefined}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-brand/10 border border-brand/20 overflow-hidden flex items-center justify-center shrink-0">
                {match.strikerPhotoUrl ? (
                  <img src={match.strikerPhotoUrl} alt="striker" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-brand rotate-45 rounded-[1px]" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase italic text-brand leading-none">{match.strikerName || 'Select Striker'}</span>
                {match.strikerRole && (
                  <span className="text-[7px] font-bold uppercase tracking-widest text-brand/50 mt-0.5">{match.strikerRole}</span>
                )}
              </div>
            </div>
            <div className="text-sm font-black italic ml-5">
              {match.strikerRuns || 0} <span className="text-[10px] text-white/30">({match.strikerBalls || 0})</span>
            </div>
          </div>
          <div 
            className={`p-3 pl-4 flex flex-col gap-0.5 transition-colors ${isAuthorized ? 'cursor-pointer hover:bg-white/5' : ''}`}
            onClick={isAuthorized ? () => setShowBatsmanSelection({ type: 'non-striker' }) : undefined}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {match.nonStrikerPhotoUrl ? (
                  <img src={match.nonStrikerPhotoUrl} alt="non-striker" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-white/20 rotate-45 rounded-[1px]" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase italic text-white/50 leading-none">{match.nonStrikerName || 'Select Non-Striker'}</span>
                {match.nonStrikerRole && (
                  <span className="text-[7px] font-bold uppercase tracking-widest text-white/20 mt-0.5">{match.nonStrikerRole}</span>
                )}
              </div>
            </div>
            <div className="text-sm font-black italic ml-5 text-white/50">
              {match.nonStrikerRuns || 0} <span className="text-[10px] text-white/20">({match.nonStrikerBalls || 0})</span>
            </div>
          </div>
        </div>

        {/* Bowler & Over Tracker */}
        <div className="bg-[#1A1A1A] p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div 
              className={`flex items-center gap-2 p-1.5 -ml-1.5 rounded-xl transition-colors ${isAuthorized ? 'cursor-pointer hover:bg-white/5' : ''}`}
              onClick={isAuthorized ? () => setShowBowlerSelection(true) : undefined}
            >
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {match.bowlerPhotoUrl ? (
                  <img src={match.bowlerPhotoUrl} alt="bowler" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={12} className="text-white/20" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase italic leading-none">{match.bowlerName || 'Select Bowler'}</span>
                {match.bowlerRole && (
                  <span className="text-[7px] font-bold uppercase tracking-widest text-white/40 mt-0.5">{match.bowlerRole}</span>
                )}
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3].map(i => <div key={i} className="w-0.5 h-2.5 bg-brand/60 rounded-full" />)}
              </div>
            </div>
            <div className="text-[10px] font-mono font-bold text-white/40 tracking-wider">
              {score.overs} - 0 - {score.runs} - {score.wickets}
            </div>
          </div>

          <div className="flex gap-2">
            {currentOverBalls.map((ball, i) => (
              <div 
                key={`ball-${ball.id || i}`} 
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black italic transition-all
                  ${ball.isWicket ? 'bg-red-500 text-white' : 
                    ball.runs >= 4 ? 'bg-[#98D22C] text-[#1A1A1A]' : 
                    'bg-white text-[#1A1A1A]'
                  }
                `}
              >
                {ball.isWicket ? 'W' : ball.extraType ? (ball.runs + ball.extra) : ball.runs}
              </div>
            ))}
            {[...Array(6 - currentOverBalls.length)].map((_, i) => (
              <div key={`empty-${i}`} className="w-9 h-9 rounded-full border border-white/5 bg-white/5" />
            ))}
          </div>
        </div>
        {/* Ball by Ball Commentary Log */}
        <div className="flex-1 overflow-y-auto bg-[#1A1A1A] p-2 space-y-1 custom-scrollbar border-t border-white/5 flex flex-col">
          {balls.filter(b => b.innings === match.currentInnings).map((ball, i) => (
            <div key={`log-${ball.id || i}`} className="flex items-center gap-3 p-2 bg-[#242424] rounded-xl hover:bg-white/5 transition-colors border border-white/5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black italic shrink-0
                ${ball.isWicket ? 'bg-red-500 text-white' : 
                  ball.runs >= 4 ? 'bg-[#98D22C] text-[#1A1A1A]' : 
                  ball.extraType ? 'bg-orange-500 text-white' :
                  'bg-white/10 text-white'
                }
              `}>
                {ball.isWicket ? 'W' : ball.extraType ? (ball.runs + (ball.extra || 0)) + ball.extraType.toUpperCase() : ball.runs}
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/90">
                    <span className="font-black italic text-brand mr-1">{ball.bowlerName?.split(' ')[0] || 'Unknown'}</span> 
                    to <span className="font-black italic text-white mr-1">{ball.strikerName?.split(' ')[0] || 'Unknown'}</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold text-white/40">
                    {ball.overs}
                  </span>
                </div>
                <div className="text-[9px] text-white/50 tracking-wide mt-0.5 space-x-1">
                  {ball.isWicket && (
                    <span className="text-red-400 font-bold uppercase">WICKET! </span>
                  )}
                  {ball.extraType && (
                    <span className="text-orange-400 font-bold uppercase">{ball.extraType} </span>
                  )}
                  {ball.runs > 0 && !ball.isWicket && !ball.extraType && (
                    <span>{ball.runs} runs scored</span>
                  )}
                  {ball.runs === 0 && !ball.isWicket && !ball.extraType && (
                    <span>Dot ball</span>
                  )}
                  {ball.runs > 0 && ball.extraType && (
                    <span>({ball.runs} runs + {ball.extra || 0} extra)</span>
                  )}
                  {ball.commentary && (
                    <div className="mt-1.5 text-[8.5px] font-bold text-white/70 italic max-w-sm leading-snug border-l-2 border-brand/40 pl-2 py-0.5">
                      {ball.commentary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {balls.filter(b => b.innings === match.currentInnings).length === 0 && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim text-center py-4">
              End of innings or no balls bowled yet.
            </div>
          )}
        </div>
      </div>
      {/* Control Grid */}
      {isAuthorized && (
        (isInningsCompleted || isMatchCompleted) ? (
          <div className="bg-brand p-8 text-center space-y-4">
            <div className="flex flex-col items-center gap-2">
              <Trophy size={48} className="text-black" />
              <h2 className="text-2xl font-black uppercase italic text-black tracking-tighter">
                {isMatchCompleted ? 'Match Completed' : 'Innings Completed'}
              </h2>
              <p className="text-black/60 text-[10px] font-black uppercase tracking-widest italic">
                {battingTeamKey === 'teamA' ? 'First Innings Over' : 'Second Innings Over'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {match.currentInnings === 1 && !isMatchCompleted && (
                <button 
                  onClick={nextInnings}
                  className="flex-1 py-4 bg-black text-brand rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-white/10 transition-all"
                >
                  Start 2nd Innings
                </button>
              )}
              <button 
                onClick={() => setShowCompleteConfirm(true)}
                className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-black hover:text-white transition-all shadow-xl shadow-black/10"
              >
                Finalize Match
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 bg-[#242424] gap-px border-t border-white/5">
            <GridBtn value="0" onClick={() => handleRecordBall(0)} />
            <GridBtn value="1" onClick={() => handleRecordBall(1)} />
            <GridBtn value="2" onClick={() => handleRecordBall(2)} />
            <GridBtn value="3" onClick={() => handleRecordBall(3)} />
            
            <GridBtn value="4" label="FOUR" onClick={() => handleRecordBall(4)} />
            <GridBtn value="6" label="SIX" onClick={() => handleRecordBall(6)} />
            <GridBtn value="WD" label="WIDE" onClick={() => handleRecordBall(0, 'wide')} small />
            <GridBtn value="NB" label="NO BALL" onClick={() => handleRecordBall(0, 'nb')} small />
            
            <GridBtn value="B" label="BYE" onClick={() => handleRecordBall(0, 'bye')} small />
            <GridBtn value="LB" label="LEG BYE" onClick={() => handleRecordBall(0, 'lb')} small />
            <GridBtn value="5/7" label="CUSTOM" onClick={() => setShowSpecialRuns(true)} small />
            <GridBtn value="OUT" label="WICKET" onClick={() => handleRecordBall(0, null, true)} small isDanger />

            <div className="col-span-4 bg-[#1A1A1A]">
              <SideBtn 
                label="UNDO LAST EVENT" 
                color={balls.length > 0 ? "text-red-500" : "text-white/20"} 
                onClick={handleUndo} 
              />
            </div>
          </div>
        )
      )}

      {/* Batsman Selection Modal */}
      <AnimatePresence>
        {showBatsmanSelection && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-bg-secondary border border-white/10 rounded-[3rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand/10 text-brand rounded-[1.5rem] flex items-center justify-center mx-auto mb-2">
                  <User size={32} />
                </div>
                <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">New Batsman</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Who is coming to bat next?</p>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {battingSquad
                  .filter(p => p.id !== match.strikerId && p.id !== match.nonStrikerId)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectNewBatsman(p)}
                      className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-brand hover:text-black transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <User size={16} />}
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-black uppercase italic group-hover:text-black">{p.name}</div>
                        <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 group-hover:text-black/60">{p.role}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bowler Selection Modal */}
      <AnimatePresence>
        {showBowlerSelection && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-bg-secondary border border-white/10 rounded-[3rem] p-8 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-2">
                  <Activity size={32} />
                </div>
                <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">Select Bowler</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Who will bowl the next over?</p>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {bowlingSquad
                  .filter(p => p.id !== match.bowlerId)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectNewBowler(p)}
                      className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-blue-500 hover:text-white transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <User size={16} />}
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-black uppercase italic group-hover:text-white">{p.name}</div>
                        <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 group-hover:text-white/60">{p.role}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Team Selection Modal */}
      <AnimatePresence>
        {showTeamSelector && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setShowTeamSelector(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-black uppercase italic text-white tracking-tight">Select {showTeamSelector.type === 'batting' ? 'Batting' : 'Opponent'} Team</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Choose from tournament teams</p>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {availableTeams.length > 0 ? (
                  availableTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => updateTeamAssignment(team.id, team.name, showTeamSelector.type)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group ${
                        (showTeamSelector.type === 'batting' && team.name === currentBatting) ||
                        (showTeamSelector.type === 'opponent' && team.name === currentOpponent)
                          ? 'bg-brand border-brand text-black' 
                          : 'bg-white/5 border-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="font-black uppercase italic tracking-tight">{team.name}</span>
                      {((showTeamSelector.type === 'batting' && team.name === currentBatting) ||
                        (showTeamSelector.type === 'opponent' && team.name === currentOpponent)) && (
                        <Check size={16} />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim text-center">No other teams found</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowTeamSelector(null)}
                className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-white"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {pendingBall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setPendingBall(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${pendingBall.isWicket ? 'bg-red-500/10 text-red-500' : 'bg-brand/10 text-brand'}`}>
                {pendingBall.isWicket ? <AlertTriangle size={32} /> : <Check size={32} />}
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase italic text-white tracking-tight">Confirm Event?</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim leading-relaxed">
                  You are about to record a <span className="text-white">
                    {pendingBall.isWicket ? 'Wicket' : `${pendingBall.runs} Runs`}
                  </span>. Is this correct?
                </p>
              </div>

              {!pendingBall.isWicket && pendingBall.runs > 0 && (
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-dim text-center block">Where was it hit? (Optional)</label>
                  <select 
                    value={pendingBall.region || ''} 
                    onChange={e => setPendingBall({ ...pendingBall, region: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase italic text-white outline-none focus:border-brand transition-all cursor-pointer text-center"
                  >
                    <option value="">Select Region</option>
                    <option value="Third Man">Third Man</option>
                    <option value="Point">Point</option>
                    <option value="Covers">Covers</option>
                    <option value="Mid Off">Mid Off</option>
                    <option value="Straight">Straight</option>
                    <option value="Long On">Long On</option>
                    <option value="Mid Wicket">Mid Wicket</option>
                    <option value="Square Leg">Square Leg</option>
                    <option value="Fine Leg">Fine Leg</option>
                  </select>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => setPendingBall(null)}
                  className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <X size={14} /> Cancel
                </button>
                <button 
                  onClick={() => {
                    recordBall(pendingBall.runs, pendingBall.extraType, pendingBall.isWicket, pendingBall.region || null);
                    setPendingBall(null);
                  }}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase italic tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${pendingBall.isWicket ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand text-black hover:bg-white'}`}
                >
                  <Check size={14} /> Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Match Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setShowSettings(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-white/5 text-white rounded-full flex items-center justify-center mx-auto mb-2">
                  <Settings size={24} />
                </div>
                <h3 className="text-xl font-black uppercase italic text-white tracking-tight">Match Settings</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Configure teams and match details</p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowTeamSelector({ type: 'batting' });
                  }}
                  className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim">Current Batting</span>
                    <span className="font-black uppercase italic text-brand group-hover:text-white transition-colors">{currentBatting}</span>
                  </div>
                  <ChevronDown size={14} className="text-text-dim" />
                </button>

                <button 
                  onClick={() => {
                    setShowTeamSelector({ type: 'opponent' });
                  }}
                  className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all group"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-text-dim">Current Opponent (Bowling)</span>
                    <span className="font-black uppercase italic text-text-dim group-hover:text-white transition-colors">{currentOpponent}</span>
                  </div>
                  <ChevronDown size={14} className="text-text-dim" />
                </button>

                {match.currentInnings === 1 ? (
                  <button 
                    onClick={nextInnings}
                    className="w-full p-6 bg-brand text-black rounded-[2.5rem] font-black uppercase italic tracking-[0.2em] shadow-lg shadow-brand/10 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                  >
                    Start 2nd Innings
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowCompleteConfirm(true)}
                    className="w-full p-6 bg-red-500 text-white rounded-[2.5rem] font-black uppercase italic tracking-[0.2em] shadow-lg shadow-red-500/10 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                  >
                    Complete Match
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-white/5">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-white"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Safety Area */}
      <div className="h-4 bg-white" />

      {/* Special Runs Selector */}
      <AnimatePresence>
        {showSpecialRuns && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowSpecialRuns(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-xs shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase italic text-[#343A40] tracking-tight">Special Runs</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ADB5BD]">Record rare scoring events</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[5, 7].map(run => (
                  <button 
                    key={run}
                    onClick={() => {
                      handleRecordBall(run);
                      setShowSpecialRuns(false);
                    }}
                    className="h-20 bg-[#F8F9FA] border border-black/5 rounded-2xl flex flex-col items-center justify-center group hover:bg-brand transition-all"
                  >
                    <span className="text-2xl font-black italic text-[#343A40] group-hover:text-black">{run}</span>
                    <span className="text-[8px] font-black uppercase text-[#ADB5BD] group-hover:text-black/50">Runs</span>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowSpecialRuns(false)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-[#ADB5BD] hover:text-[#343A40]"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complete Match Confirmation Modal */}
      <AnimatePresence>
        {showCompleteConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !loading && setShowCompleteConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/10 space-y-6"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand mb-2">
                  <Trophy size={32} />
                </div>
                <h3 className="text-xl font-black italic text-white uppercase tracking-tight">Complete Match?</h3>
                <p className="text-sm font-medium text-text-dim">
                  This will finalize the match result and update career statistics for all players. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCompleteConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-white disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={completeMatch}
                  disabled={loading}
                  className="flex-1 py-3 bg-brand hover:bg-amber-400 text-black shadow-lg shadow-brand/20 rounded-xl font-bold uppercase text-[10px] tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Finalizing...' : 'Finalize Match'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GridBtn({ value, label, onClick, small, isDanger }: { value: string, label?: string, onClick: () => void, small?: boolean, isDanger?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95, backgroundColor: isDanger ? '#ef4444' : '#E2FF00', color: '#000' }}
      onClick={onClick}
      className={`h-[76px] flex flex-col items-center justify-center bg-[#1A1A1A] hover:bg-[#242424] transition-colors ${
        isDanger ? 'text-red-500 hover:text-red-400' : 'text-white'
      }`}
    >
      <span className={`${small ? 'text-xl' : 'text-3xl'} font-black italic`}>{value}</span>
      {label && <span className={`text-[8px] font-bold uppercase ${isDanger ? 'text-red-500/80' : 'text-white/40'} mt-1 tracking-widest`}>{label}</span>}
    </motion.button>
  );
}

function SideBtn({ label, color = "text-white/60", onClick }: { label: string, color?: string, onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98, backgroundColor: '#242424' }}
      onClick={onClick}
      className={`h-[76px] w-full flex items-center justify-center bg-[#1A1A1A] hover:bg-[#242424] transition-colors ${color} font-black uppercase italic text-xs tracking-widest`}
    >
      {label}
    </motion.button>
  );
}
