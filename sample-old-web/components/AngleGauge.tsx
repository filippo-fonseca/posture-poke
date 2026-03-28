"use client";

import { motion } from "framer-motion";

interface AngleGaugeProps {
  currentDelta: number;
}

export function AngleGauge({ currentDelta }: AngleGaugeProps) {
  const maxAngle = 50;
  const clampedDelta = Math.min(currentDelta, maxAngle);
  const percentage = clampedDelta / maxAngle;

  // SVG arc calculations
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Arc goes from 180° (left) to 0° (right)
  const startAngle = Math.PI; // 180°
  const endAngle = 0; // 0°
  const currentAngleRad = startAngle - percentage * Math.PI;

  // Start point (left)
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy - radius * Math.sin(startAngle);

  // Current point
  const currentX = cx + radius * Math.cos(currentAngleRad);
  const currentY = cy - radius * Math.sin(currentAngleRad);

  // Determine color based on angle
  let color = "#00ff88"; // green
  if (currentDelta >= 35) {
    color = "#ef4444"; // red
  } else if (currentDelta >= 20) {
    color = "#f59e0b"; // amber
  }

  // Arc path for background
  const bgArcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(endAngle)} ${cy - radius * Math.sin(endAngle)}`;

  // Arc path for value (use large arc flag if > 180°)
  const largeArcFlag = percentage > 0.5 ? 1 : 0;
  const valueArcPath =
    percentage > 0
      ? `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${currentX} ${currentY}`
      : "";

  // Zone markers
  const zones = [
    { angle: 0, label: "0°" },
    { angle: 20, label: "20°" },
    { angle: 35, label: "35°" },
    { angle: 50, label: "50°" },
  ];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-6">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="#1e1e32"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {percentage > 0 && (
          <motion.path
            d={valueArcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
            }}
          />
        )}

        {/* Zone tick marks */}
        {zones.map((zone) => {
          const zonePercentage = zone.angle / maxAngle;
          const zoneAngleRad = startAngle - zonePercentage * Math.PI;
          const tickInnerRadius = radius - strokeWidth / 2 - 8;
          const tickOuterRadius = radius - strokeWidth / 2 - 2;
          const tickX1 = cx + tickInnerRadius * Math.cos(zoneAngleRad);
          const tickY1 = cy - tickInnerRadius * Math.sin(zoneAngleRad);
          const tickX2 = cx + tickOuterRadius * Math.cos(zoneAngleRad);
          const tickY2 = cy - tickOuterRadius * Math.sin(zoneAngleRad);

          const labelRadius = radius - strokeWidth / 2 - 20;
          const labelX = cx + labelRadius * Math.cos(zoneAngleRad);
          const labelY = cy - labelRadius * Math.sin(zoneAngleRad);

          return (
            <g key={zone.angle}>
              <line
                x1={tickX1}
                y1={tickY1}
                x2={tickX2}
                y2={tickY2}
                stroke="#44445a"
                strokeWidth={2}
              />
              <text
                x={labelX}
                y={labelY}
                fill="#44445a"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        {/* Center text */}
        <text
          x={cx}
          y={cy + 10}
          fill={color}
          fontSize="36"
          fontFamily="var(--font-dm-mono)"
          fontWeight="500"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {currentDelta.toFixed(1)}°
        </text>
      </svg>

      {/* Labels */}
      <p className="mt-2 text-sm text-text-secondary">degrees off baseline</p>

      {/* Zone legend */}
      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-green" />
          <span className="text-text-tertiary">Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-amber" />
          <span className="text-text-tertiary">Warning</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-red" />
          <span className="text-text-tertiary">Poor</span>
        </div>
      </div>
    </div>
  );
}
