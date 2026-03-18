"use client";

import React, { useMemo } from "react";
import type { DashboardData } from "@/types/dashboard";

interface GlobalTensionIndicatorProps {
  data: DashboardData | null;
}

interface TensionResult {
  score: number;
  level: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  color: string;
  barColor: string;
}

function computeTension(data: DashboardData | null): TensionResult {
  if (!data) return { score: 0, level: "LOW", color: "text-green-400", barColor: "bg-green-500" };

  let score = 0;

  // Military flights: +1 each, capped at 30
  score += Math.min((data.military_flights?.length ?? 0), 30);

  // GPS jamming zones: +5 each, capped at 40
  score += Math.min((data.gps_jamming?.length ?? 0) * 5, 40);

  // Significant earthquakes (M5+): +3 each, capped at 30
  const bigQuakes = (data.earthquakes ?? []).filter((eq) => (eq.mag ?? 0) >= 5).length;
  score += Math.min(bigQuakes * 3, 30);

  // Active frontlines: +15
  if (data.frontlines) score += 15;

  // Global incidents: +0.5 each, capped at 25
  score += Math.min((data.gdelt?.length ?? 0) * 0.5, 25);

  // Internet outages: +3 each, capped at 24
  score += Math.min((data.internet_outages?.length ?? 0) * 3, 24);

  // Fire hotspots: +0.1 each, capped at 10
  score += Math.min((data.firms_fires?.length ?? 0) * 0.1, 10);

  // Space weather: Kp >= 5 adds to score
  const kp = data.space_weather?.kp_index ?? 0;
  if (kp >= 8) score += 15;
  else if (kp >= 6) score += 8;
  else if (kp >= 5) score += 4;

  score = Math.round(Math.min(score, 100));

  let level: TensionResult["level"];
  let color: string;
  let barColor: string;

  if (score <= 20) {
    level = "LOW";
    color = "text-green-400";
    barColor = "bg-green-500";
  } else if (score <= 50) {
    level = "ELEVATED";
    color = "text-yellow-400";
    barColor = "bg-yellow-500";
  } else if (score <= 75) {
    level = "HIGH";
    color = "text-orange-400";
    barColor = "bg-orange-500";
  } else {
    level = "CRITICAL";
    color = "text-red-400";
    barColor = "bg-red-500";
  }

  return { score, level, color, barColor };
}

export default function GlobalTensionIndicator({ data }: GlobalTensionIndicatorProps) {
  const tension = useMemo(() => computeTension(data), [data]);

  return (
    <div className="flex flex-col items-center" title={`Global Tension Score: ${tension.score}/100`}>
      <div className="text-[8px] text-[var(--text-muted)] font-mono tracking-[0.2em]">TENSION</div>
      <div className={`text-[11px] font-mono font-bold ${tension.color}`}>
        {tension.level}
      </div>
      {/* Mini bar */}
      <div className="w-10 h-0.5 bg-[var(--border-primary)] rounded-full mt-0.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${tension.barColor}`}
          style={{ width: `${tension.score}%` }}
        />
      </div>
    </div>
  );
}
