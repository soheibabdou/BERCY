import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";

const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_sol_price",
      description: "Get the current SOL price in USD",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_token_balances",
      description: "Get the user's SOL, USDC and ETH balances",
      parameters: {
        type: "object",
        properties: {
          wallet_address: { type: "string", description: "The user's Solana wallet address" },
        },
        required: ["wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_payment",
      description: "Initiate a payment by pre-filling the send modal. Use after confirming balance is sufficient.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["SOL", "USDC"], description: "Token to send" },
          to: { type: "string", description: "Recipient Solana wallet address" },
          amount: { type: "string", description: "Amount to send as a decimal string" },
        },
        required: ["token", "to", "amount"],
      },
    },
  },
];

async function runTool(name: string, args: any, walletAddress: string): Promise<string> {
  if (name === "get_sol_price") {
    const r = await fetch(
      `https://api.g.alchemy.com/data/v1/${ALCHEMY_KEY}/assets/prices/by-symbol?symbols=SOL`,
      { headers: { accept: "application/json" }, cache: "no-store" }
    );
    const j = await r.json();
    const price = j?.data?.[0]?.prices?.find((p: any) => p.currency === "usd")?.value ?? "unknown";
    return JSON.stringify({ sol_price_usd: price });
  }

  if (name === "get_token_balances") {
    const address = args.wallet_address ?? walletAddress;
    const r = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
      cache: "no-store",
    });
    const j = await r.json();
    const sol = j?.solBalance ?? 0;
    const usdc = j?.usdcBalance ?? 0;
    const total = j?.totalValue ?? 0;
    return JSON.stringify({ sol, usdc, total_usd: total });
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
        content: `You are Bercy — an AI-native neobank assistant.
Help users send, receive, and understand their crypto on Solana.
Always check balance before suggesting a send.
Always show amounts in both token and USD.
Never send without user confirmation.
Wallet address: ${walletAddress}`,
      },
      { role: "user", content: message },
    ];

    let response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 1024,
    });

    let choice = response.choices[0];

    while (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
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
        model: "llama-3.1-8b-instant",
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 1024,
      });
      choice = response.choices[0];
    }

    const text = choice.message.content ?? "I couldn't process that.";
    return NextResponse.json({ type: "message", text });
  } catch (e: any) {
    return NextResponse.json({ type: "message", text: `Error: ${e?.message}` }, { status: 500 });
  }
}
