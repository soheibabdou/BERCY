const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateSolanaAddress(address: unknown): { ok: boolean; error?: string } {
  if (typeof address !== "string" || address.trim() === "") {
    return { ok: false, error: "Missing wallet address." };
  }
  if (!BASE58_REGEX.test(address.trim())) {
    return { ok: false, error: "Invalid Solana address." };
  }
  return { ok: true };
}

export function validateAmount(amount: unknown, token: "SOL" | "USDC"): { ok: boolean; error?: string } {
  const n = Number(amount);
  if (!amount || isNaN(n) || n <= 0) {
    return { ok: false, error: "Amount must be a positive number." };
  }
  if (String(amount).toLowerCase().includes("e")) {
    return { ok: false, error: "Scientific notation not allowed." };
  }
  if (token === "SOL" && n > 1000) {
    return { ok: false, error: "Max single SOL transaction is 1000 SOL." };
  }
  if (token === "USDC" && n > 100_000) {
    return { ok: false, error: "Max single USDC transaction is 100,000 USDC." };
  }
  return { ok: true };
}
