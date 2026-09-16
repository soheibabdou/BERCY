import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
const HELIUS_KEY  = process.env.HELIUS_API_KEY  ?? "";

async function getSolPrice(): Promise<string> {
  try {
    const r = await fetch(
      `https://api.g.alchemy.com/data/v1/${ALCHEMY_KEY}/assets/prices/by-symbol?symbols=SOL`,
      { headers: { accept: "application/json" }, cache: "no-store" }
    );
    const j = await r.json();
    return j?.data?.[0]?.prices?.find((p: any) => p.currency === "usd")?.value ?? "unknown";
  } catch { return "unknown"; }
}

async function getSolBalance(address: string): Promise<string> {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      cache: "no-store",
    });
    const j = await r.json();
    const lamports = j?.result?.value ?? 0;
    return (lamports / 1_000_000_000).toFixed(6);
  } catch { return "0"; }
}

export async function POST(req: NextRequest) {
  try {
    const { message, walletAddress } = await req.json();

    const [solPrice, solBalance] = await Promise.all([
      getSolPrice(),
      getSolBalance(walletAddress),
    ]);

    const systemPrompt = `You are Bercy — an AI-native neobank on Solana.

LIVE DATA:
- User wallet: ${walletAddress}
- SOL balance: ${solBalance} SOL
- SOL price: $${solPrice} USD

ALWAYS respond with valid JSON only. No markdown. No explanation outside JSON.

If user asks about balance or price → respond:
{"type":"message","text":"your answer here"}

If user wants to send crypto → respond:
{"type":"send_sol","to":"ADDRESS","amount":"AMOUNT"}
or
{"type":"send_usdc","to":"ADDRESS","amount":"AMOUNT"}

Never send without a valid Solana address in the message.
If no address given, ask for it in a message response.`;

    const response = await groq.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      max_tokens: 512,
    });

    const raw = response.choices[0]?.message?.content ?? '{"type":"message","text":"Sorry, try again."}';

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ type: "message", text: raw });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ type: "message", text: `Error: ${e?.message}` }, { status: 500 });
  }
}
