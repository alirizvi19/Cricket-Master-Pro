import * as fs from 'fs';
import * as path from 'path';

let content = fs.readFileSync(path.join(process.cwd(), 'src/pages/TournamentDetail.tsx'), 'utf-8');

content = content.replace(/<div className="font-bold text-white text-sm">\s*\{p\.name \|\| "Unknown Player"\}\s*<\/div>/g, 
  `<div className="font-bold text-white text-xs sm:text-sm">\n                      {p.name || "Unknown Player"}\n                    </div>`);

fs.writeFileSync(path.join(process.cwd(), 'src/pages/TournamentDetail.tsx'), content);
