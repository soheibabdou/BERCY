import { readFileSync, writeFileSync, existsSync } from 'fs';

const routes = [
  'app/api/agent/route.ts',
  'app/api/send/route.ts',
  'app/api/tokens/route.ts',
];

const importLine = "import { rateLimit } from '@/lib/rateLimit';\n";
const limitCheck = `
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = rateLimit(ip);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Wait 1 minute.' }, { status: 429 });
`;

for (const path of routes) {
  if (!existsSync(path)) { console.log('skip', path); continue; }
  let c = readFileSync(path, 'utf8');
  if (!c.includes('rateLimit')) {
    c = importLine + c;
    c = c.replace('  try {', '  try {' + limitCheck);
    writeFileSync(path, c);
    console.log('patched', path);
  } else {
    console.log('already patched', path);
  }
}
