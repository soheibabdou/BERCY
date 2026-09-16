import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const { signedTransaction } = await req.json();
    if (!signedTransaction) {
      return NextResponse.json({ error: "Missing signedTransaction" }, { status: 400 });
    }

    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [signedTransaction, { encoding: "base64" }],
      }),
      cache: "no-store",
    });

    const json = await res.json();
    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 400 });
    }

    return NextResponse.json({ signature: json.result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "getLatestBlockhash",
      params: [{ commitment: "finalized" }],
    }),
    cache: "no-store",
  });
  const json = await res.json();
  return NextResponse.json({ blockhash: json.result?.value?.blockhash });
}
