import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('app/api/agent/route.ts', 'utf8');

const oldEnd = `    const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) return NextResponse.json({ type: "message", text: raw });
    return NextResponse.json(JSON.parse(jsonMatch[0]));`;

const newEnd = `    const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) return NextResponse.json({ type: "message", text: raw });
    const obj = JSON.parse(jsonMatch[0]);
    if (obj.to) {
      const addrMatch = obj.to.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      if (addrMatch) obj.to = addrMatch[0];
    }
    return NextResponse.json(obj);`;

c = c.replace(oldEnd, newEnd);
writeFileSync('app/api/agent/route.ts', c);
console.log('Done');
