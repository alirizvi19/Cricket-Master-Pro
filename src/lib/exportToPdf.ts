import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export async function exportTournamentToPDF(tournamentId: string) {
  // 1. Fetch data
  const tournamentDoc = await getDoc(doc(db, "tournaments", tournamentId));
  if (!tournamentDoc.exists()) throw new Error("Tournament not found");
  const tournament = tournamentDoc.data();

  const teamsSnap = await getDocs(
    query(collection(db, "teams"), where("tournamentId", "==", tournamentId)),
  );
  const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const matchesSnap = await getDocs(
    query(collection(db, "matches"), where("tournamentId", "==", tournamentId)),
  );
  const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const teamsWithPlayers = await Promise.all(
    teams.map(async (t) => {
      const playersSnap = await getDocs(
        query(collection(db, "players"), where("teamId", "==", t.id)),
      );
      t.fullPlayers = playersSnap.docs.map((p) => ({
        id: p.id,
        ...(p.data() as any),
      }));

      // Calculate standings for this team
      const teamMatches = matches.filter(
        (m) =>
          m.status === "completed" &&
          (m.teamAId === t.id || m.teamBId === t.id),
      );
      const won = teamMatches.filter((m) => m.winnerId === t.id).length;
      const lost = teamMatches.filter(
        (m) => m.winnerId && m.winnerId !== t.id && m.winnerId !== "tie",
      ).length;
      const tied = teamMatches.filter((m) => m.winnerId === "tie").length;

      let totalRunsScored = 0;
      let totalOversFaced = 0;
      let totalRunsConceded = 0;
      let totalOversBowled = 0;

      teamMatches.forEach((m) => {
        const isTeamA = m.teamAId === t.id;
        const ownScore = isTeamA ? m.score.teamA : m.score.teamB;
        const oppScore = isTeamA ? m.score.teamB : m.score.teamA;
        const maxOvers = m.maxOvers || 20;

        totalRunsScored += ownScore?.runs || 0;
        totalRunsConceded += oppScore?.runs || 0;

        if (ownScore?.wickets >= 10) {
          totalOversFaced += maxOvers;
        } else {
          totalOversFaced +=
            Math.floor(ownScore?.overs || 0) + (((ownScore?.overs || 0) % 1) * 10) / 6;
        }

        if (oppScore?.wickets >= 10) {
          totalOversBowled += maxOvers;
        } else {
          totalOversBowled +=
            Math.floor(oppScore?.overs || 0) + (((oppScore?.overs || 0) % 1) * 10) / 6;
        }
      });

      const nrrValue =
        totalOversFaced > 0 && totalOversBowled > 0
          ? totalRunsScored / totalOversFaced -
            totalRunsConceded / totalOversBowled
          : 0;

      t.standings = {
        played: teamMatches.length,
        won,
        lost,
        tied,
        points: won * 2 + tied * 1,
        nrr: nrrValue,
      };

      return t;
    }),
  );

  // 2. Setup PDF document
  const docPdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
  });

  const pageWidth = docPdf.internal.pageSize.getWidth();

  // Draw Header
  docPdf.setFillColor(152, 210, 44); // Brand lime color
  docPdf.rect(0, 0, pageWidth, 40, "F");

  docPdf.setTextColor(255, 255, 255);
  docPdf.setFontSize(24);
  docPdf.setFont("helvetica", "bold");
  docPdf.text("TOURNAMENT SCORECARD", pageWidth / 2, 20, { align: "center" });

  docPdf.setFontSize(12);
  docPdf.setFont("helvetica", "normal");
  docPdf.text(`Event: ${tournament.name}`, pageWidth / 2, 30, { align: "center" });

  let yOffset = 50;

  // 3. Teams & Matches summary table
  docPdf.setTextColor(0, 0, 0);
  docPdf.setFontSize(16);
  docPdf.setFont("helvetica", "bold");
  docPdf.text("Team Standings", 14, yOffset);
  yOffset += 5;

  teamsWithPlayers.sort((a, b) => {
    if (a.standings.points !== b.standings.points) {
      return b.standings.points - a.standings.points;
    }
    return b.standings.nrr - a.standings.nrr;
  });

  const teamHeaders = [
    ["Team Name", "Played", "Won", "Lost", "Points", "Net Run Rate"],
  ];
  const teamData = teamsWithPlayers.map((t) => [
    t.name,
    t.standings.played || 0,
    t.standings.won || 0,
    t.standings.lost || 0,
    t.standings.points || 0,
    t.standings.nrr.toFixed(3) || 0,
  ]);

  autoTable(docPdf, {
    startY: yOffset,
    head: teamHeaders,
    body: teamData,
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    margin: { top: 10, right: 14, bottom: 10, left: 14 },
    didDrawPage: (data) => {
      // Add footer logic if needed
    },
  });

  yOffset = (docPdf as any).lastAutoTable.finalY + 15;

  // 4. Player Stats table
  docPdf.setFontSize(16);
  docPdf.setFont("helvetica", "bold");
  docPdf.text("Player Statistics", 14, yOffset);
  yOffset += 5;

  const playerHeaders = [
    ["Player Name", "Team", "Runs", "Avg", "Wickets", "Econ"],
  ];
  const playerData: any[] = [];

  teamsWithPlayers.forEach((t) => {
    (t.fullPlayers || []).forEach((p: any) => {
      playerData.push([
        p.name,
        t.shortName || t.name,
        p.totalRuns || 0,
        (p.battingAverage || 0).toFixed(1),
        p.totalWickets || 0,
        (p.economyRate || 0).toFixed(1),
      ]);
    });
  });

  autoTable(docPdf, {
    startY: yOffset,
    head: playerHeaders,
    body: playerData,
    theme: "striped",
    headStyles: { fillColor: [152, 210, 44], textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    margin: { top: 10, right: 14, bottom: 10, left: 14 },
  });

  // 5. Save the PDF
  docPdf.save(`Scorecard_${tournament.name.replace(/\s+/g, "_")}.pdf`);
}
