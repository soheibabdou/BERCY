"use client";
import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export default function SendModal({ onClose }: { onClose: () => void }) {
  const { wallets } = useWallets();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function handleSend() {
    if (!to || !amount) return;
    const wallet = wallets[0];
    if (!wallet) { setError("No wallet found"); return; }

    setStatus("loading");
    setError("");

    try {
      const blockhashRes = await fetch("/api/send");
      const { blockhash } = await blockhashRes.json();

      const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? ""}`,
        "confirmed"
      );

      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(wallet.address);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet.address),
          toPubkey: new PublicKey(to.trim()),
          lamports: Math.round(parseFloat(amount) * LAMPORTS_PER_SOL),
        })
      );

      const sig = await wallet.sendTransaction(tx, connection);
      setSignature(sig);
      setStatus("success");
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-line rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Send SOL</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {status === "success" ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-2xl mb-2">✅ Sent</div>
            <a
              href={`https://solscan.io/tx/${signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm underline"
            >
              View on Solscan →
            </a>
            <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line py-2 text-sm">Close</button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Recipient address</label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Solana address..."
                  className="mt-1 w-full rounded-xl bg-black border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Amount (SOL)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.001"
                  className="mt-1 w-full rounded-xl bg-black border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2 text-sm">Cancel</button>
              <button
                onClick={handleSend}
                disabled={status === "loading" || !to || !amount}
                className="flex-1 rounded-xl bg-accent text-black py-2 text-sm font-medium disabled:opacity-50"
              >
                {status === "loading" ? "Sending..." : "Send →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
