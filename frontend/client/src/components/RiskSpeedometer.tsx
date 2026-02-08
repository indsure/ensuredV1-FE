import React from "react";

interface RiskSpeedometerProps {
  /** Score 0–100; higher = stronger protection / lower risk */
  value: number;
  /** Rating label, e.g. "Strong Protection" */
  label?: string;
  /** Optional subtitle, e.g. "Protection score" */
  subtitle?: string;
  /** CSS class for the container */
  className?: string;
  /** Size in pixels; width = size, height ~ size * 0.7 */
  size?: number;
  /** Optional class for the label (e.g. rating color) */
  labelClassName?: string;
}

/**
 * Speedometer-style gauge for risk/protection score.
 * 0 (left) = high risk, 100 (right) = strong protection.
 * Uses internalScore from risk-meter-evaluator (clamped to 0–100).
 */
export function RiskSpeedometer({
  value,
  label,
  subtitle = "Protection score",
  className = "",
  size = 140,
  labelClassName,
}: RiskSpeedometerProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const cx = size / 2;
  const cy = size * 0.55;
  const r = size * 0.38;
  const needleLen = size * 0.32;

  // Arc from 180° (left, 0) to 0° (right, 100)
  const startX = cx - r;
  const endX = cx + r;
  const arcPath = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`;

  // Needle angle: 0 → 180°, 100 → 0°
  const deg = 180 - (clamped / 100) * 180;
  const rad = (deg * Math.PI) / 180;
  const nx = cx + needleLen * Math.cos(rad);
  const ny = cy - needleLen * Math.sin(rad);

  return (
    <div className={`flex flex-col items-center ${className}`} role="img" aria-label={`Protection score: ${clamped}, ${label || ""}`}>
      <svg
        width={size}
        height={size * 0.75}
        viewBox={`0 0 ${size} ${size * 0.75}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="risk-speedo-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="60%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="needle-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Track (full arc, light) */}
        <path
          d={arcPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={size * 0.065}
          strokeLinecap="round"
          className="text-gray-200 dark:text-gray-600"
        />

        {/* Filled arc 0 → value */}
        <path
          d={arcPath}
          fill="none"
          stroke="url(#risk-speedo-fill)"
          strokeWidth={size * 0.065}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 100} 100`}
          pathLength={100}
          className="transition-all duration-700 ease-out"
        />

        {/* Tick marks: 0, 25, 50, 75, 100 */}
        {[0, 25, 50, 75, 100].map((t) => {
          const td = 180 - (t / 100) * 180;
          const tr = (td * Math.PI) / 180;
          const innerR = r - size * 0.04;
          const outerR = r + size * 0.02;
          const x1 = cx + innerR * Math.cos(tr);
          const y1 = cy - innerR * Math.sin(tr);
          const x2 = cx + outerR * Math.cos(tr);
          const y2 = cy - outerR * Math.sin(tr);
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={t === 50 ? 1.5 : 1}
              className="text-gray-400 dark:text-gray-500"
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#1f2937"
          strokeWidth={size * 0.022}
          strokeLinecap="round"
          filter="url(#needle-shadow)"
          className="dark:stroke-gray-700 transition-all duration-700 ease-out"
        />
        {/* Needle center hub */}
        <circle cx={cx} cy={cy} r={size * 0.04} fill="#1f2937" className="dark:fill-gray-600" />

        {/* Center score (below hub) */}
        <text
          x={cx}
          y={cy + size * 0.1}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-gray-100 font-bold tabular-nums"
          style={{ fontSize: size * 0.12 }}
        >
          {Math.round(clamped)}
        </text>
      </svg>

      {label && (
        <span className={`text-sm font-semibold mt-0.5 text-center max-w-[120px] ${labelClassName ?? "text-gray-900 dark:text-gray-100"}`}>
          {label}
        </span>
      )}
      {subtitle && (
        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</span>
      )}
    </div>
  );
}
