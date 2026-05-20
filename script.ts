import * as fs from 'fs';
import * as path from 'path';

const files = [
  'src/pages/TournamentDetail.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Scoring.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');

  // Regex replacements for better mobile responsiveness
  // Buttons and padding
  content = content.replace(/\\bp-12\\b/g, 'p-6 sm:p-12');
  content = content.replace(/\\bp-10\\b/g, 'p-6 sm:p-10');
  content = content.replace(/\\bp-8\\b/g, 'p-5 sm:p-8');
  content = content.replace(/\\bp-6\\b/g, 'p-4 sm:p-6');
  content = content.replace(/\\bpx-8 py-4\\b/g, 'px-5 py-3 sm:px-8 sm:py-4');
  content = content.replace(/\\bpx-6 py-[34]\\b/g, 'px-4 py-2.5 sm:px-6 sm:py-3.5');
  content = content.replace(/\\bpx-4 py-3\\b/g, 'px-3 py-2 sm:px-4 sm:py-3');
  
  // Specific buttons / sizes
  content = content.replace(/\\bw-14 h-14\\b/g, 'w-10 h-10 sm:w-14 sm:h-14');
  content = content.replace(/\\bw-16 h-16\\b/g, 'w-12 h-12 sm:w-16 sm:h-16');
  content = content.replace(/\\btext-4xl md:text-6xl\\b/g, 'text-3xl sm:text-4xl md:text-6xl');
  content = content.replace(/\\btext-2xl\\b/g, 'text-xl sm:text-2xl');
  content = content.replace(/\\btext-xl\\b/g, 'text-lg sm:text-xl');

  // Some text elements
  content = content.replace(/\\btext-\\[10px\\]\\b/g, 'text-[9px] sm:text-[10px]');
  content = content.replace(/\\btext-\\[11px\\]\\b/g, 'text-[10px] sm:text-[11px]');
  
  // Clean up duplicate sm: replacements just in case
  content = content.replace(/sm:sm:/g, 'sm:');
  content = content.replace(/sm:p-5 sm:p-8/g, 'sm:p-8');
  content = content.replace(/sm:p-4 sm:p-6/g, 'sm:p-6');
  content = content.replace(/sm:p-6 sm:p-12/g, 'sm:p-12');
  content = content.replace(/sm:p-6 sm:p-10/g, 'sm:p-10');

  // Register Team button from TournamentDetail
  content = content.replace(
    /px-6 py-4 sm:px-10 sm:py-5 rounded-2xl font-black uppercase italic tracking-widest text-\\[10px\\] sm:text-\\[11px\\]/g,
    'px-4 py-3 sm:px-10 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase italic tracking-widest text-[9px] sm:text-[11px]'
  );

  fs.writeFileSync(filePath, content, 'utf-8');
}
console.log('Styles updated.');
