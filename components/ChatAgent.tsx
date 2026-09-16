"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "agent"; text: string };
type AgentResponse =
  | { type: "message"; text: string }
  | { type: "send_sol" | "send_usdc"; to: string; amount: string };

const EXAMPLES = [
  "What's my SOL balance?",
  "How much is 1 SOL in USD?",
  "Send 0.01 SOL to [address]",
];

export default function ChatAgent({
  walletAddress,
  onSend,
}: {
  walletAddress: string;
  onSend: (token: "SOL" | "USDC", to: string, amount: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, walletAddress }),
      });
      const data: AgentResponse = await r.json();
      if (data.type === "message") {
        setMessages((m) => [...m, { role: "agent", text: data.text }]);
      } else {
        const token = data.type === "send_sol" ? "SOL" : "USDC";
        setMessages((m) => [
          ...m,
          { role: "agent", text: `Opening Send — ${data.amount} ${token} to ${data.to.slice(0, 8)}...` },
        ]);
        onSend(token, data.to, data.amount);
      }
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-5">
      <div className="text-xs text-muted uppercase tracking-wide mb-3">Ask Bercy anything</div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => send(e)}
              className="text-xs border border-line rounded-xl px-3 py-1 text-muted hover:border-accent hover:text-accent transition">
              {e}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-xl px-3 py-2 text-sm max-w-xs ${
                m.role === "user" ? "bg-accent text-black" : "bg-black border border-line text-white"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3 py-2 text-sm border border-line text-muted">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && send(input)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl bg-black border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent" />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          className="rounded-xl bg-accent text-black px-4 py-2 text-sm font-medium disabled:opacity-50">
          →
        </button>
      </div>
    </div>
  );
}
