import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
const HELIUS_KEY = process.env.HELIUS_API_KEY ?? "";

const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_sol_price",
      description: "Get current SOL price in USD",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sol_balance",
      description: "Get the user's SOL balance from Solana",
      parameters: {
        type: "object",
        properties: {
          wallet_address: { type: "string" },
        },
        required: ["wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_payment",
      description: "Open the send modal pre-filled. Use after confirming sufficient balance.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["SOL", "USDC"] },
          to: { type: "string" },
          amount: { type: "string" },
        },
        required: ["token", "to", "amount"],
      },
    },
  },
];

async function runTool(name: string, args: any, walletAddress: string): Promise<string> {
  if (name === "get_sol_price") {
    try {
      const r = await fetch(
        `https://api.g.alchemy.com/data/v1/${ALCHEMY_KEY}/assets/prices/by-symbol?symbols=SOL`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      const j = await r.json();
      const price = j?.data?.[0]?.prices?.find((p: any) => p.currency === "usd")?.value ?? "unknown";
      return JSON.stringify({ sol_price_usd: price });
    } catch {
      return JSON.stringify({ sol_price_usd: "unavailable" });
    }
  }

  if (name === "get_sol_balance") {
    try {
      const address = args.wallet_address ?? walletAddress;
      const r = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
          cache: "no-store",
        }
      );
      const j = await r.json();
      const lamports = j?.result?.value ?? 0;
      const sol = (lamports / 1_000_000_000).toFixed(6);
      return JSON.stringify({ sol_balance: sol, wallet: address });
    } catch {
      return JSON.stringify({ sol_balance: "0" });
    }
  }

  if (name === "send_payment") {
    return JSON.stringify({ action: "open_send_modal", token: args.token, to: args.to, amount: args.amount });
  }

  return JSON.stringify({ error: "unknown tool" });
}

export async function POST(req: NextRequest) {
  try {
    const { message, walletAddress } = await req.json();

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are Bercy — an AI-native neobank on Solana. Help users with crypto payments.
Always check balance before suggesting a send. Show amounts in token and USD.
User wallet: ${walletAddress}`,
      },
      { role: "user", content: message },
    ];

    let response = await groq.chat.completions.create({
      model: "groq/compound-mini",
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 1024,
    });

    let choice = response.choices[0];

    let iterations = 0;
    while (choice.finish_reason === "tool_calls" && choice.message.tool_calls && iterations < 5) {
      iterations++;
      messages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await runTool(tc.function.name, args, walletAddress);

        if (tc.function.name === "send_payment") {
          const parsed = JSON.parse(result);
          return NextResponse.json({ type: "send_" + parsed.token.toLowerCase(), to: parsed.to, amount: parsed.amount });
        }

        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      response = await groq.chat.completions.create({
        model: "groq/compound-mini",
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 1024,
      });
      choice = response.choices[0];
    }

    const text = choice.message.content ?? "I could not process that.";
    return NextResponse.json({ type: "message", text });
  } catch (e: any) {
    return NextResponse.json({ type: "message", text: `Error: ${e?.message}` }, { status: 500 });
  }
}
