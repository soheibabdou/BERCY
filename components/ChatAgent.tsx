"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "agent"; text: string };
type PendingAction = { type: "send_sol" | "send_usdc"; to: string; amount: string; expiresAt: number };

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
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [countdown, setCountdown] = useState(30);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!pending) { setCountdown(30); return; }
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setPending(null);
        setMessages((m) => [...m, { role: "agent", text: "Request expired after 30 seconds. Send cancelled." }]);
      }
    }, 500);
    return () => clearInterval(timerRef.current!);
  }, [pending]);

  function approve() {
    if (!pending) return;
    clearInterval(timerRef.current!);
    const token = pending.type === "send_sol" ? "SOL" : "USDC";
    setMessages((m) => [...m, { role: "agent", text: `Approved. Opening send for ${pending.amount} ${token}...` }]);
    onSend(token, pending.to, pending.amount);
    setPending(null);
  }

  function reject() {
    clearInterval(timerRef.current!);
    setPending(null);
    setMessages((m) => [...m, { role: "agent", text: "Send rejected. How else can I help?" }]);
  }

  async function send(text: string) {
    if (!text.trim() || loading || pending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, walletAddress }),
      });
      const data = await r.json();
      if (data.type === "send_sol" || data.type === "send_usdc") {
        setPending({ type: data.type, to: data.to, amount: data.amount, expiresAt: Date.now() + 30_000 });
      } else {
        setMessages((m) => [...m, { role: "agent", text: data.text ?? "Sorry, try again." }]);
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

      {messages.length === 0 && !pending && (
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
        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-xl px-3 py-2 text-sm max-w-xs whitespace-pre-line ${
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

      {pending && (
        <div className="my-4 rounded-2xl border border-accent p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-accent font-semibold">Agent requesting send</span>
            <span className={`text-xs font-mono ${countdown <= 10 ? "text-red-400" : "text-muted"}`}>
              Expires {countdown}s
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Amount</span>
              <span className="text-white font-medium">{pending.amount} {pending.type === "send_sol" ? "SOL" : "USDC"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">To</span>
              <span className="font-mono text-xs text-white">{pending.to.slice(0, 12)}...{pending.to.slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Network</span>
              <span className="text-white">Solana Mainnet</span>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={approve}
              className="flex-1 rounded-xl bg-accent text-black py-2 text-sm font-semibold hover:opacity-90 transition">
              APPROVE
            </button>
            <button onClick={reject}
              className="flex-1 rounded-xl border border-line text-muted py-2 text-sm hover:border-red-400 hover:text-red-400 transition">
              REJECT
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && !pending && send(input)}
          disabled={!!pending}
          placeholder={pending ? "Waiting for your decision..." : "Type a message..."}
          className="flex-1 rounded-xl bg-black border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-40" />
        <button onClick={() => send(input)} disabled={loading || !input.trim() || !!pending}
          className="rounded-xl bg-accent text-black px-4 py-2 text-sm font-medium disabled:opacity-50">
          →
        </button>
      </div>
    </div>
  );
}
