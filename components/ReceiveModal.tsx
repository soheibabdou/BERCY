"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function ReceiveModal({
  address,
  onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-line rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Receive SOL</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={address} size={180} />
          </div>
        </div>

        <p className="text-xs text-muted text-center mb-3">
          Send SOL or USDC to this address
        </p>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-black border border-line px-4 py-3">
          <span className="font-mono text-xs break-all text-accent">{address}</span>
          <button
            onClick={copy}
            className="shrink-0 px-3 py-1 rounded-lg border border-line text-xs hover:border-accent hover:text-accent transition"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-line py-2 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}
