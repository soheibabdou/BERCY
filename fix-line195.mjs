import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('app/page.tsx', 'utf8');

// Remove the broken line 195 and replace with clean version
const broken = /\{showSend.*?SendModal.*?\/\>.*?\}/s;

c = c.replace(
  /      \{showSend [^\n]+\n/,
  `      {showSend && <SendModal initialToken={preFill?.token ?? "SOL"} initialTo={preFill?.to ?? ""} initialAmount={preFill?.amount ?? ""} onClose={() => { setShowSend(false); setPreFill(null); walletAddress && load(walletAddress); }} />\n`
);

writeFileSync('app/page.tsx', c);
console.log('Done');
