import { rateLimit } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DATA_BASE = "https://api.g.alchemy.com/data/v1";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

function isAddress(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) || /^0x[a-fA-F0-9]{40}$/.test(v);
}

function formatUnits(atomic: string, decimals: number): string {
  let bi: bigint;
  try {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = rateLimit(ip);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Wait 1 minute.' }, { status: 429 });

    bi = atomic.startsWith("0x") ? BigInt(atomic) : BigInt(atomic);
  } catch { return "0"; }
  const d = Math.max(0, Math.min(36, decimals));
  const base = 10n ** BigInt(d);
  const whole = bi / base;
  const frac = bi % base;
  if (frac === 0n) return whole.toString();
  let fracStr = frac.toString().padStart(d, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function toNumber(dec: string): number {
  const n = Number(dec);
  return Number.isFinite(n) ? n : 0;
}

function pickUsdPrice(tokenPrices?: { currency: string; value: string }[]) {
  const p = tokenPrices?.find((x) => x.currency?.toLowerCase() === "usd");
  if (!p) return null;
  const num = Number(p.value);
  return Number.isFinite(num) ? num : null;
}

async function getSolPrice(apiKey: string): Promise<number | null> {
  try {
    const r = await fetch(`${DATA_BASE}/${apiKey}/prices/by-symbol`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["SOL"] }),
      cache: "no-store",
    });
    const j = await r.json();
    const val = j?.data?.[0]?.prices?.find((p: any) => p.currency === "usd")?.value;
    return val ? Number(val) : null;
  } catch { return null; }
}

async function getSolanaPositions(address: string, solPrice: number | null) {
  const positions: any[] = [];

  try {
    // Native SOL balance
    const balRes = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      cache: "no-store",
    });
    const balJson = await balRes.json();
    const lamports: number = balJson?.result?.value ?? 0;
    if (lamports > 0) {
      const solBalance = lamports / 1_000_000_000;
      positions.push({
        network: "solana-mainnet",
        contractAddress: null,
        symbol: "SOL",
        name: "Solana",
        logo: null,
        decimals: 9,
        balance: solBalance.toString(),
        priceUsd: solPrice,
        valueUsd: solPrice != null ? solBalance * solPrice : null,
      });
    }
  } catch {}

  try {
    // SPL tokens
    const splRes = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          address,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
      cache: "no-store",
    });
    const splJson = await splRes.json();
    const accounts = splJson?.result?.value ?? [];
    for (const acc of accounts) {
      const info = acc?.account?.data?.parsed?.info;
      if (!info) continue;
      const amount = info.tokenAmount;
      if (!amount || Number(amount.uiAmount) === 0) continue;
      positions.push({
        network: "solana-mainnet",
        contractAddress: info.mint ?? null,
        symbol: "SPL",
        name: info.mint ? `${info.mint.slice(0, 4)}...${info.mint.slice(-4)}` : "Token",
        logo: null,
        decimals: amount.decimals,
        balance: amount.uiAmountString ?? amount.uiAmount?.toString() ?? "0",
        priceUsd: null,
        valueUsd: null,
      });
    }
  } catch {}

  return positions;
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (typeof address !== "string" || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid or missing address" }, { status: 400 });
    }

    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing ALCHEMY_API_KEY" }, { status: 500 });

    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !address.startsWith("0x");

    const solPrice = await getSolPrice(apiKey);

    let evmPositions: any[] = [];
    if (!isSolana) {
      const url = `${DATA_BASE}/${apiKey}/assets/tokens/by-address`;
      const body = {
        addresses: [{ address, networks: ["eth-mainnet", "base-mainnet"] }],
        withMetadata: true, withPrices: true,
        includeNativeTokens: true, includeErc20Tokens: true,
      };
      const tokens: any[] = [];
      let pageKey: string | undefined;
      do {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pageKey ? { ...body, pageKey } : body),
          cache: "no-store",
        });
        if (!r.ok) break;
        const j = await r.json();
        tokens.push(...(j?.data?.tokens ?? []));
        pageKey = j?.data?.pageKey || undefined;
      } while (pageKey);

      evmPositions = tokens.map((t) => {
        const meta = t.tokenMetadata ?? {};
        const decimals = typeof meta.decimals === "number" ? meta.decimals : 18;
        const atomic = String(t.tokenBalance ?? "0");
        const balanceStr = formatUnits(atomic, decimals);
        const balanceNum = toNumber(balanceStr);
        const priceUsd = pickUsdPrice(t.tokenPrices) ?? null;
        return {
          network: t.network || "eth-mainnet",
          contractAddress: t.tokenAddress ?? null,
          symbol: meta.symbol ?? (t.tokenAddress ? "TOKEN" : "ETH"),
          name: meta.name ?? null,
          logo: meta.logo ?? null,
          decimals,
          balance: balanceStr,
          priceUsd,
          valueUsd: priceUsd != null ? balanceNum * priceUsd : null,
        };
      }).filter((p) => toNumber(p.balance) > 0);
    }

    const solanaPositions = isSolana ? await getSolanaPositions(address, solPrice) : [];

    const positions = [...evmPositions, ...solanaPositions]
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

    const totalValue = positions.reduce((acc, p) => acc + (p.valueUsd ?? 0), 0);

    return NextResponse.json(
      { address, positions, totalValue, computedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 400 });
  }
}
