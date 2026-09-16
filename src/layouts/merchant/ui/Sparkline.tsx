"use client";

import { useId } from "react";

/** Area sparkline with the endpoint marked; `prior` draws the comparison period dashed.
 * Ported from web-shared/ui.tsx. Used by StatTile and MetricsCard. */
export default function Sparkline({
  points,
  prior,
  height = 46,
  label,
  className = "",
}: {
  points: number[];
  prior?: number[] | null;
  height?: number;
  label: string;
  className?: string;
}) {
  const gradientId = useId();
  if (points.length < 2) return null;
  const width = 200;
  const pad = 4;
  const all = prior?.length ? points.concat(prior) : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const place = (series: number[]) =>
    series.map((value, index) => [pad + (index * (width - 2 * pad)) / (series.length - 1), height - pad - ((value - min) / span) * (height - 2 * pad - 6) - 3]);
  const line = (coords: number[][]) => `M${coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")}`;
  const coords = place(points);
  const [endX, endY] = coords[coords.length - 1];
  const path = line(coords);
  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ink)" stopOpacity=".14" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        {prior && prior.length > 1 ? (
          <path d={line(place(prior))} fill="none" stroke="var(--ink-faint)" strokeWidth="1.3" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ) : null}
        <path d={`${path} L${endX},${height} L${coords[0][0]},${height} Z`} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        aria-hidden
        className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.6px] border-(--ink) bg-(--card)"
        style={{ left: `${(endX / width) * 100}%`, top: `${(endY / height) * 100}%` }}
      />
    </div>
  );
}
