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
  const teamsSheetId = sheetData.sheets[0].properties.sheetId;
  const playersSheetId = sheetData.sheets[1].properties.sheetId;

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

  // Helper macro for repeating cell formats (Header styling)
  const getHeaderFormat = (sheetId: number) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.596, green: 0.823, blue: 0.172 }, // #98D22C Brand Lime
          textFormat: {
            bold: true,
            foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
            fontSize: 12
          },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        }
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
    }
  });

  // Helper for overall sheet styling (Dark Theme)
  const getBodyFormat = (sheetId: number) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 }, // #1a1a1a Dark Gray
          textFormat: {
            foregroundColor: { red: 0.9, green: 0.9, blue: 0.9 }, // #e6e6e6 Off-white
            fontSize: 10
          },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          borders: {
            top: { style: "SOLID", color: { red: 0.15, green: 0.15, blue: 0.15 } },
            bottom: { style: "SOLID", color: { red: 0.15, green: 0.15, blue: 0.15 } },
            left: { style: "SOLID", color: { red: 0.15, green: 0.15, blue: 0.15 } },
            right: { style: "SOLID", color: { red: 0.15, green: 0.15, blue: 0.15 } }
          }
        }
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)"
    }
  });

  // Prepare batch requests array
  const requests: any[] = [];
  
  [teamsSheetId, playersSheetId].forEach(sheetId => {
    requests.push(getHeaderFormat(sheetId));
    requests.push(getBodyFormat(sheetId));
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: 12
        }
      }
    });
  });

  // 4. Write data and apply formatting
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

  // 5. Apply formatting
  const formatRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests
    })
  });

  if (!formatRes.ok) {
    console.error("Failed to apply spreadsheet formatting", await formatRes.json());
    // Not throwing here because the data is already written
  }

  return sheetUrl;
}
