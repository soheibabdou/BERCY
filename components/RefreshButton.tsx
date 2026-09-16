"use client";
import { useState, useEffect } from "react";

export default function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  useEffect(() => {
    const autoRefresh = setInterval(() => {
      onRefresh();
      setLastUpdated(new Date());
      setSeconds(0);
    }, 30000);
    return () => clearInterval(autoRefresh);
  }, [onRefresh]);

  function handleClick() {
    onRefresh();
    setLastUpdated(new Date());
    setSeconds(0);
  }

  return (
    <button
      onClick={handleClick}
      className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
    >
      ↻ Refresh · {seconds}s ago
    </button>
  );
}
