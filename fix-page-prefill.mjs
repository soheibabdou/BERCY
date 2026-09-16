import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('app/page.tsx', 'utf8');

c = c.replace(
  `{showSend && <SendModal onClose={() => { setShowSend(false); setPreFill(null); }} />}`,
  `{showSend && <SendModal
        initialToken={preFill?.token ?? "SOL"}
        initialTo={preFill?.to ?? ""}
        initialAmount={preFill?.amount ?? ""}
        onClose={() => { setShowSend(false); setPreFill(null); }}
      />}`
);

writeFileSync('app/page.tsx', c);
console.log('Done');
