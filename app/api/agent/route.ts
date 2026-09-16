import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit } from "@/lib/rateLimit";
import { validateSolanaAddress } from "@/lib/validate";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
const HELIUS_KEY  = process.env.HELIUS_API_KEY  ?? "";

async function getSolPrice(): Promise<string> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" });
    const j = await r.json();
    return j?.solana?.usd?.toString() ?? "unknown";
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
    return ((j?.result?.value ?? 0) / 1_000_000_000).toFixed(6);
  } catch { return "0"; }
}

async function getUsdcBalance(address: string): Promise<string> {
  try {
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [address, { mint: USDC_MINT }, { encoding: "jsonParsed" }] }),
      cache: "no-store",
    });
    const j = await r.json();
    const accounts = j?.result?.value ?? [];
    if (accounts.length === 0) return "0.00";
    return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmountString ?? "0.00";
  } catch { return "0.00"; }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1";
  const rl = rateLimit(ip);
  if (!rl.ok) return NextResponse.json({ type: "message", text: "Too many requests. Wait 1 minute." }, { status: 429 });

  try {
    const { message, walletAddress } = await req.json();

    const addrCheck = validateSolanaAddress(walletAddress);
  if (!addrCheck.ok) return NextResponse.json({ type: "message", text: addrCheck.error }, { status: 400 });

  const [solPrice, solBalance, usdcBalance] = await Promise.all([
      getSolPrice(),
      getSolBalance(walletAddress),
      getUsdcBalance(walletAddress),
    ]);

    const systemPrompt = `You are Bercy — an AI-native neobank on Solana.
LIVE DATA:
- User wallet: ${walletAddress}
- SOL balance: ${solBalance} SOL
- USDC balance: ${usdcBalance} USDC
- SOL price: $${solPrice} USD

ALWAYS respond with valid JSON only. No markdown. No explanation outside JSON.
If user asks about balance or price → {"type":"message","text":"your answer here"}
If user wants to send crypto → {"type":"send_sol","to":"ADDRESS","amount":"AMOUNT"} or {"type":"send_usdc","to":"ADDRESS","amount":"AMOUNT"}
Never send without a valid Solana address. If no address given, ask for it in a message response.
If balance is low, return send_sol or send_usdc JSON anyway — never return a message type when user explicitly asks to send to a valid address.`;

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
    if (!jsonMatch) return NextResponse.json({ type: "message", text: raw });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e: any) {
    return NextResponse.json({ type: "message", text: `Error: ${e?.message}` }, { status: 500 });
  }
}
