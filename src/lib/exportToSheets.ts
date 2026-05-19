import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function exportTournamentToSheets(tournamentId: string, accessToken: string) {
  // 1. Fetch data
  const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tournamentDoc.exists()) throw new Error('Tournament not found');
  const tournament = tournamentDoc.data();

  const teamsSnap = await getDocs(query(collection(db, 'teams'), where('tournamentId', '==', tournamentId)));
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  const teamsWithPlayers = await Promise.all(teams.map(async t => {
    const playersSnap = await getDocs(query(collection(db, 'players'), where('teamId', '==', t.id)));
    t.fullPlayers = playersSnap.docs.map(p => ({ id: p.id, ...p.data() as any }));
    return t;
  }));

  // 2. Create Sheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `Tournament Stats: ${tournament.name}`,
      },
      sheets: [
        { properties: { title: "Teams & Matches" } },
        { properties: { title: "Player Stats" } }
      ]
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error('Failed to create spreadsheet: ' + error.error?.message);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const sheetUrl = sheetData.spreadsheetUrl;

  // 3. Prepare data for Teams
  const teamsRows = [
    ["Team Name", "Played", "Won", "Lost", "Net Run Rate"]
  ];
  teamsWithPlayers.forEach(t => {
    teamsRows.push([
      t.name,
      t.matchesPlayed || 0,
      t.wins || 0,
      t.losses || 0,
      t.netRunRate || 0
    ]);
  });

  // Prepare data for Players
  const playersRows = [
    ["Player Name", "Team Name", "Role", "Matches", "Runs", "Highest Score", "Batting Avg", "Wickets", "Bowling Avg", "Economy"]
  ];
  teamsWithPlayers.forEach(t => {
    (t.fullPlayers || []).forEach((p: any) => {
      playersRows.push([
        p.name,
        t.name,
        p.role,
        p.matchesPlayed || 0,
        p.totalRuns || 0,
        p.highestScore || 0,
        p.battingAverage || 0,
        p.totalWickets || 0,
        p.bowlingAverage || 0,
        p.economyRate || 0
      ]);
    });
  });

  // 4. Write data
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: [
        {
          range: "'Teams & Matches'!A1",
          values: teamsRows
        },
        {
          range: "'Player Stats'!A1",
          values: playersRows
        }
      ]
    })
  });

  if (!updateRes.ok) {
    throw new Error('Failed to update spreadsheet cells');
  }

  return sheetUrl;
}
