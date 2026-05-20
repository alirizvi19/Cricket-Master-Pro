import * as fs from 'fs';
import * as path from 'path';

const files = [
  'src/pages/TournamentDetail.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Scoring.tsx',
  'src/pages/Tournaments.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');

  content = content.replace(/\\bpy-4\\b/g, 'py-3 sm:py-4');
  content = content.replace(/\\bpy-5\\b/g, 'py-3.5 sm:py-5');
  content = content.replace(/\\bgap-6\\b/g, 'gap-4 sm:gap-6');
  content = content.replace(/\\bgap-8\\b/g, 'gap-4 sm:gap-8');
  content = content.replace(/\\bpx-6\\b/g, 'px-4 sm:px-6');
  content = content.replace(/\\brounded-2xl\\b/g, 'rounded-xl sm:rounded-2xl');
  content = content.replace(/\\brounded-3xl\\b/g, 'rounded-2xl sm:rounded-3xl');
  content = content.replace(/\\brounded-\\[2.5rem\\]\\b/g, 'rounded-3xl sm:rounded-[2.5rem]');
  content = content.replace(/\\brounded-\\[3rem\\]\\b/g, 'rounded-[2rem] sm:rounded-[3rem]');
  content = content.replace(/sm:rounded-xl sm:rounded-2xl/g, 'sm:rounded-2xl');
  content = content.replace(/sm:gap-4 sm:gap-6/g, 'sm:gap-6');
  content = content.replace(/sm:gap-4 sm:gap-8/g, 'sm:gap-8');
  content = content.replace(/sm:px-4 sm:px-6/g, 'sm:px-6');
  content = content.replace(/sm:py-3 sm:py-4/g, 'sm:py-4');
  content = content.replace(/sm:py-3.5 sm:py-5/g, 'sm:py-5');
  
  fs.writeFileSync(filePath, content, 'utf-8');
}
console.log('Styles updated.');
