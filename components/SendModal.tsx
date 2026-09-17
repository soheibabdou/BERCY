"use client";
import { useState } from "react";
import { useSolanaWallets } from "@privy-io/react-auth";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount } from "@solana/spl-token";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? ""}`;

export default function SendModal({ onClose, initialToken = "SOL", initialTo = "", initialAmount = "" }: { onClose: () => void; initialToken?: "SOL" | "USDC"; initialTo?: string; initialAmount?: string; }) {
  const { wallets, ready } = useSolanaWallets();
  const [token, setToken] = useState<"SOL" | "USDC">(initialToken);
  const [to, setTo] = useState(initialTo);
  const [amount, setAmount] = useState(initialAmount);
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  async function handleSend() {
    if (!to || !amount) return;
    if (!ready || !wallets[0]) { setError("Wallet not ready. Please wait or sign out and back in."); return; }
    const wallet = wallets[0];
    setStatus("loading"); setError("");
    try {
      const connection = new Connection(HELIUS_RPC, "confirmed");
      const { blockhash } = await connection.getLatestBlockhash();
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(to.trim());
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;
      if (token === "SOL") {
        tx.add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.round(parseFloat(amount) * LAMPORTS_PER_SOL) }));
      } else {
        const senderATA = await getAssociatedTokenAddress(USDC_MINT, fromPubkey);
        const recipientATA = await getAssociatedTokenAddress(USDC_MINT, toPubkey);
        try { await getAccount(connection, recipientATA); } catch { tx.add(createAssociatedTokenAccountInstruction(fromPubkey, recipientATA, toPubkey, USDC_MINT)); }
        tx.add(createTransferInstruction(senderATA, recipientATA, fromPubkey, Math.round(parseFloat(amount) * 1e6)));
      }
      const signedTx = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig); setStatus("success");
    } catch (e: any) { setError(e?.message ?? "Transaction failed"); setStatus("error"); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-line rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Send</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>
        {status === "success" ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-2xl mb-2">✅ Sent</div>
            <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer" className="text-accent text-sm underline">View on Solscan →</a>
            <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line py-2 text-sm">Close</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-5">
              {(["SOL","USDC"] as const).map((t) => (
                <button key={t} onClick={() => setToken(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${token === t ? "bg-accent text-black border-accent" : "border-line text-muted hover:border-accent"}`}>{t}</button>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Recipient address</label>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address..." className="mt-1 w-full rounded-xl bg-black border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Amount ({token})</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number" className="mt-1 w-full rounded-xl bg-black border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent" />
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2 text-sm">Cancel</button>
              <button onClick={handleSend} disabled={status === "loading" || !to || !amount} className="flex-1 rounded-xl bg-accent text-black py-2 text-sm font-medium disabled:opacity-50">
                {status === "loading" ? "Sending..." : `Send ${token} →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
