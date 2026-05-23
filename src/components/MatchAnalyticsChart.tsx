import React, { useState } from "react";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { TrendingUp, Award, Shield, AlertCircle } from "lucide-react";

interface Ball {
  innings: number;
  over?: number;
  runs: number;
  extra?: number;
  isWicket: boolean;
  wicketType?: string;
  strikerName?: string;
  bowlerName?: string;
}

interface Match {
  teamAName: string;
  teamBName: string;
  score: {
    teamA: { runs: number; wickets: number; overs: number };
    teamB: { runs: number; wickets: number; overs: number };
  };
}

interface MatchAnalyticsChartProps {
  balls: Ball[];
  match: Match;
}

export default function MatchAnalyticsChart({ balls, match }: MatchAnalyticsChartProps) {
  const [chartMode, setChartMode] = useState<"over" | "cumulative">("over");

  // Safeguard if no balls have been bowled
  if (!balls || balls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] text-center">
        <AlertCircle size={40} className="text-text-dim mb-4" />
        <h4 className="text-sm font-black uppercase tracking-widest text-white mb-2">
          No Analytics Available
        </h4>
        <p className="text-xs text-text-dim max-w-sm">
          Run progression and wicket charts will populate as soon as the first legitimate balls of the match are recorded.
        </p>
      </div>
    );
  }

  // 1. Group balls by over for each innings
  const inn1Balls = balls.filter((b) => b.innings === 1);
  const inn2Balls = balls.filter((b) => b.innings === 2);

  const getOversData = (innBalls: Ball[]) => {
    const oversMap: Record<number, { runs: number; wickets: number; balls: Ball[] }> = {};
    innBalls.forEach((ball, idx) => {
      // Fallback to balls-based over index if 'over' is not defined
      const overNum = ball.over !== undefined ? ball.over : Math.floor(idx / 6);
      if (!oversMap[overNum]) {
        oversMap[overNum] = { runs: 0, wickets: 0, balls: [] };
      }
      oversMap[overNum].runs += (ball.runs || 0) + (ball.extra || 0);
      if (ball.isWicket) {
        oversMap[overNum].wickets += 1;
      }
      oversMap[overNum].balls.push(ball);
    });
    return oversMap;
  };

  const inn1Overs = getOversData(inn1Balls);
  const inn2Overs = getOversData(inn2Balls);

  // Maximum over registered
  const maxOver = Math.max(
    ...Object.keys(inn1Overs).map(Number),
    ...Object.keys(inn2Overs).map(Number),
    0
  );

  // Parse chronological progression
  const chartData = [];
  let teamACumulative = 0;
  let teamBCumulative = 0;

  for (let i = 0; i <= maxOver; i++) {
    const inn1Over = inn1Overs[i];
    const inn2Over = inn2Overs[i];

    // Check if team actually recorded balls in this over
    const hasTeamABalls = inn1Over !== undefined;
    const hasTeamBBalls = inn2Over !== undefined;

    const teamARuns = hasTeamABalls ? inn1Over.runs : (inn1Balls.length > 0 && i < Object.keys(inn1Overs).length ? 0 : null);
    const teamAWickets = hasTeamABalls ? inn1Over.wickets : (inn1Balls.length > 0 && i < Object.keys(inn1Overs).length ? 0 : null);
    if (inn1Over) teamACumulative += inn1Over.runs;

    const teamBRuns = hasTeamBBalls ? inn2Over.runs : (inn2Balls.length > 0 && i < Object.keys(inn2Overs).length ? 0 : null);
    const teamBWickets = hasTeamBBalls ? inn2Over.wickets : (inn2Balls.length > 0 && i < Object.keys(inn2Overs).length ? 0 : null);
    if (inn2Over) teamBCumulative += inn2Over.runs;

    chartData.push({
      overIndex: i,
      overNumber: i + 1,
      overLabel: `Over ${i + 1}`,
      // Innings 1 (Team A)
      teamARuns: teamARuns !== null ? teamARuns : undefined,
      teamAWickets: teamAWickets !== null ? teamAWickets : undefined,
      teamACumulative: inn1Balls.length > 0 && i < Object.keys(inn1Overs).length ? teamACumulative : undefined,
      // Innings 2 (Team B)
      teamBRuns: teamBRuns !== null ? teamBRuns : undefined,
      teamBWickets: teamBWickets !== null ? teamBWickets : undefined,
      teamBCumulative: inn2Balls.length > 0 && i < Object.keys(inn2Overs).length ? teamBCumulative : undefined,
    });
  }

  // Calculate stats to show in insights block
  const maxOverScoreTeamA = Math.max(...Object.values(inn1Overs).map((o) => o.runs), 0);
  const maxOverScoreTeamB = Math.max(...Object.values(inn2Overs).map((o) => o.runs), 0);
  
  const topOverTeamA = Object.keys(inn1Overs).find((k) => inn1Overs[Number(k)].runs === maxOverScoreTeamA);
  const topOverTeamB = Object.keys(inn2Overs).find((k) => inn2Overs[Number(k)].runs === maxOverScoreTeamB);

  // Find highest runs scored in a single over across both teams to award best over trophy
  let maxBestOverRuns = 0;
  let bestOverInfo: { overIndex: number; teamKey: "teamA" | "teamB" } | null = null;

  chartData.forEach((entry) => {
    if (entry.teamARuns !== undefined && entry.teamARuns > maxBestOverRuns) {
      maxBestOverRuns = entry.teamARuns;
      bestOverInfo = { overIndex: entry.overIndex, teamKey: "teamA" };
    }
    if (entry.teamBRuns !== undefined && entry.teamBRuns > maxBestOverRuns) {
      maxBestOverRuns = entry.teamBRuns;
      bestOverInfo = { overIndex: entry.overIndex, teamKey: "teamB" };
    }
  });

  // Custom high precision Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-widest text-text-dim font-black italic mb-3">
            Over {label} Stats
          </p>
          <div className="space-y-3 font-medium">
            {/* Team A */}
            {payload.some((p: any) => p.dataKey === "teamARuns" || p.dataKey === "teamACumulative") && (
              <div className="flex items-center justify-between gap-8 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span className="text-xs uppercase font-bold text-white max-w-[100px] truncate">
                    {match.teamAName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black italic text-brand">
                    {chartMode === "over" 
                      ? `${payload.find((p: any) => p.dataKey === "teamARuns")?.value || 0} Runs`
                      : `${payload.find((p: any) => p.dataKey === "teamACumulative")?.value || 0} Cumulative`
                    }
                  </span>
                  {chartMode === "over" && (
                    <span className="text-[10px] text-text-dim block text-right font-mono">
                      {chartData[label - 1]?.teamAWickets || 0} Wickets
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Team B */}
            {payload.some((p: any) => p.dataKey === "teamBRuns" || p.dataKey === "teamBCumulative") && (
              <div className="flex items-center justify-between gap-8 border-t border-white/5 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xs uppercase font-bold text-white max-w-[100px] truncate">
                    {match.teamBName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black italic text-cyan-400">
                    {chartMode === "over"
                      ? `${payload.find((p: any) => p.dataKey === "teamBRuns")?.value || 0} Runs`
                      : `${payload.find((p: any) => p.dataKey === "teamBCumulative")?.value || 0} Cumulative`
                    }
                  </span>
                  {chartMode === "over" && (
                    <span className="text-[10px] text-text-dim block text-right font-mono">
                      {chartData[label - 1]?.teamBWickets || 0} Wickets
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Label rendering for wicket pins directly on top of the bars!
  const renderCustomWicketLabel = (props: any, teamKey: "teamAWickets" | "teamBWickets") => {
    const { x, y, width, index } = props;
    if (index === undefined) return null;
    const wickets = chartData[index]?.[teamKey];

    if (wickets && wickets > 0) {
      return (
        <g key={`wicket-pin-${teamKey}-${index}`}>
          {/* Glowing pin anchor line */}
          <line 
            x1={x + width / 2} 
            y1={y} 
            x2={x + width / 2} 
            y2={y - 14} 
            stroke="#ef4444" 
            strokeWidth="1.5" 
            strokeDasharray="1 1"
          />
          {/* Pin head */}
          <circle cx={x + width / 2} cy={y - 14} r="7.5" fill="#ef4444" className="shadow-lg" />
          <text 
            x={x + width / 2} 
            y={y - 11.5} 
            fill="#fff" 
            fontSize="8px" 
            fontFamily="monospace"
            fontWeight="900" 
            textAnchor="middle"
          >
            W
          </text>
        </g>
      );
    }
    return null;
  };

  // Custom Label rendering for the best over trophy badge!
  const renderTrophyBadge = (props: any, teamKey: "teamA" | "teamB") => {
    const { x, y, width, index } = props;
    if (index === undefined || !bestOverInfo) return null;

    if (bestOverInfo.overIndex === index && bestOverInfo.teamKey === teamKey) {
      const cx = x + width / 2;
      const cy = y - 18;
      return (
        <g key={`trophy-${teamKey}-${index}`} className="pointer-events-none select-none">
          {/* Thin gold connector line */}
          <line 
            x1={cx} 
            y1={y} 
            x2={cx} 
            y2={cy} 
            stroke="#FBBF24" 
            strokeWidth="1.5" 
          />
          {/* Badge container with gold-amber styling */}
          <circle cx={cx} cy={cy} r="9" fill="#1E1B4B" stroke="#FBBF24" strokeWidth="1.5" className="filter drop-shadow-sm" />
          {/* Mini elegant trophy */}
          <g transform={`translate(${cx - 5.5}, ${cy - 5.5})`} fill="#FBBF24">
            <path d="M 1.5 2 C 1.5 1 2.5 0 5.5 0 C 8.5 0 9.5 1 9.5 2 C 9.5 3.5 8.5 4.5 7 4.9 L 7 6 L 8 6 C 8.5 6 9 6.5 9 7 L 2 7 C 2 6.5 2.5 6 3 6 L 4 6 L 4 4.9 C 2.5 4.5 1.5 3.5 1.5 2 Z" />
            <path d="M 0.5 1.5 C 0.5 0.8 1 0.5 1.5 0.5 L 1.5 2.5 C 1 2.5 0.5 2.1 0.5 1.5 Z" />
            <path d="M 10.5 1.5 C 10.5 2.1 10 2.5 9.5 2.5 L 9.5 0.5 C 10 0.5 10.5 0.8 10.5 1.5 Z" />
          </g>
        </g>
      );
    }
    return null;
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 space-y-8 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-brand animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand">
              Innings Performance Map
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white italic">
            Visual Scorecard & Progression
          </h3>
        </div>

        {/* Chart Mode Toggle */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-1 flex relative">
          <button
            onClick={() => setChartMode("over")}
            className={`relative px-4 py-2 text-[9px] font-black uppercase tracking-wider italic rounded-xl transition-all z-10 ${chartMode === "over" ? "text-white" : "text-text-dim hover:text-white"}`}
          >
            {chartMode === "over" && (
              <motion.div
                layoutId="activeChartTab"
                className="absolute inset-0 bg-white/10 rounded-xl"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            Over-by-Over Runs
          </button>
          <button
            onClick={() => setChartMode("cumulative")}
            className={`relative px-4 py-2 text-[9px] font-black uppercase tracking-wider italic rounded-xl transition-all z-10 ${chartMode === "cumulative" ? "text-white" : "text-text-dim hover:text-white"}`}
          >
            {chartMode === "cumulative" && (
              <motion.div
                layoutId="activeChartTab"
                className="absolute inset-0 bg-white/10 rounded-xl"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            Cumulative Climb
          </button>
        </div>
      </div>

      {/* Main Chart viewport */}
      <div className="w-full h-[320px] bg-black/10 rounded-3xl p-4 border border-white/5 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 25, right: 10, left: -20, bottom: 0 }}
            barGap={4}
          >
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFE57F" />
                <stop offset="40%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="overNumber"
              stroke="#6b7280"
              fontSize={10}
              fontWeight="bold"
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={10}
              fontWeight="bold"
              tickLine={false}
              axisLine={false}
              dx={-5}
              label={
                chartMode === "cumulative"
                  ? { value: "Cumulative Runs", angle: -90, position: "insideLeft", fill: "#4b5563", fontSize: 9, fontWeight: "bold", dy: 40 }
                  : { value: "Runs in Over", angle: -90, position: "insideLeft", fill: "#4b5563", fontSize: 9, fontWeight: "bold", dy: 30 }
              }
            />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.02)" }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", paddingBottom: 15 }}
            />

            {/* Over-by-Over Chart Series */}
            {chartMode === "over" && (
              <>
                <Bar
                   name={match.teamAName}
                   dataKey="teamARuns"
                   fill="#FACC15"
                   radius={[4, 4, 0, 0]}
                   maxBarSize={30}
                >
                  {chartData.map((entry, index) => {
                    const isBest = bestOverInfo?.overIndex === index && bestOverInfo?.teamKey === "teamA";
                    return (
                      <Cell 
                        key={`cell-a-${index}`} 
                        fill={isBest ? "url(#goldGradient)" : "#FACC15"} 
                        fillOpacity={entry.teamARuns !== undefined ? 1 : 0.1} 
                      />
                    );
                  })}
                  {/* Pin Wickets & Trophy directly above respective Team A bars */}
                  <LabelList content={(props) => renderCustomWicketLabel(props, "teamAWickets")} />
                  <LabelList content={(props) => renderTrophyBadge(props, "teamA")} />
                </Bar>
                <Bar
                   name={match.teamBName}
                   dataKey="teamBRuns"
                   fill="#22d3ee"
                   radius={[4, 4, 0, 0]}
                   maxBarSize={30}
                >
                  {chartData.map((entry, index) => {
                    const isBest = bestOverInfo?.overIndex === index && bestOverInfo?.teamKey === "teamB";
                    return (
                      <Cell 
                        key={`cell-b-${index}`} 
                        fill={isBest ? "url(#goldGradient)" : "#22d3ee"} 
                        fillOpacity={entry.teamBRuns !== undefined ? 1 : 0.1} 
                      />
                    );
                  })}
                  {/* Pin Wickets & Trophy directly above respective Team B bars */}
                  <LabelList content={(props) => renderCustomWicketLabel(props, "teamBWickets")} />
                  <LabelList content={(props) => renderTrophyBadge(props, "teamB")} />
                </Bar>
              </>
            )}

            {/* Cumulative Run Climb Series */}
            {chartMode === "cumulative" && (
              <>
                <Bar
                  name={match.teamAName}
                  dataKey="teamACumulative"
                  fill="#FACC15"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-a-cum-${index}`} fill="#FACC15" fillOpacity={entry.teamACumulative !== undefined ? 1 : 0.05} />
                  ))}
                </Bar>
                <Bar
                  name={match.teamBName}
                  dataKey="teamBCumulative"
                  fill="#22d3ee"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-b-cum-${index}`} fill="#22d3ee" fillOpacity={entry.teamBCumulative !== undefined ? 1 : 0.05} />
                  ))}
                </Bar>
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Analytics Insights Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A Highlights */}
        {inn1Balls.length > 0 && (
          <div className="bg-white/5 border border-white/5 p-5 rounded-3xl flex items-start gap-4 hover:bg-white/10 transition-all">
            <div className="p-3 bg-brand/20 text-brand rounded-2xl shrink-0 mt-0.5">
              <Award size={18} />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-brand tracking-widest mb-1">
                {match.teamAName} Progression Details
              </h4>
              <p className="text-xs text-white leading-relaxed font-bold">
                Hammered a peak of <span className="text-brand font-black italic">{maxOverScoreTeamA} runs</span> in{" "}
                <span className="text-white italic">Over {topOverTeamA ? Number(topOverTeamA) + 1 : "?"}</span>.{" "}
                Lost {match.score.teamA.wickets} wickets over {match.score.teamA.overs} overs with a final score of{" "}
                <span className="font-mono text-brand font-black">{match.score.teamA.runs}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Team B Highlights */}
        {inn2Balls.length > 0 && (
          <div className="bg-white/5 border border-white/5 p-5 rounded-3xl flex items-start gap-4 hover:bg-white/10 transition-all">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl shrink-0 mt-0.5">
              <Shield size={18} />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-cyan-400 tracking-widest mb-1">
                {match.teamBName} Progression Details
              </h4>
              <p className="text-xs text-white leading-relaxed font-bold">
                Hammered a peak of <span className="text-cyan-400 font-black italic">{maxOverScoreTeamB} runs</span> in{" "}
                <span className="text-white italic">Over {topOverTeamB ? Number(topOverTeamB) + 1 : "?"}</span>.{" "}
                Lost {match.score.teamB.wickets} wickets over {match.score.teamB.overs} overs, executing a final score of{" "}
                <span className="font-mono text-cyan-400 font-black">{match.score.teamB.runs}</span>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
