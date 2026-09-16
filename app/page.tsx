"use client";
import RefreshButton from "@/components/RefreshButton";
import ChatAgent from "@/components/ChatAgent";
import SendModal from "@/components/SendModal";
import ReceiveModal from "@/components/ReceiveModal";

import { useMemo, useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import AuthButton from "@/components/AuthButton";
import type { Portfolio } from "@/lib/portfolio";

function usd(n: number) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}
function chainLabel(network: string) {
  if (network === "eth-mainnet") return "Ethereum";
  if (network === "base-mainnet") return "Base";
  if (network === "solana-mainnet") return "Solana";
  return network;
}
function formatBalance(balance: string) {
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  if (n > 0 && n < 0.000001) return n.toExponential(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function getSolanaAddress(user: any): string | null {
  if (!user) return null;
  const accounts = user.linkedAccounts ?? [];
  const sol = accounts.find((a: any) => a.type === "wallet" && a.chainType === "solana");
  if (sol?.address) return sol.address;
  const any = accounts.find((a: any) => a.type === "wallet");
  return any?.address ?? user.wallet?.address ?? null;
}

export default function Page() {
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Portfolio | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [preFill, setPreFill] = useState<{token:"SOL"|"USDC",to:string,amount:string}|null>(null);
  const [showReceive, setShowReceive] = useState(false);

  const walletAddress = getSolanaAddress(user) ?? wallets?.[0]?.address ?? null;
  const total = data?.totalValue ?? 0;

  async function load(address: string) {
    setLoading(true); setError(null); setData(null);
    try {
      const r = await fetch("/api/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: address.trim() }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? json.detail ?? "Could not load portfolio");
      setData(json as Portfolio);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (authenticated && walletAddress) load(walletAddress); }, [authenticated, walletAddress]);

  const pricedCount = useMemo(() => data?.positions.filter((p) => p.valueUsd != null).length ?? 0, [data]);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted">Loading...</p></div>;

  if (!authenticated) {
    function handleAgentSend(token: "SOL"|"USDC", to: string, amount: string) {
    setPreFill({ token, to, amount });
    setShowSend(true);
  }

  return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <p className="text-sm font-medium tracking-[0.2em] text-accent">🏛️ BERCY</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">One account. Every chain. Zero fees.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in with your email — no seed phrase, no crypto knowledge needed.</p>
        </div>
        <AuthButton />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-accent">🏛️ BERCY</p>
            <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight">One account. Every chain. Zero fees.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">Your Solana wallet. Multi-chain portfolio. Alchemy-powered.</p>
          </div>
          <AuthButton />
        </header>

        {walletAddress && (
          <div className="mt-6 rounded-2xl border border-line bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted mb-3">Your Solana Wallet</div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm break-all text-accent">{walletAddress}</span>
              <button onClick={copyAddress} className="shrink-0 px-4 py-2 rounded-lg border border-line text-xs font-medium hover:border-accent hover:text-accent transition">
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button onClick={() => setShowReceive(true)} className="shrink-0 px-4 py-2 rounded-lg border border-line text-xs font-medium hover:border-accent hover:text-accent transition">Receive</button>
              <button onClick={() => setShowSend(true)} className="shrink-0 px-4 py-2 rounded-lg bg-accent text-black text-xs font-medium">Send</button>
              <RefreshButton onRefresh={() => walletAddress && load(walletAddress)} />
            </div>
          </div>
        )}

        {error && <div role="alert" className="mt-4 rounded-xl border border-red-900 bg-red-950 p-4 text-sm text-red-200"><p>{error}</p></div>}

        {loading && (
          <section className="mt-8 grid gap-4">
            <div className="h-28 animate-pulse rounded-2xl bg-card" />
            <div className="h-64 animate-pulse rounded-2xl bg-card" />
          </section>
        )}

        {data && (
          <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-line bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted">Total value</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{usd(total)}</div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted">SOL</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{formatBalance(data.positions.find(p => p.symbol === 'SOL')?.balance ?? '0')}</div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted">ETH</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{formatBalance(data.positions.find(p => p.symbol === 'ETH')?.balance ?? '0')}</div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted">USDC</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{formatBalance(data.positions.find(p => p.symbol === 'USDC')?.balance ?? '0')}</div>
            </div>
          </section>
        )}

        {data?.positions.length ? (
          <section className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Chain</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-right font-medium">USD value</th>
                  <th className="px-4 py-3 text-right font-medium">Weight %</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p, idx) => {
                  const value = p.valueUsd ?? 0;
                  const weight = total ? (100 * value) / total : 0;
                  return (
                    <tr key={`${p.network}-${p.contractAddress}-${idx}`} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{p.symbol}</td>
                      <td className="px-4 py-3 text-muted">{chainLabel(p.network)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatBalance(p.balance)}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.valueUsd != null ? usd(p.valueUsd) : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.valueUsd != null ? `${weight.toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}

        {data && data.positions.length === 0 && walletAddress && (
          <section className="mt-6 rounded-2xl border border-dashed border-line p-6">
            <p className="text-sm font-medium text-muted mb-4">No tokens yet. Send SOL or USDC to this address to see your balance here.</p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-card border border-line px-4 py-3">
              <span className="font-mono text-sm break-all text-accent">{walletAddress}</span>
              <button onClick={copyAddress} className="shrink-0 px-4 py-2 rounded-lg border border-line text-xs font-medium hover:border-accent hover:text-accent transition">
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </section>
        )}

        <footer className="mt-auto pt-12 text-center text-xs text-muted">Built on Solana · Powered by Alchemy</footer>
      {showSend && <SendModal onClose={() => { setShowSend(false); walletAddress && load(walletAddress); }} />}
      {showReceive && walletAddress && <ReceiveModal address={walletAddress} onClose={() => setShowReceive(false)} />}
      </div>
    </div>
  );
}
