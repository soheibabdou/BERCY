import { readFileSync, writeFileSync } from 'fs';

let agent = readFileSync('app/api/agent/route.ts', 'utf8');
if (!agent.includes('validateSolanaAddress')) {
  agent = agent.replace(
    'import { rateLimit } from "@/lib/rateLimit";',
    'import { rateLimit } from "@/lib/rateLimit";\nimport { validateSolanaAddress } from "@/lib/validate";'
  );
  agent = agent.replace(
    '  const [solPrice, solBalance, usdcBalance]',
    `  const addrCheck = validateSolanaAddress(walletAddress);
  if (!addrCheck.ok) return NextResponse.json({ type: "message", text: addrCheck.error }, { status: 400 });

  const [solPrice, solBalance, usdcBalance]`
  );
  writeFileSync('app/api/agent/route.ts', agent);
  console.log('patched agent');
}

let tokens = readFileSync('app/api/tokens/route.ts', 'utf8');
if (!tokens.includes('validateSolanaAddress')) {
  tokens = tokens.replace(
    'import { NextRequest, NextResponse } from "next/server";',
    'import { NextRequest, NextResponse } from "next/server";\nimport { validateSolanaAddress } from "@/lib/validate";'
  );
  tokens = tokens.replace(
    '    const { address } = await req.json();',
    `    const { address } = await req.json();
    const addrCheck = validateSolanaAddress(address);
    if (!addrCheck.ok) return NextResponse.json({ error: addrCheck.error }, { status: 400 });`
  );
  writeFileSync('app/api/tokens/route.ts', tokens);
  console.log('patched tokens');
}
console.log('Done');
