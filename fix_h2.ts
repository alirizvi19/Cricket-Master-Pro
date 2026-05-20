import * as fs from 'fs';
import * as path from 'path';

let content = fs.readFileSync(path.join(process.cwd(), 'src/pages/TournamentDetail.tsx'), 'utf-8');

content = content.replace(/className="text-3xl font/g, 'className="text-2xl sm:text-3xl font');
content = content.replace(/className="text-2xl font/g, 'className="text-xl sm:text-2xl font');
content = content.replace(/className="text-xl font/g, 'className="text-lg sm:text-xl font');
content = content.replace(/className="text-4xl font/g, 'className="text-3xl sm:text-4xl font');
content = content.replace(/className="text-5xl md:text-6xl font/g, 'className="text-3xl sm:text-5xl md:text-6xl font');

// Also do Dashboard, Tournaments, etc.
const pages = ['src/pages/Dashboard.tsx', 'src/pages/Scoring.tsx', 'src/pages/Tournaments.tsx'];
for (const p of pages) {
  if (fs.existsSync(p)) {
      let c = fs.readFileSync(p, 'utf-8');
      c = c.replace(/className="text-3xl font/g, 'className="text-2xl sm:text-3xl font');
      c = c.replace(/className="text-2xl font/g, 'className="text-xl sm:text-2xl font');
      c = c.replace(/className="text-4xl font/g, 'className="text-3xl sm:text-4xl font');
      fs.writeFileSync(p, c);
  }
}

fs.writeFileSync(path.join(process.cwd(), 'src/pages/TournamentDetail.tsx'), content);
