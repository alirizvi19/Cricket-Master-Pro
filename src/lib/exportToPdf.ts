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

  const teamsWithPlayers = await Promise.all(
    teams.map(async (t) => {
      const playersSnap = await getDocs(
        query(collection(db, "players"), where("teamId", "==", t.id)),
      );
      t.fullPlayers = playersSnap.docs.map((p) => ({
        id: p.id,
        ...(p.data() as any),
      }));
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

  const teamHeaders = [
    ["Team Name", "Played", "Won", "Lost", "Net Run Rate"],
  ];
  const teamData = teamsWithPlayers.map((t) => [
    t.name,
    t.matchesPlayed || 0,
    t.wins || 0,
    t.losses || 0,
    t.netRunRate || 0,
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
